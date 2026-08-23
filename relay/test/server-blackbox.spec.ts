import { createServer as createNetServer } from 'node:net'
import { afterEach, describe, expect, it } from 'vitest'
import WebSocket from 'ws'

import { defaultRelayConfig } from '../src/relay/relay-config.js'
import {
  createRelayServer,
  type RunningRelayServer
} from '../src/transport/http-server.js'

async function unusedPort(): Promise<number> {
  const server = createNetServer()
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

class RealClient {
  readonly messages: unknown[] = []
  readonly waiters: Array<(message: unknown) => void> = []

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as unknown
      const waiter = this.waiters.shift()
      if (waiter) waiter(message)
      else this.messages.push(message)
    })
    socket.on('error', () => {})
  }

  static async connect(
    url: string,
    options: WebSocket.ClientOptions = {}
  ): Promise<RealClient> {
    const socket = new WebSocket(url, options)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new RealClient(socket)
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<unknown> {
    const queued = this.messages.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  async expectSilence(milliseconds = 75): Promise<void> {
    const marker = Symbol('timeout')
    const result = await Promise.race([
      this.next(),
      new Promise<symbol>((resolve) => setTimeout(() => resolve(marker), milliseconds))
    ])
    expect(result).toBe(marker)
    if (result === marker) this.waiters.shift()
  }

  closed(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return Promise.resolve()
    return new Promise((resolve) => this.socket.once('close', () => resolve()))
  }

  closeCode(): Promise<number> {
    return new Promise((resolve) =>
      this.socket.once('close', (code) => resolve(code))
    )
  }

  terminate(): void {
    this.socket.terminate()
  }
}

describe('real HTTP and WebSocket server', () => {
  const running: RunningRelayServer[] = []

  afterEach(async () => {
    await Promise.all(running.splice(0).map((server) => server.close()))
  })

  it('creates a room only with the configured service credential', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'service-token-that-is-at-least-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    const anonymous = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    expect(anonymous.status).toBe(401)

    const wrongCredential = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-service-token',
        'content-type': 'application/json'
      },
      body: '{}'
    })
    expect(wrongCredential.status).toBe(401)

    const initialSync = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ revision: 0, rooms: [] })
    })
    expect(initialSync.status).toBe(200)

    const response = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json',
        origin
      },
      body: '{}'
    })
    const body = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(201)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(Object.keys(body).sort()).toEqual(['joinUrl', 'revokeToken', 'roomId'])
    expect(Buffer.from(String(body.roomId), 'base64url')).toHaveLength(16)
    expect(Buffer.from(String(body.revokeToken), 'base64url')).toHaveLength(32)
    expect(body.joinUrl).toBe(`${origin}/${body.roomId}`)
  })

  it('hides the generation and demo pages when development creation is disabled', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    expect((await fetch(`${origin}/`)).status).toBe(404)
    expect((await fetch(`${origin}/demo`)).status).toBe(404)
  })

  it('reports boot-specific relay state only to the service credential', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'system-state-service-token-is-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    expect((await fetch(`${origin}/v1/system/state`)).status).toBe(401)

    const response = await fetch(`${origin}/v1/system/state`, {
      headers: { authorization: `Bearer ${serviceToken}` }
    })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({
      instanceId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      synchronized: false,
      appliedRevision: -1
    })

    const createBeforeSync = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      body: '{}'
    })
    expect(createBeforeSync.status).toBe(503)
    expect(createBeforeSync.headers.get('retry-after')).toBe('5')
  })

  it('keeps pairing pages and sockets unavailable until the first synchronization', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'fail-closed-service-token-is-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    const page = await fetch(`${origin}/MDEyMzQ1Njc4OWFiY2RlZg`)
    expect(page.status).toBe(503)
    expect(page.headers.get('retry-after')).toBe('5')

    const socket = new WebSocket(`ws://127.0.0.1:${port}/v1/ws`)
    const closeCode = await new Promise<number>((resolve, reject) => {
      socket.once('close', (code) => resolve(code))
      socket.once('error', reject)
    })
    expect(closeCode).toBe(1013)
  })

  it('accepts an authenticated empty desired state and opens service creation', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'desired-state-service-token-is-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    const unauthorized = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 0, rooms: [] })
    })
    expect(unauthorized.status).toBe(401)

    const reconciled = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({ revision: 0, rooms: [] })
    })
    expect(reconciled.status).toBe(200)
    expect(await reconciled.json()).toEqual({
      instanceId: expect.stringMatching(/^[A-Za-z0-9_-]{22}$/),
      appliedRevision: 0,
      activeRoomCount: 0
    })

    const created = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      body: '{}'
    })
    expect(created.status).toBe(201)
  })

  it('restores a desired room that accepts its original pairing credential', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'restore-room-service-token-is-32-bytes'
    const roomId = 'MDEyMzQ1Njc4OWFiY2RlZg'
    const revokeToken = 'restore-token-fixed-32-byte-value!!'
    const revokeDigest = 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')

    const reconciled = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${serviceToken}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        revision: 7,
        rooms: [{ roomId, revokeDigest }]
      })
    })
    expect(reconciled.status).toBe(200)
    expect(await reconciled.json()).toMatchObject({
      appliedRevision: 7,
      activeRoomCount: 1
    })

    expect((await fetch(`${origin}/v1/rooms/${roomId}`)).status).toBe(401)
    const availability = await fetch(`${origin}/v1/rooms/${roomId}`, {
      headers: { authorization: `Bearer ${serviceToken}` }
    })
    expect(availability.status).toBe(200)
    expect(await availability.json()).toEqual({ exists: true })
    expect(
      (
        await fetch(`${origin}/v1/rooms/AAAAAAAAAAAAAAAAAAAAAA`, {
          headers: { authorization: `Bearer ${serviceToken}` }
        })
      ).status
    ).toBe(404)

    const desktop = await RealClient.connect(`ws://127.0.0.1:${port}/v1/ws`)
    desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId })
    expect(await desktop.next()).toMatchObject({ v: 1, type: 'hello-ok' })

    const revoked = await fetch(`${origin}/v1/rooms/${roomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${revokeToken}` }
    })
    expect(revoked.status).toBe(204)
    expect(await desktop.next()).toEqual({ v: 1, type: 'revoked' })
  })

  it('rejects stale and conflicting snapshots without changing the desired room', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'revision-check-service-token-is-32-bytes'
    const room = {
      roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
      revokeDigest: 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
    }
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const headers = {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json'
    }

    expect(
      (
        await fetch(`${origin}/v1/system/rooms`, {
          method: 'PUT',
          headers,
          body: JSON.stringify({ revision: 8, rooms: [room] })
        })
      ).status
    ).toBe(200)

    const stale = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ revision: 7, rooms: [] })
    })
    expect(stale.status).toBe(409)
    expect(await stale.json()).toEqual({ error: 'STALE_REVISION' })

    const conflict = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ revision: 8, rooms: [] })
    })
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'REVISION_CONFLICT' })

    const idempotent = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ revision: 8, rooms: [room] })
    })
    expect(idempotent.status).toBe(200)

    const desktop = await RealClient.connect(`ws://127.0.0.1:${port}/v1/ws`)
    desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
    expect(await desktop.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    desktop.terminate()
  })

  it('rejects an over-capacity desired state without declaring synchronization', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'capacity-check-service-token-is-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken,
        maxRooms: 1
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const headers = {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json'
    }

    const response = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        revision: 1,
        rooms: [
          {
            roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
            revokeDigest: 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
          },
          {
            roomId: 'ZmVkY2JhOTg3NjU0MzIxMA',
            revokeDigest: 'Hf3CevTyKApVm8q5vbehn8HEGpIbXv57gpLOYEbpGzw'
          }
        ]
      })
    })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ error: 'CAPACITY' })

    const state = await fetch(`${origin}/v1/system/state`, { headers })
    expect(await state.json()).toMatchObject({
      synchronized: false,
      appliedRevision: -1
    })
  })

  it('rejects unknown desired-state fields without partially synchronizing', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'invalid-state-service-token-is-32-bytes'
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const headers = {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json'
    }

    const response = await fetch(`${origin}/v1/system/rooms`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ revision: 1, rooms: [], unexpected: true })
    })
    expect(response.status).toBe(400)

    const state = await fetch(`${origin}/v1/system/state`, { headers })
    expect(await state.json()).toMatchObject({
      synchronized: false,
      appliedRevision: -1
    })
  })

  it('applies snapshots atomically while preserving unchanged live rooms', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const serviceToken = 'atomic-state-service-token-is-32-bytes'
    const firstRoom = {
      roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
      revokeDigest: 'wDndF3Q4aUcFtFV_Inz_HDGAIPBhhZjh-0nhwu1KHxs'
    }
    const secondRoom = {
      roomId: 'ZmVkY2JhOTg3NjU0MzIxMA',
      revokeDigest: 'Hf3CevTyKApVm8q5vbehn8HEGpIbXv57gpLOYEbpGzw'
    }
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        serviceToken
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const headers = {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json'
    }
    const reconcile = (revision: number, rooms: typeof firstRoom[]) =>
      fetch(`${origin}/v1/system/rooms`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ revision, rooms })
      })

    expect((await reconcile(1, [firstRoom, secondRoom])).status).toBe(200)
    const first = await RealClient.connect(`ws://127.0.0.1:${port}/v1/ws`)
    const second = await RealClient.connect(`ws://127.0.0.1:${port}/v1/ws`)
    first.send({ v: 1, type: 'hello', role: 'desktop', roomId: firstRoom.roomId })
    second.send({ v: 1, type: 'hello', role: 'desktop', roomId: secondRoom.roomId })
    expect(await first.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    expect(await second.next()).toMatchObject({ v: 1, type: 'hello-ok' })

    const conflict = await reconcile(2, [
      firstRoom,
      {
        ...secondRoom,
        revokeDigest: 'eN8Vqt6b5GcmrW0b8NAfzxdYWxYBnqx1j_os3Of5p4g'
      }
    ])
    expect(conflict.status).toBe(409)
    expect(await conflict.json()).toEqual({ error: 'ROOM_CREDENTIAL_CONFLICT' })

    first.send({ v: 1, type: 'hello', role: 'desktop', roomId: firstRoom.roomId })
    second.send({ v: 1, type: 'hello', role: 'desktop', roomId: secondRoom.roomId })
    expect(await first.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    expect(await second.next()).toMatchObject({ v: 1, type: 'hello-ok' })

    expect((await reconcile(2, [secondRoom])).status).toBe(200)
    expect(await first.next()).toEqual({ v: 1, type: 'revoked' })
    second.send({ v: 1, type: 'hello', role: 'desktop', roomId: secondRoom.roomId })
    expect(await second.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    second.terminate()
  })

  it('pairs real WS clients, preserves direction, prevents stealing, and drains revoke', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        enableDevCreate: true
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const createResponse = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    const room = (await createResponse.json()) as {
      roomId: string
      revokeToken: string
    }
    const wsUrl = `ws://127.0.0.1:${port}/v1/ws`
    const desktop = await RealClient.connect(wsUrl)
    const phone = await RealClient.connect(wsUrl)
    const intruder = await RealClient.connect(wsUrl)

    desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
    expect(await desktop.next()).toEqual({
      v: 1,
      type: 'hello-ok',
      peer: { desktop: true, phone: false }
    })
    phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
    expect(await phone.next()).toEqual({
      v: 1,
      type: 'hello-ok',
      peer: { desktop: true, phone: true }
    })
    expect(await desktop.next()).toEqual({ v: 1, type: 'peer-join', role: 'phone' })

    intruder.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
    expect(await intruder.next()).toEqual({ v: 1, type: 'occupied' })

    const snapshot = { v: 1, type: 'sessions-snapshot', sessions: [] }
    desktop.send(snapshot)
    expect(await phone.next()).toEqual(snapshot)
    phone.send({ v: 1, type: 'revoked' })
    await desktop.expectSilence()
    desktop.send(snapshot)
    expect(await phone.next()).toEqual(snapshot)

    const wrong = await fetch(`${origin}/v1/rooms/${room.roomId}`, {
      method: 'DELETE',
      headers: { authorization: 'Bearer wrong' }
    })
    expect(wrong.status).toBe(404)

    const desktopClosed = desktop.closed()
    const phoneClosed = phone.closed()
    const revoked = await fetch(`${origin}/v1/rooms/${room.roomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${room.revokeToken}` }
    })
    expect(revoked.status).toBe(204)
    expect(await desktop.next()).toEqual({ v: 1, type: 'revoked' })
    expect(await phone.next()).toEqual({ v: 1, type: 'revoked' })
    await Promise.all([desktopClosed, phoneClosed])

    intruder.terminate()
  })

  it('keeps a subpath consistent and invalidates rooms after a real process-state restart', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const config = defaultRelayConfig({
      publicOrigin: origin,
      basePath: '/remote',
      allowInsecureLoopback: true,
      enableDevCreate: true
    })
    const first = createRelayServer({ config })
    running.push(first)
    await first.listen(port, '127.0.0.1')
    const response = await fetch(`${origin}/remote/v1/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    const room = (await response.json()) as { roomId: string; joinUrl: string }
    expect(room.joinUrl).toBe(`${origin}/remote/${room.roomId}`)

    const firstClient = await RealClient.connect(`ws://127.0.0.1:${port}/remote/v1/ws`)
    firstClient.send({
      v: 1,
      type: 'hello',
      role: 'desktop',
      roomId: room.roomId
    })
    expect(await firstClient.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    firstClient.terminate()
    await first.close()
    running.pop()

    const restarted = createRelayServer({ config })
    running.push(restarted)
    await restarted.listen(port, '127.0.0.1')
    const afterRestart = await RealClient.connect(
      `ws://127.0.0.1:${port}/remote/v1/ws`
    )
    afterRestart.send({
      v: 1,
      type: 'hello',
      role: 'desktop',
      roomId: room.roomId
    })
    expect(await afterRestart.next()).toEqual({ v: 1, type: 'bad-key' })
    await afterRestart.closed()
  })

  it('enforces transport size, text-only, hello deadline, and heartbeat on real sockets', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        enableDevCreate: true,
        maxFrameBytes: 256,
        helloDeadlineMs: 40,
        pingIntervalMs: 40,
        pongTimeoutMs: 30
      })
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const response = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    const room = (await response.json()) as { roomId: string }
    const wsUrl = `ws://127.0.0.1:${port}/v1/ws`

    const slow = await RealClient.connect(wsUrl)
    expect(await slow.closeCode()).toBe(1008)

    const binary = await RealClient.connect(wsUrl)
    const binaryClosed = binary.closeCode()
    binary.socket.send(Buffer.from([1, 2, 3]))
    expect(await binaryClosed).toBe(1003)

    const oversized = await RealClient.connect(wsUrl)
    const oversizedClosed = oversized.closeCode()
    oversized.socket.send('x'.repeat(257))
    expect(await oversizedClosed).toBe(1009)

    const noPong = await RealClient.connect(wsUrl, { autoPong: false })
    noPong.send({
      v: 1,
      type: 'hello',
      role: 'desktop',
      roomId: room.roomId
    })
    expect(await noPong.next()).toMatchObject({ v: 1, type: 'hello-ok' })
    await noPong.closed()
  })

  it('never writes room secrets, authorization, or PTY content to application logs', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const records: unknown[] = []
    const server = createRelayServer({
      config: defaultRelayConfig({
        publicOrigin: origin,
        allowInsecureLoopback: true,
        enableDevCreate: true
      }),
      logSecret: new Uint8Array(32).fill(42),
      logger: (record) => records.push(record)
    })
    running.push(server)
    await server.listen(port, '127.0.0.1')
    const response = await fetch(`${origin}/v1/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    })
    const room = (await response.json()) as {
      roomId: string
      joinUrl: string
      revokeToken: string
    }
    const wsUrl = `ws://127.0.0.1:${port}/v1/ws`
    const desktop = await RealClient.connect(wsUrl)
    const phone = await RealClient.connect(wsUrl)
    desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
    await desktop.next()
    phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
    await phone.next()
    await desktop.next()

    const ptyText = 'super-secret-terminal-output'
    desktop.send({
      v: 1,
      type: 'pty-out',
      sessionId: 'session-secret',
      data: Buffer.from(ptyText).toString('base64'),
      byteLength: Buffer.byteLength(ptyText)
    })
    await phone.next()
    await fetch(`${origin}/v1/rooms/${room.roomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${room.revokeToken}` }
    })
    const output = JSON.stringify(records)

    expect(output).not.toContain(room.roomId)
    expect(output).not.toContain(room.joinUrl)
    expect(output).not.toContain(room.revokeToken)
    expect(output).not.toContain(ptyText)
    expect(output).not.toContain('session-secret')
    expect(output).not.toContain('Authorization')
  })
})
