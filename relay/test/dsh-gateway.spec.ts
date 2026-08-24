import { createServer as createNetServer } from 'node:net'
import { request as httpRequest } from 'node:http'

import { afterEach, describe, expect, it } from 'vitest'
import WebSocket, { type RawData } from 'ws'

import {
  encodeDshTunnelBinary,
  encodeDshTunnelControl,
  parseDshTunnelBinary,
  parseDshTunnelControl,
  type DshTunnelBinaryFrame,
  type DshTunnelControl
} from '../src/protocol/dsh-tunnel-protocol.js'
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
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

class JsonClient {
  readonly queue: unknown[] = []
  readonly waiters: Array<(value: unknown) => void> = []

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const value = JSON.parse(data.toString()) as unknown
      const waiter = this.waiters.shift()
      if (waiter) waiter(value)
      else this.queue.push(value)
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<JsonClient> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new JsonClient(socket)
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<unknown> {
    const queued = this.queue.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve) => this.waiters.push(resolve))
  }
}

type TunnelFrame =
  | { binary: false; value: DshTunnelControl }
  | { binary: true; value: DshTunnelBinaryFrame }

class TunnelClient {
  readonly queue: TunnelFrame[] = []
  readonly waiters: Array<(value: TunnelFrame) => void> = []

