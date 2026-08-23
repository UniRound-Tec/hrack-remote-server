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
