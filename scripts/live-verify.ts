import { spawn, type ChildProcess } from 'node:child_process'
import { createServer as createNetServer } from 'node:net'

import WebSocket from 'ws'

async function unusedPort(): Promise<number> {
  const socket = createNetServer()
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  await new Promise<void>((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

interface ChildHandle {
  child: ChildProcess
  output: string[]
  errors: string[]
}

function startServer(port: number): ChildHandle {
  const child = spawn(process.execPath, ['dist/server/cli.js'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PUBLIC_ORIGIN: `http://127.0.0.1:${port}`,
      BASE_PATH: '/remote',
      ALLOW_INSECURE_LOOPBACK: '1',
      HOST: '127.0.0.1',
      PORT: String(port),
      METRICS_INTERVAL_MS: '1000'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  })
  const output: string[] = []
  const errors: string[] = []
  child.stdout?.on('data', (data) => output.push(data.toString()))
  child.stderr?.on('data', (data) => errors.push(data.toString()))
  return { child, output, errors }
}

async function waitForHealth(origin: string, child: ChildHandle): Promise<void> {
  const deadline = Date.now() + 10_000
  while (Date.now() < deadline) {
    if (child.child.exitCode !== null) {
      throw new Error(`server exited early: ${child.errors.join('')}`)
    }
    try {
      const response = await fetch(`${origin}/remote/healthz`)
      if (response.ok) return
    } catch {
      // The separate server process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`server did not become healthy: ${child.errors.join('')}`)
}

async function stopServer(handle: ChildHandle): Promise<void> {
  if (handle.child.exitCode !== null) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('server did not stop')), 5_000)
    handle.child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
    handle.child.kill('SIGTERM')
  })
}

class Client {
  readonly queue: unknown[] = []
  readonly waiters: Array<(message: unknown) => void> = []

  private constructor(readonly socket: WebSocket) {
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as unknown
      const waiter = this.waiters.shift()
      if (waiter) waiter(message)
      else this.queue.push(message)
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<Client> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new Client(socket)
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<unknown> {
    const value = this.queue.shift()
    if (value !== undefined) return Promise.resolve(value)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  closed(): Promise<void> {
    if (this.socket.readyState === WebSocket.CLOSED) return Promise.resolve()
    return new Promise((resolve) => this.socket.once('close', () => resolve()))
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const startedAt = Date.now()
const port = await unusedPort()
const origin = `http://127.0.0.1:${port}`
const wsUrl = `ws://127.0.0.1:${port}/remote/v1/ws`
const first = startServer(port)
let second: ChildHandle | null = null

try {
  await waitForHealth(origin, first)
  const createResponse = await fetch(`${origin}/remote/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin },
    body: '{}'
  })
  assert(createResponse.status === 201, 'room creation did not return 201')
  const room = (await createResponse.json()) as {
    roomId: string
    joinUrl: string
    revokeToken: string
  }
  assert(room.joinUrl === `${origin}/remote/${room.roomId}`, 'join URL mismatch')

  const desktop = await Client.connect(wsUrl)
  const phone = await Client.connect(wsUrl)
  const intruder = await Client.connect(wsUrl)
  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  assert((await desktop.next() as { type?: string }).type === 'hello-ok', 'desktop hello failed')
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
  assert((await phone.next() as { type?: string }).type === 'hello-ok', 'phone hello failed')
  assert((await desktop.next() as { type?: string }).type === 'peer-join', 'peer join missing')
  intruder.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  assert((await intruder.next() as { type?: string }).type === 'occupied', 'seat stealing was not blocked')

  const marker = `live-${Date.now()}-terminal-marker`
  phone.send({ v: 1, type: 'pty-in', sessionId: 'live-session', data: marker })
  const relayed = (await desktop.next()) as { type?: string; data?: string }
  assert(relayed.type === 'pty-in' && relayed.data === marker, 'phone frame was not relayed')

  const desktopClosed = desktop.closed()
  const phoneClosed = phone.closed()
  const revokeResponse = await fetch(`${origin}/remote/v1/rooms/${room.roomId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${room.revokeToken}` }
  })
  assert(revokeResponse.status === 204, 'authenticated revoke failed')
  assert((await desktop.next() as { type?: string }).type === 'revoked', 'desktop missed revoked')
  assert((await phone.next() as { type?: string }).type === 'revoked', 'phone missed revoked')
  await Promise.all([desktopClosed, phoneClosed])

  await stopServer(first)
  second = startServer(port)
  await waitForHealth(origin, second)
  const stale = await Client.connect(wsUrl)
  stale.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  assert((await stale.next() as { type?: string }).type === 'bad-key', 'restart retained old room')
  await stale.closed()

  const logs = `${first.output.join('')}\n${second.output.join('')}`
  for (const secret of [room.roomId, room.joinUrl, room.revokeToken, marker, 'live-session']) {
    assert(!logs.includes(secret), `secret appeared in logs: ${secret}`)
  }

  process.stdout.write(
    `${JSON.stringify({
      result: 'passed',
      interface: 'real child process HTTP + WebSocket',
      basePath: '/remote',
      checks: [
        'health',
        'create',
        'desktop-phone-pair',
        'seat-theft-blocked',
        'directional-relay',
        'revoke-before-close',
        'restart-invalidates-room',
        'secret-free-logs'
      ],
      elapsedMs: Date.now() - startedAt
    })}\n`
  )
} finally {
  await stopServer(first).catch(() => {})
  if (second) await stopServer(second).catch(() => {})
}