  constructor(readonly socket: WebSocket) {
    socket.on('message', (data, binary) => {
      let frame: TunnelFrame
      if (binary) {
        const parsed = parseDshTunnelBinary(asBuffer(data))
        if (!parsed.ok) throw new Error(parsed.reason)
        frame = { binary: true, value: parsed.value }
      } else {
        const parsed = parseDshTunnelControl(asBuffer(data).toString('utf8'))
        if (!parsed.ok) throw new Error(parsed.reason)
        frame = { binary: false, value: parsed.value }
      }
      const waiter = this.waiters.shift()
      if (waiter) waiter(frame)
      else this.queue.push(frame)
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<TunnelClient> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new TunnelClient(socket)
  }

  send(message: DshTunnelControl): void {
    this.socket.send(encodeDshTunnelControl(message))
  }

  sendBinary(streamId: number, sequence: number, text: string): void {
    this.socket.send(encodeDshTunnelBinary({
      kind: 1,
      streamId,
      sequence,
      payload: Buffer.from(text)
    }))
  }

  next(): Promise<TunnelFrame> {
    const queued = this.queue.shift()
    if (queued) return Promise.resolve(queued)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  async nextControl(type?: DshTunnelControl['type']): Promise<DshTunnelControl> {
    for (;;) {
      const frame = await this.next()
      if (!frame.binary && (!type || frame.value.type === type)) return frame.value
    }
  }
}

function asBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (Array.isArray(data)) return Buffer.concat(data)
  throw new Error('unsupported payload')
}

async function bootstrap(input: { ticketTtlMs?: number } = {}) {
  const port = await unusedPort()
  const origin = `http://127.0.0.1:${port}`
  const dshOrigin = 'https://dsh.test.example'
  const server = createRelayServer({
    config: defaultRelayConfig({
      publicOrigin: origin,
      dshPublicOrigin: dshOrigin,
      allowInsecureLoopback: true,
      enableDevCreate: true,
      dshTicketTtlMs: input.ticketTtlMs ?? 30_000
    })
  })
  await server.listen(port)
  const roomResponse = await fetch(`${origin}/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  const room = await roomResponse.json() as { roomId: string; revokeToken: string }
  const mainUrl = `ws://127.0.0.1:${port}/v1/ws`
  const desktop = await JsonClient.connect(mainUrl)
  const phone = await JsonClient.connect(mainUrl)
  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  const desktopHello = await desktop.next() as {
    dshSeatToken: string
    relayCapabilities: { dshWebTunnel: { origin: string; protocol: number } }
  }
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
  const phoneHello = await phone.next() as Record<string, unknown>
  await desktop.next()
  const tunnel = await TunnelClient.connect(`ws://127.0.0.1:${port}/v1/dsh-tunnel`)
  tunnel.send({
    type: 'dsh-tunnel-hello',
    roomId: room.roomId,
    dshSeatToken: desktopHello.dshSeatToken,
    protocol: 1
  })
  tunnel.send({ type: 'ping' })
  await tunnel.nextControl('pong')
  desktop.send({
    v: 1,
    type: 'dsh-surface-state',
    surface: {
      id: 'dsh',
      kind: 'dsh-web',
      displayName: 'DeepSeek Harness',
      iconId: 'dsh',
      state: 'ready',
      generation: 7
    }
  })
  await phone.next()
  return { server, port, origin, dshOrigin, room, desktop, phone, tunnel, desktopHello, phoneHello }
}

async function issueTicket(phone: JsonClient, requestId = 'ticket-1') {
  phone.send({ v: 1, type: 'dsh-ticket-request', requestId })
  return await phone.next() as { type: string; requestId: string; url: string; expiresAt: number }
}

async function synchronizeRoom(input: {
  origin: string
  serviceToken: string
  roomId: string
  revision?: number
}): Promise<void> {
  const response = await hostRequest(input.origin, '/v1/system/rooms', {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${input.serviceToken}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      revision: input.revision ?? 1,
      rooms: [{
        roomId: input.roomId,
        revokeDigest: Buffer.alloc(32, 0x5a).toString('base64url')
      }]
    })
  })
  expect(response.status).toBe(200)
}

async function connectRestoredRoom(input: {
  port: number
  origin: string
  dshOrigin: string
  roomId: string
}) {
  const mainUrl = `ws://127.0.0.1:${input.port}/v1/ws`
  const desktop = await JsonClient.connect(mainUrl)
  const phone = await JsonClient.connect(mainUrl)
  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: input.roomId })
  const desktopHello = await desktop.next() as { dshSeatToken: string }
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: input.roomId })
  expect(await phone.next()).toMatchObject({ v: 1, type: 'hello-ok' })
  await desktop.next()
  const tunnel = await TunnelClient.connect(`ws://127.0.0.1:${input.port}/v1/dsh-tunnel`)
  tunnel.send({
    type: 'dsh-tunnel-hello',
    roomId: input.roomId,
    dshSeatToken: desktopHello.dshSeatToken,
    protocol: 1
  })
  tunnel.send({ type: 'ping' })
  await tunnel.nextControl('pong')
  desktop.send({
    v: 1,
    type: 'dsh-surface-state',
    surface: {
      id: 'dsh',
      kind: 'dsh-web',
      displayName: 'DeepSeek Harness',
      iconId: 'dsh',
      state: 'ready',
      generation: 1
    }
  })
  await phone.next()
  return { desktop, phone, tunnel }
}

function connectPath(url: string): string {
  return new URL(url).pathname
}

interface TestResponse {
  status: number
  headers: Headers
  text(): Promise<string>
  json(): Promise<unknown>
}

async function hostRequest(
  origin: string,
  path: string,
  options: { method?: string; headers?: Record<string, string>; body?: string } = {}
): Promise<TestResponse> {
  const url = new URL(path, origin)
  return await new Promise<TestResponse>((resolve, reject) => {
    const request = httpRequest(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      agent: false
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      response.once('error', reject)
      response.once('end', () => {
        const body = Buffer.concat(chunks)
        const headers = new Headers()
        for (const [name, value] of Object.entries(response.headers)) {
          if (value === undefined) continue
          for (const item of Array.isArray(value) ? value : [value]) headers.append(name, String(item))
        }
        resolve({
          status: response.statusCode ?? 0,
          headers,
          text: async () => body.toString('utf8'),
          json: async () => JSON.parse(body.toString('utf8')) as unknown
        })
      })
    })
    request.once('error', reject)
    if (options.body) request.write(options.body)
    request.end()
  })
}

function cookieFrom(response: Pick<TestResponse, 'headers'>): string {
  const setCookie = response.headers.get('set-cookie')
  if (!setCookie) throw new Error('missing cookie')
  return setCookie.split(';', 1)[0]!
}

