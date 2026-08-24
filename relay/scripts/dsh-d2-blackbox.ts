import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { request as httpRequest } from 'node:http'
import { createServer as createNetServer } from 'node:net'

import WebSocket, { type RawData } from 'ws'

import {
  DSH_TUNNEL_LIMITS,
  encodeDshTunnelBinary,
  encodeDshTunnelControl,
  parseDshTunnelControl,
  type DshTunnelControl
} from '../src/protocol/dsh-tunnel-protocol.js'

async function unusedPort(): Promise<number> {
  const server = createNetServer()
  await new Promise<void>((resolve, reject) => server.listen(0, '127.0.0.1', resolve).once('error', reject))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return address.port
}

function asBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (Array.isArray(data)) return Buffer.concat(data)
  throw new Error('unsupported payload')
}

class JsonSocket {
  readonly queue: unknown[] = []
  readonly waiters: Array<(value: unknown) => void> = []

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const value = JSON.parse(data.toString()) as unknown
      const waiter = this.waiters.shift()
      if (waiter) waiter(value)
      else this.queue.push(value)
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<JsonSocket> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new JsonSocket(socket)
  }

  send(value: unknown): void {
    this.socket.send(JSON.stringify(value))
  }

  next(): Promise<unknown> {
    const value = this.queue.shift()
    if (value !== undefined) return Promise.resolve(value)
    return new Promise((resolve) => this.waiters.push(resolve))
  }
}

class TunnelSocket {
  readonly queue: DshTunnelControl[] = []
  readonly waiters: Array<(value: DshTunnelControl) => void> = []

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data, binary) => {
      if (binary) throw new Error('blackbox fixture received unexpected request binary')
      const parsed = parseDshTunnelControl(asBuffer(data).toString('utf8'))
      if (!parsed.ok) throw new Error(parsed.reason)
      const waiter = this.waiters.shift()
      if (waiter) waiter(parsed.value)
      else this.queue.push(parsed.value)
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<TunnelSocket> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new TunnelSocket(socket)
  }

  send(value: DshTunnelControl): void {
    this.socket.send(encodeDshTunnelControl(value))
  }

  next(): Promise<DshTunnelControl> {
    const value = this.queue.shift()
    if (value) return Promise.resolve(value)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  async nextType<T extends DshTunnelControl['type']>(type: T): Promise<Extract<DshTunnelControl, { type: T }>> {
    for (;;) {
      const value = await this.next()
      if (value.type === type) return value as Extract<DshTunnelControl, { type: T }>
    }
  }
}

interface HttpResult {
  status: number
  headers: Headers
  body: Buffer
}

function hostRequest(
  origin: string,
  path: string,
  authority: string,
  headers: Record<string, string> = {}
): Promise<HttpResult> {
  return new Promise((resolve, reject) => {
    const request = httpRequest(new URL(path, origin), {
      headers: { ...headers, host: authority }
    }, (response) => {
      const chunks: Buffer[] = []
      response.on('data', (chunk: Buffer) => chunks.push(Buffer.from(chunk)))
      response.once('error', reject)
      response.once('end', () => {
        const outputHeaders = new Headers()
        for (const [name, value] of Object.entries(response.headers)) {
          if (value === undefined) continue
          for (const item of Array.isArray(value) ? value : [value]) outputHeaders.append(name, String(item))
        }
        resolve({ status: response.statusCode ?? 0, headers: outputHeaders, body: Buffer.concat(chunks) })
      })
    })
    request.once('error', reject)
    request.end()
  })
}

async function waitReady(child: ChildProcessWithoutNullStreams, output: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('dist relay readiness timeout')), 10_000)
    const onData = (data: Buffer): void => {
      const text = data.toString('utf8')
      output.push(text)
      if (text.includes('"event":"server-ready"')) {
        clearTimeout(timer)
        child.stdout.off('data', onData)
        resolve()
      }
    }
    child.stdout.on('data', onData)
    child.once('exit', (code) => {
      clearTimeout(timer)
      reject(new Error(`dist relay exited before ready: ${code}`))
    })
  })
  child.stdout.on('data', (data: Buffer) => output.push(data.toString('utf8')))
  child.stderr.on('data', (data: Buffer) => output.push(data.toString('utf8')))
}

const port = await unusedPort()
const origin = `http://127.0.0.1:${port}`
const dshOrigin = 'https://dsh.blackbox.invalid'
const authority = new URL(dshOrigin).host
const logs: string[] = []
const sockets: WebSocket[] = []
const child = spawn(process.execPath, ['dist/server/cli.js'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PUBLIC_ORIGIN: origin,
    DSH_PUBLIC_ORIGIN: dshOrigin,
    ALLOW_INSECURE_LOOPBACK: '1',
    ENABLE_DEV_CREATE: '1',
    HOST: '127.0.0.1',
    PORT: String(port),
    METRICS_INTERVAL_MS: '60000'
  },
  stdio: ['pipe', 'pipe', 'pipe']
})

