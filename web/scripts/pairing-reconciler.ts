import { createServer } from 'node:http'
import { closeDb } from '../src/lib/db'
import {
  loadPairingReconcilerConfig,
  runPairingReconciler,
  type PairingReconcilerHealth
} from '../src/lib/pairing/reconciler'
import { readPairingProjection } from '../src/lib/pairing/projection'

function healthPort(): number {
  const value = Number(process.env.RECONCILER_HEALTH_PORT ?? '3001')
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    throw new Error('RECONCILER_HEALTH_PORT must be a valid port')
  }
  return value
}

async function main(): Promise<void> {
  const config = loadPairingReconcilerConfig()
  const staleAfterMs = Math.max(30_000, config.intervalMs * 3)
  const healthByNode = new Map<string, PairingReconcilerHealth>(
    config.nodes.map((node) => [
      node.id,
      {
        checkedAt: Date.now(),
        lastSuccessAt: null,
        consecutiveFailures: 0
      }
    ])
  )
  const healthServer = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/healthz') {
      response.writeHead(404).end()
      return
    }
    const nodeHealth = config.nodes.map((node) => ({
      nodeId: node.id,
      ...(healthByNode.get(node.id) ?? {
        checkedAt: Date.now(),
        lastSuccessAt: null,
        consecutiveFailures: 1,
        error: 'NO_HEALTH_STATE'
      })
    }))
    const healthy = nodeHealth.every(
      (health) =>
        health.lastSuccessAt !== null &&
        Date.now() - health.lastSuccessAt <= staleAfterMs
    )
    response.writeHead(healthy ? 200 : 503, {
      'cache-control': 'no-store',
      'content-type': 'application/json'
    })
    response.end(
      JSON.stringify({
        ok: healthy,
        nodes: nodeHealth
      })
    )
  })
  await new Promise<void>((resolve, reject) => {
    healthServer.once('error', reject)
    healthServer.listen(healthPort(), '0.0.0.0', resolve)
  })
  const controller = new AbortController()
  const stop = (): void => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  try {
    await Promise.all(
      config.nodes.map((node) =>
        runPairingReconciler({
          relayOrigin: node.relayInternalOrigin,
          serviceToken: node.serviceToken,
          intervalMs: config.intervalMs,
          signal: controller.signal,
          readProjection: () => readPairingProjection(node.id),
          healthReporter: (nextHealth) => {
            healthByNode.set(node.id, nextHealth)
          },
          logger: (record) =>
            process.stdout.write(
              `${JSON.stringify({ ...record, nodeId: node.id })}\n`
            )
        })
      )
    )
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await new Promise<void>((resolve, reject) => {
      healthServer.close((error) => (error ? reject(error) : resolve()))
    })
    closeDb()
  }
}

void main().catch(() => {
  process.stderr.write(
    `${JSON.stringify({
      event: 'pairing-reconciler-fatal',
      result: 'failed',
      error: 'STARTUP_ERROR'
    })}\n`
  )
  process.exitCode = 1
})