async function within<T>(label: string, promise: Promise<T>, milliseconds = 1_000): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`timeout:${label}`)), milliseconds)
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

describe('D2 DSH gateway', () => {
  const running: RunningRelayServer[] = []
  const sockets: WebSocket[] = []

  afterEach(async () => {
    for (const socket of sockets.splice(0)) socket.terminate()
    await Promise.all(running.splice(0).map((server) => server.close()))
  })

  it('issues a one-use bound ticket and carries allowlisted HTTP without forwarding secrets', async () => {
    const state = await bootstrap()
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)

    expect(state.desktopHello.relayCapabilities).toEqual({
      dshWebTunnel: { origin: state.dshOrigin, protocol: 1 }
    })
    expect(state.desktopHello.dshSeatToken).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(state.phoneHello).not.toHaveProperty('dshSeatToken')

    const ticket = await issueTicket(state.phone)
    expect(ticket).toMatchObject({ type: 'dsh-ticket-ok', requestId: 'ticket-1' })
    expect(ticket.url.startsWith(`${state.dshOrigin}/_connect/`)).toBe(true)

    const connected = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: {
        host: new URL(state.dshOrigin).host,
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate'
      }
    })
    expect(connected.status).toBe(303)
    expect(connected.headers.get('location')).toBe('/')
    const setCookie = connected.headers.get('set-cookie')!
    expect(setCookie).toContain('__Host-hrack-dsh=')
    expect(setCookie).toContain('Secure')
    expect(setCookie).toContain('HttpOnly')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(setCookie).not.toContain('Domain=')

    const replay = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: { host: new URL(state.dshOrigin).host }
    })
    expect(replay.status).toBe(404)

    const bodyPromise = hostRequest(state.origin, '/', {
      headers: {
        host: new URL(state.dshOrigin).host,
        cookie: cookieFrom(connected),
        authorization: 'Bearer must-not-cross',
        'x-forwarded-for': 'must-not-cross',
        accept: 'text/html',
        'accept-encoding': 'gzip, br'
      }
    })
    const open = await state.tunnel.nextControl('http-open')
    expect(open).toMatchObject({ type: 'http-open', method: 'GET', path: '/' })
    if (open.type !== 'http-open') throw new Error('wrong control')
    expect(open.headers).toContainEqual(['accept', 'text/html'])
    expect(open.headers).toContainEqual(['accept-encoding', 'gzip, br'])
    expect(open.headers.some(([name]) => ['cookie', 'authorization', 'x-forwarded-for'].includes(name))).toBe(false)
    state.tunnel.send({
      type: 'http-head',
      streamId: open.streamId,
      status: 200,
      headers: [
        ['content-type', 'text/html; charset=utf-8'],
        ['set-cookie', 'dsh-local=forbidden'],
        ['server', 'loopback-secret']
      ]
    })
    state.tunnel.sendBinary(open.streamId, 0, '<main>real DSH</main>')
    state.tunnel.send({ type: 'http-end', streamId: open.streamId })
    const body = await bodyPromise
    expect(body.status).toBe(200)
    expect(await body.text()).toBe('<main>real DSH</main>')
    expect(body.headers.get('set-cookie')).toBeNull()
    expect(body.headers.get('server')).toBeNull()
    expect(body.headers.get('referrer-policy')).toBe('no-referrer')
    expect(body.headers.get('cache-control')).toBe('no-store')
  })

  it('streams POST bodies with credit and carries both event WebSocket routes', async () => {
    const state = await bootstrap()
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)
    const ticket = await issueTicket(state.phone)
    const connected = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: { host: new URL(state.dshOrigin).host }
    })
    const cookie = cookieFrom(connected)

    const postPromise = hostRequest(state.origin, '/api/session.list', {
      method: 'POST',
      headers: {
        host: new URL(state.dshOrigin).host,
        cookie,
        origin: state.dshOrigin,
        'content-type': 'application/json'
      },
      body: '{"from":"phone"}'
    })
    const open = await state.tunnel.nextControl('http-open')
    if (open.type !== 'http-open') throw new Error('wrong control')
    expect(open.headers).toContainEqual(['origin', state.dshOrigin])
    state.tunnel.send({ type: 'credit', streamId: open.streamId, bytes: 262_144 })
    const binary = await state.tunnel.next()
    expect(binary.binary).toBe(true)
    if (!binary.binary) throw new Error('missing body')
    expect(Buffer.from(binary.value.payload).toString()).toBe('{"from":"phone"}')
    expect(await state.tunnel.nextControl('http-end')).toMatchObject({ streamId: open.streamId })
    state.tunnel.send({
      type: 'http-head',
      streamId: open.streamId,
      status: 200,
      headers: [['content-type', 'application/json']]
    })
    state.tunnel.sendBinary(open.streamId, 0, '{"ok":true}')
    state.tunnel.send({ type: 'http-end', streamId: open.streamId })
    expect(await (await postPromise).json()).toEqual({ ok: true })

    for (const path of ['/api/events.mux', '/api/events.host']) {
      const socket = new WebSocket(`ws://127.0.0.1:${state.port}${path}`, {
        origin: state.dshOrigin,
        headers: { host: new URL(state.dshOrigin).host, cookie }
      })
      sockets.push(socket)
      await new Promise<void>((resolve, reject) => {
        socket.once('open', resolve)
        socket.once('error', reject)
      })
      const wsOpen = await state.tunnel.nextControl('ws-open')
      if (wsOpen.type !== 'ws-open') throw new Error('wrong ws control')
      expect(wsOpen.path).toBe(path)
      state.tunnel.send({ type: 'ws-open-ok', streamId: wsOpen.streamId })
      const message = new Promise<string>((resolve) => socket.once('message', (data) => resolve(data.toString())))
      state.tunnel.socket.send(encodeDshTunnelBinary({
        kind: 2,
        streamId: wsOpen.streamId,
        sequence: 0,
        payload: Buffer.from(`event:${path}`)
      }))
      expect(await message).toBe(`event:${path}`)
    }

    const metrics = state.server.metrics().dsh
    expect(metrics).toMatchObject({
      healthy: true,
      activeTunnels: 1,
      pendingTunnels: 0,
      activeWebSessions: 1,
      activeHttpStreams: 0,
      activeWebSocketStreams: 2,
      bufferedBytes: 0,
      errors: { buffer: 0, timeout: 0, protocol: 0, transport: 0, upstream: 0 }
    })
    expect(metrics.bytesPublicToDesktop).toBeGreaterThan(0)
    expect(metrics.bytesDesktopToPublic).toBeGreaterThan(0)
    expect(JSON.stringify(metrics)).not.toMatch(/room|cookie|ticket|path|body|secret/i)
  })

  it('restores a persistent room without reviving pre-restart DSH tickets or cookies', async () => {
    const port = await unusedPort()
    const origin = `http://127.0.0.1:${port}`
    const dshOrigin = 'https://dsh.restore.example'
    const serviceToken = 'dsh-restore-service-token-at-least-32-bytes'
    const roomId = Buffer.alloc(16, 0x42).toString('base64url')
    const config = defaultRelayConfig({
      publicOrigin: origin,
      dshPublicOrigin: dshOrigin,
      serviceToken,
      allowInsecureLoopback: true,
      enableDevCreate: false
    })
    const start = async (): Promise<RunningRelayServer> => {
      const server = createRelayServer({ config })
      await server.listen(port)
      await synchronizeRoom({ origin, serviceToken, roomId })
      return server
    }

    const first = await start()
    running.push(first)
    const firstSeats = await connectRestoredRoom({ port, origin, dshOrigin, roomId })
    sockets.push(firstSeats.desktop.socket, firstSeats.phone.socket, firstSeats.tunnel.socket)
    const oldTicket = await issueTicket(firstSeats.phone, 'old-ticket')
    const cookieTicket = await issueTicket(firstSeats.phone, 'old-cookie')
    const connected = await hostRequest(origin, connectPath(cookieTicket.url), {
      headers: { host: new URL(dshOrigin).host }
    })
    expect(connected.status).toBe(303)
    const oldCookie = cookieFrom(connected)

    await first.close()
    running.pop()

    const restarted = await start()
    running.push(restarted)
    const authority = new URL(dshOrigin).host
    expect((await hostRequest(origin, connectPath(oldTicket.url), {
      headers: { host: authority }
    })).status).toBe(404)
    expect((await hostRequest(origin, '/', {
      headers: { host: authority, cookie: oldCookie }
    })).status).toBe(401)

    const restoredSeats = await connectRestoredRoom({ port, origin, dshOrigin, roomId })
    sockets.push(restoredSeats.desktop.socket, restoredSeats.phone.socket, restoredSeats.tunnel.socket)
    const newTicket = await issueTicket(restoredSeats.phone, 'new-ticket')
    expect(connectPath(newTicket.url)).not.toBe(connectPath(oldTicket.url))
    expect((await hostRequest(origin, connectPath(newTicket.url), {
      headers: { host: authority }
    })).status).toBe(303)
  })

  it('normalizes an abnormal public WebSocket teardown before forwarding it to Desktop', async () => {
    const state = await bootstrap()
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)
    const ticket = await issueTicket(state.phone)
    const connected = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: { host: new URL(state.dshOrigin).host }
    })
    const socket = new WebSocket(`ws://127.0.0.1:${state.port}/api/events.host`, {
      origin: state.dshOrigin,
      headers: {
        host: new URL(state.dshOrigin).host,
        cookie: cookieFrom(connected)
      }
    })
    sockets.push(socket)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    const open = await state.tunnel.nextControl('ws-open')
    if (open.type !== 'ws-open') throw new Error('wrong ws control')
    state.tunnel.send({ type: 'ws-open-ok', streamId: open.streamId })

    socket.terminate()
    expect(await state.tunnel.nextControl('ws-close')).toMatchObject({
      streamId: open.streamId,
      code: 1001
    })
    state.tunnel.send({ type: 'ping' })
    expect(await within('pong-after-abnormal-close', state.tunnel.nextControl('pong'))).toEqual({
      type: 'pong'
    })
  })

  it('fails closed for anonymous routes, expired tickets, phone disconnect, generation change, and revoke', async () => {
    const state = await bootstrap({ ticketTtlMs: 20 })
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)
    const authority = new URL(state.dshOrigin).host

    expect((await hostRequest(state.origin, '/_healthz', { headers: { host: authority } })).status).toBe(200)
    expect((await hostRequest(state.origin, '/', { headers: { host: authority } })).status).toBe(401)
    expect((await hostRequest(state.origin, '/not-allowed', { headers: { host: authority } })).status).toBe(401)

    const expired = await issueTicket(state.phone, 'expires')
    await new Promise((resolve) => setTimeout(resolve, 30))
    expect((await hostRequest(state.origin, connectPath(expired.url), {
      headers: { host: authority }
    })).status).toBe(404)

    const valid = await issueTicket(state.phone, 'valid')
    const connected = await hostRequest(state.origin, connectPath(valid.url), {
      headers: { host: authority }
    })
    const cookie = cookieFrom(connected)
    state.desktop.send({
      v: 1,
      type: 'dsh-surface-state',
      surface: {
        id: 'dsh', kind: 'dsh-web', displayName: 'DeepSeek Harness', iconId: 'dsh',
        state: 'ready', generation: 8
      }
    })
    await state.phone.next()
    expect((await hostRequest(state.origin, '/', { headers: { host: authority, cookie } })).status).toBe(401)

    const freshTicket = await issueTicket(state.phone, 'fresh')
    const fresh = await hostRequest(state.origin, connectPath(freshTicket.url), {
      headers: { host: authority }
    })
    const freshCookie = cookieFrom(fresh)
    state.phone.socket.terminate()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect((await hostRequest(state.origin, '/', { headers: { host: authority, cookie: freshCookie } })).status).toBe(401)

    const revoked = await fetch(`${state.origin}/v1/rooms/${state.room.roomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${state.room.revokeToken}` }
    })
    expect(revoked.status).toBe(204)
    await new Promise<void>((resolve) => state.tunnel.socket.once('close', () => resolve()))
  })

  it('keeps the tunnel alive when teardown races with late frames from a completed stream', async () => {
    const state = await bootstrap()
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)
    const authority = new URL(state.dshOrigin).host
    const ticket = await issueTicket(state.phone)
    const connected = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: { host: authority }
    })
    const request = hostRequest(state.origin, '/', {
      headers: { host: authority, cookie: cookieFrom(connected) }
    }).catch(() => null)
    const open = await state.tunnel.nextControl('http-open')
    if (open.type !== 'http-open') throw new Error('wrong control')

    state.phone.socket.terminate()
    expect(await state.tunnel.nextControl('http-abort')).toMatchObject({
      streamId: open.streamId,
      reason: 'session-closed'
    })

    // These frames may already be queued on Desktop when phone teardown wins.
    state.tunnel.send({
      type: 'http-head',
      streamId: open.streamId,
      status: 200,
      headers: [['content-type', 'text/plain']]
    })
    state.tunnel.sendBinary(open.streamId, 0, 'late')
    state.tunnel.send({ type: 'http-end', streamId: open.streamId })
    state.tunnel.send({ type: 'ping' })
    expect(await within('pong-after-late-frames', state.tunnel.nextControl('pong'))).toEqual({
      type: 'pong'
    })
    expect(state.tunnel.socket.readyState).toBe(WebSocket.OPEN)
    await request
  })

  it('enforces the public route/method/body allowlist and closes an invalid tunnel state transition', async () => {
    const state = await bootstrap()
    running.push(state.server)
    sockets.push(state.desktop.socket, state.phone.socket, state.tunnel.socket)
    const authority = new URL(state.dshOrigin).host
    const ticket = await issueTicket(state.phone)
    const connected = await hostRequest(state.origin, connectPath(ticket.url), {
      headers: { host: authority }
    })
    const cookie = cookieFrom(connected)

    expect((await within('get-api', hostRequest(state.origin, '/api/session.list', {
      headers: { host: authority, cookie }
    }))).status).toBe(404)
    expect((await within('post-asset', hostRequest(state.origin, '/assets/app.js', {
      method: 'POST', headers: { host: authority, cookie }
    }))).status).toBe(404)
    expect((await within('trace-api', hostRequest(state.origin, '/api/session.list', {
      method: 'TRACE', headers: { host: authority, cookie }
    }))).status).toBe(405)
    expect((await within('traversal', hostRequest(state.origin, '/%252e%252e/secret', {
      headers: { host: authority, cookie }
    }))).status).toBe(400)
    expect((await within('large-body', hostRequest(state.origin, '/api/session.list', {
      method: 'POST',
      headers: {
        host: authority,
        cookie,
        'content-length': String(16 * 1024 * 1024 + 1)
      }
    }))).status).toBe(413)

    const request = hostRequest(state.origin, '/', {
      headers: { host: authority, cookie }
    }).catch(() => null)
    const first = await within('http-open', Promise.race([
      state.tunnel.nextControl('http-open').then((open) => ({ kind: 'open' as const, open })),
      request.then((response) => ({ kind: 'response' as const, response }))
    ]))
    if (first.kind === 'response') throw new Error(`unexpected-root-response:${first.response?.status ?? 'closed'}`)
    const open = first.open
    if (open.type !== 'http-open') throw new Error('wrong control')
    const closed = new Promise<number>((resolve) => state.tunnel.socket.once('close', (code) => resolve(code)))
    state.tunnel.sendBinary(open.streamId, 0, 'body-before-head')
    expect(await within('protocol-close', closed)).toBe(1002)
    expect(state.server.metrics().dsh.errors.protocol).toBe(1)
    await request
  })
})
