import { createServer, type RequestListener, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import {
  loadPairingReconcilerConfig,
  reconcilePairingsOnce,
  runPairingReconciler
} from './reconciler'

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve, reject) =>
          server.close((error) => (error ? reject(error) : resolve()))
        )
    )
  )
})

async function relayFixture(
  handler: RequestListener
): Promise<string> {
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing address')
  return `http://127.0.0.1:${address.port}`
}

describe('pairing reconciler', () => {
  it('validates the long-running process environment', () => {
    expect(
      loadPairingReconcilerConfig({
        RELAY_INTERNAL_ORIGIN: 'http://relay:3000/',
        RELAY_SERVICE_TOKEN: 'config-service-token-is-at-least-32-bytes',
        PAIRING_RECONCILE_INTERVAL_MS: '15000'
      })
    ).toEqual({
      relayOrigin: 'http://relay:3000',
      serviceToken: 'config-service-token-is-at-least-32-bytes',
      intervalMs: 15_000
    })
    expect(() =>
      loadPairingReconcilerConfig({
        RELAY_INTERNAL_ORIGIN: 'http://relay:3000',
        RELAY_SERVICE_TOKEN: 'short'
      })
    ).toThrow('RELAY_SERVICE_TOKEN')
    expect(() =>
      loadPairingReconcilerConfig({
        RELAY_INTERNAL_ORIGIN: 'http://relay:3000',
        RELAY_SERVICE_TOKEN: 'config-service-token-is-at-least-32-bytes',
        PAIRING_RECONCILE_INTERVAL_MS: '999'
      })
    ).toThrow('PAIRING_RECONCILE_INTERVAL_MS')
  })

  it('publishes the durable projection to the authenticated Relay interface', async () => {
    const requests: Array<{
      method: string | undefined
      path: string | undefined
      authorization: string | undefined
      body: unknown
    }> = []
    const origin = await relayFixture(async (request, response) => {
      const chunks: Buffer[] = []
      for await (const chunk of request) chunks.push(Buffer.from(chunk))
      const text = Buffer.concat(chunks).toString('utf8')
      requests.push({
        method: request.method,
        path: request.url,
        authorization: request.headers.authorization,
        body: text ? (JSON.parse(text) as unknown) : null
      })
      response.writeHead(200, { 'content-type': 'application/json' })
      response.end(
        JSON.stringify(
          request.method === 'GET'
            ? {
                instanceId: 'MDEyMzQ1Njc4OWFiY2RlZg',
                synchronized: false,
                appliedRevision: -1
              }
            : {
                instanceId: 'MDEyMzQ1Njc4OWFiY2RlZg',
                appliedRevision: 12,
                activeRoomCount: 1
              }
        )
      )
    })

    const result = await reconcilePairingsOnce({
      relayOrigin: origin,
      serviceToken: 'reconciler-service-token-is-32-bytes',
      readProjection: () => ({
        revision: 12,
        rooms: [
          {
            roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
            revokeDigest: 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
          }
        ]
      })
    })

    expect(result).toEqual({
      instanceId: 'MDEyMzQ1Njc4OWFiY2RlZg',
      revision: 12,
      roomCount: 1,
      instanceChanged: true
    })
    expect(requests).toEqual([
      {
        method: 'GET',
        path: '/remote/v1/system/state',
        authorization: 'Bearer reconciler-service-token-is-32-bytes',
        body: null
      },
      {
        method: 'PUT',
        path: '/remote/v1/system/rooms',
        authorization: 'Bearer reconciler-service-token-is-32-bytes',
        body: {
          revision: 12,
          rooms: [
            {
              roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
              revokeDigest: 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
            }
          ]
        }
      }
    ])
  })

  it('runs immediately, repeats, and observes a replacement Relay instance', async () => {
    const controller = new AbortController()
    let reconcileRequests = 0
    const origin = await relayFixture((request, response) => {
      response.writeHead(200, { 'content-type': 'application/json' })
      if (request.method === 'PUT') {
        reconcileRequests += 1
        if (reconcileRequests === 3) controller.abort()
        response.end(
          JSON.stringify({
            instanceId:
              reconcileRequests < 3
                ? 'MDEyMzQ1Njc4OWFiY2RlZg'
                : 'ZmVkY2JhOTg3NjU0MzIxMA',
            appliedRevision: 0,
            activeRoomCount: 0
          })
        )
        return
      }
      response.end(
        JSON.stringify({
          instanceId:
            reconcileRequests < 2
              ? 'MDEyMzQ1Njc4OWFiY2RlZg'
              : 'ZmVkY2JhOTg3NjU0MzIxMA',
          synchronized: reconcileRequests > 0,
          appliedRevision: reconcileRequests > 0 ? 0 : -1
        })
      )
    })
    const logs: unknown[] = []
    const health: unknown[] = []

    await runPairingReconciler({
      relayOrigin: origin,
      serviceToken: 'loop-service-token-is-at-least-32-bytes',
      intervalMs: 5,
      signal: controller.signal,
      readProjection: () => ({ revision: 0, rooms: [] }),
      logger: (record) => logs.push(record),
      healthReporter: (record) => health.push(record),
      now: () => 1_700_000_000_000
    })

    expect(reconcileRequests).toBe(3)
    expect(logs).toEqual([
      expect.objectContaining({
        event: 'pairing-reconcile',
        result: 'applied',
        revision: 0,
        roomCount: 0,
        instanceChanged: true
      }),
      expect.objectContaining({
        event: 'pairing-reconcile',
        result: 'applied',
        revision: 0,
        roomCount: 0,
        instanceChanged: false
      }),
      expect.objectContaining({
        event: 'pairing-reconcile',
        result: 'applied',
        revision: 0,
        roomCount: 0,
        instanceChanged: true
      })
    ])
    expect(health).toEqual([
      {
        checkedAt: 1_700_000_000_000,
        lastSuccessAt: 1_700_000_000_000,
        consecutiveFailures: 0
      },
      {
        checkedAt: 1_700_000_000_000,
        lastSuccessAt: 1_700_000_000_000,
        consecutiveFailures: 0
      },
      {
        checkedAt: 1_700_000_000_000,
        lastSuccessAt: 1_700_000_000_000,
        consecutiveFailures: 0
      }
    ])
  })

  it('reports consecutive failures without letting a broken health adapter stop the loop', async () => {
    const controller = new AbortController()
    const health: unknown[] = []
    let attempts = 0
    const origin = await relayFixture((_request, response) => {
      attempts += 1
      response.writeHead(503, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ error: 'RELAY_UNAVAILABLE' }))
    })

    await runPairingReconciler({
      relayOrigin: origin,
      serviceToken: 'failure-loop-token-is-at-least-32-bytes',
      intervalMs: 1,
      signal: controller.signal,
      readProjection: () => ({ revision: 0, rooms: [] }),
      random: () => 0,
      now: () => 1_700_000_000_000,
      healthReporter: (record) => {
        health.push(record)
        if (health.length === 1) throw new Error('health sink unavailable')
        controller.abort()
      }
    })

    expect(attempts).toBe(2)
    expect(health).toEqual([
      {
        checkedAt: 1_700_000_000_000,
        lastSuccessAt: null,
        consecutiveFailures: 1,
        error: 'RELAY_UNAVAILABLE'
      },
      {
        checkedAt: 1_700_000_000_000,
        lastSuccessAt: null,
        consecutiveFailures: 2,
        error: 'RELAY_UNAVAILABLE'
      }
    ])
  })

  it('never turns a database read failure into an empty Relay snapshot', async () => {
    let requests = 0
    const origin = await relayFixture((_request, response) => {
      requests += 1
      response.writeHead(500)
      response.end()
    })

    await expect(
      reconcilePairingsOnce({
        relayOrigin: origin,
        serviceToken: 'database-failure-token-is-at-least-32-bytes',
        readProjection: () => {
          throw new Error('database unavailable')
        }
      })
    ).rejects.toThrow('database unavailable')
    expect(requests).toBe(0)
  })
})