try {
  await waitReady(child, logs)
  const roomResponse = await fetch(`${origin}/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  assert.equal(roomResponse.status, 201)
  const room = await roomResponse.json() as { roomId: string; revokeToken: string }
  const desktop = await JsonSocket.connect(`ws://127.0.0.1:${port}/v1/ws`)
  const phone = await JsonSocket.connect(`ws://127.0.0.1:${port}/v1/ws`)
  sockets.push(desktop.socket, phone.socket)
  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  const desktopHello = await desktop.next() as {
    dshSeatToken: string
    relayCapabilities: { dshWebTunnel: { origin: string; protocol: number } }
  }
  assert.equal(desktopHello.relayCapabilities.dshWebTunnel.origin, dshOrigin)
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
  await phone.next()
  await desktop.next()

  const tunnel = await TunnelSocket.connect(`ws://127.0.0.1:${port}/v1/dsh-tunnel`)
  sockets.push(tunnel.socket)
  tunnel.send({
    type: 'dsh-tunnel-hello',
    roomId: room.roomId,
    dshSeatToken: desktopHello.dshSeatToken,
    protocol: 1
  })
  tunnel.send({ type: 'ping' })
  await tunnel.nextType('pong')
  desktop.send({
    v: 1,
    type: 'dsh-surface-state',
    surface: {
      id: 'dsh', kind: 'dsh-web', displayName: 'DeepSeek Harness', iconId: 'dsh',
      state: 'ready', generation: 1
    }
  })
  await phone.next()
  phone.send({ v: 1, type: 'dsh-ticket-request', requestId: 'blackbox-ticket' })
  const ticket = await phone.next() as { type: string; url: string }
  assert.equal(ticket.type, 'dsh-ticket-ok')
  const connectPath = new URL(ticket.url).pathname
  const connected = await hostRequest(origin, connectPath, authority, {
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate'
  })
  assert.equal(connected.status, 303)
  const cookie = connected.headers.get('set-cookie')?.split(';', 1)[0]
  assert.ok(cookie)
  assert.equal((await hostRequest(origin, connectPath, authority)).status, 404)
  assert.equal((await hostRequest(origin, '/_healthz', authority)).status, 200)

  const publicResponse = hostRequest(origin, '/', authority, { cookie })
  const open = await tunnel.nextType('http-open')
  assert.equal(open.path, '/')
  tunnel.send({
    type: 'http-head',
    streamId: open.streamId,
    status: 200,
    headers: [['content-type', 'text/html; charset=utf-8']]
  })
  const expected = Buffer.alloc(4_541_867)
  for (let index = 0; index < expected.byteLength; index += 1) expected[index] = index % 251
  let offset = 0
  let sequence = 0
  while (offset < expected.byteLength) {
    const length = Math.min(DSH_TUNNEL_LIMITS.framePayloadBytes, expected.byteLength - offset)
    tunnel.socket.send(encodeDshTunnelBinary({
      kind: 1,
      streamId: open.streamId,
      sequence: sequence++,
      payload: expected.subarray(offset, offset + length)
    }))
    offset += length
    await tunnel.nextType('credit')
  }
  tunnel.send({ type: 'http-end', streamId: open.streamId })
  const received = await publicResponse
  assert.equal(received.status, 200)
  assert.equal(received.body.byteLength, expected.byteLength)
  assert.equal(createHash('sha256').update(received.body).digest('hex'), createHash('sha256').update(expected).digest('hex'))

  for (const path of ['/api/events.mux', '/api/events.host']) {
    const publicSocket = new WebSocket(`ws://127.0.0.1:${port}${path}`, {
      origin: dshOrigin,
      headers: { host: authority, cookie }
    })
    sockets.push(publicSocket)
    await new Promise<void>((resolve, reject) => {
      publicSocket.once('open', resolve)
      publicSocket.once('error', reject)
    })
    const wsOpen = await tunnel.nextType('ws-open')
    assert.equal(wsOpen.path, path)
    tunnel.send({ type: 'ws-open-ok', streamId: wsOpen.streamId })
    const message = new Promise<string>((resolve) => publicSocket.once('message', (data) => resolve(data.toString())))
    tunnel.socket.send(encodeDshTunnelBinary({
      kind: 2,
      streamId: wsOpen.streamId,
      sequence: 0,
      payload: Buffer.from(path)
    }))
    assert.equal(await message, path)
  }

  const revoked = await fetch(`${origin}/v1/rooms/${room.roomId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${room.revokeToken}` }
  })
  assert.equal(revoked.status, 204)
  await new Promise<void>((resolve) => tunnel.socket.once('close', () => resolve()))
  const logText = logs.join('')
  for (const secret of [room.roomId, room.revokeToken, desktopHello.dshSeatToken, connectPath, cookie]) {
    assert.equal(logText.includes(secret), false)
  }
  process.stdout.write(
    `[dsh-d2] process=dist httpBytes=${received.body.byteLength} websocket=2 ticket=one-use revoke=closed logs=clean\n`
  )
} finally {
  for (const socket of sockets) socket.terminate()
  if (child.exitCode === null) {
    child.kill('SIGTERM')
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 2_000)
      child.once('exit', () => {
        clearTimeout(timer)
        resolve()
      })
    })
  }
}
