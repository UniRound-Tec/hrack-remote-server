import { performance } from 'node:perf_hooks'

import WebSocket from 'ws'

function integerEnvironment(name: string, fallback: number): number {
  const text = process.env[name]
  if (text === undefined) return fallback
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

function nonNegativeEnvironment(name: string, fallback: number): number {
  const text = process.env[name]
  if (text === undefined) return fallback
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`)
  }
  return value
}

const targetOrigin = process.env.TARGET_ORIGIN ?? 'http://127.0.0.1:3000'
const targetBasePath = process.env.TARGET_BASE_PATH ?? '/remote'
const connections = integerEnvironment('LOAD_CONNECTIONS', 2_000)
const activeRooms = integerEnvironment('LOAD_ACTIVE_ROOMS', 100)
const durationSeconds = integerEnvironment('LOAD_DURATION_SECONDS', 1_800)
const intervalMs = integerEnvironment('LOAD_MESSAGE_INTERVAL_MS', 100)
const payloadBytes = integerEnvironment('LOAD_PAYLOAD_BYTES', 1_024)
const burstBytes = nonNegativeEnvironment('LOAD_BURST_BYTES', 0)
const burstIntervalMs = integerEnvironment('LOAD_BURST_INTERVAL_MS', 5_000)
const maxP99Ms = integerEnvironment('LOAD_MAX_P99_MS', 100)
const roomCount = Math.ceil(connections / 2)

if (connections % 2 !== 0) throw new Error('LOAD_CONNECTIONS must be even')
if (activeRooms > roomCount) throw new Error('LOAD_ACTIVE_ROOMS exceeds room count')
if (payloadBytes > 262_144 || burstBytes > 262_144) {
  throw new Error('payload sizes exceed the v1 PTY chunk limit')
}

const wsOrigin = targetOrigin.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:')
const wsUrl = `${wsOrigin}${targetBasePath}/v1/ws`
const roomUrl = `${targetOrigin}${targetBasePath}/v1/rooms`

interface RoomCredential {
  roomId: string
}

interface LoadMessage {
  type?: string
  data?: string
}

const openClients = new Set<LoadClient>()

class LoadClient {
  readonly queue: LoadMessage[] = []
  readonly waiters: Array<(message: LoadMessage) => void> = []
  onBusinessMessage: ((message: LoadMessage) => void) | null = null
  intentionalClose = false
  disconnected = false

  private constructor(readonly socket: WebSocket) {
    openClients.add(this)
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString()) as LoadMessage
      if (this.onBusinessMessage && (message.type === 'pty-in' || message.type === 'pty-out')) {
        this.onBusinessMessage(message)
        return
      }
      const waiter = this.waiters.shift()
      if (waiter) waiter(message)
      else this.queue.push(message)
    })
    socket.on('close', () => {
      openClients.delete(this)
      if (!this.intentionalClose) this.disconnected = true
    })
    socket.on('error', () => {})
  }

  static async connect(url: string): Promise<LoadClient> {
    const socket = new WebSocket(url)
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new LoadClient(socket)
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<LoadMessage> {
    const message = this.queue.shift()
    if (message) return Promise.resolve(message)
    return new Promise((resolve) => this.waiters.push(resolve))
  }

  stop(): void {
    this.intentionalClose = true
    this.socket.terminate()
  }
}

process.on('exit', () => {
  for (const client of openClients) client.stop()
})

interface Pair {
  desktop: LoadClient
  phone: LoadClient
}

async function parallelBatches<T, R>(
  values: readonly T[],
  concurrency: number,
  operation: (value: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(values.length)
  let cursor = 0
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (cursor < values.length) {
        const index = cursor++
        const value = values[index]
        if (value === undefined) continue
        results[index] = await operation(value, index)
      }
    })
  )
  return results
}

async function createRoom(): Promise<RoomCredential> {
  const response = await fetch(roomUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  if (response.status !== 201) {
    throw new Error(`room creation failed with ${response.status}`)
  }
  return (await response.json()) as RoomCredential
}

async function pairRoom(room: RoomCredential): Promise<Pair> {
  const [desktop, phone] = await Promise.all([
    LoadClient.connect(wsUrl),
    LoadClient.connect(wsUrl)
  ])
  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  if ((await desktop.next()).type !== 'hello-ok') throw new Error('desktop hello failed')
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
  if ((await phone.next()).type !== 'hello-ok') throw new Error('phone hello failed')
  if ((await desktop.next()).type !== 'peer-join') throw new Error('peer join missing')
  return { desktop, phone }
}

const latencyBuckets = new Uint32Array(10_001)
let latencySamples = 0
let sent = 0
let received = 0
let maxClientBufferedBytes = 0

function recordLatency(sentAt: number): void {
  const latency = Math.max(0, performance.now() - sentAt)
  const bucket = Math.min(latencyBuckets.length - 1, Math.floor(latency))
  latencyBuckets[bucket] = (latencyBuckets[bucket] ?? 0) + 1
  latencySamples += 1
  received += 1
}

function p99Latency(): number {
  if (latencySamples === 0) return Number.POSITIVE_INFINITY
  const threshold = Math.ceil(latencySamples * 0.99)
  let cumulative = 0
  for (let index = 0; index < latencyBuckets.length; index += 1) {
    cumulative += latencyBuckets[index] ?? 0
    if (cumulative >= threshold) return index
  }
  return latencyBuckets.length - 1
}

function payload(sentAt: number, sequence: number, bytes: number): string {
  const header = JSON.stringify({ sentAt, sequence, pad: '' })
  const padding = Math.max(0, bytes - Buffer.byteLength(header))
  return JSON.stringify({ sentAt, sequence, pad: 'x'.repeat(padding) })
}

function parseSentAt(data: string): number | null {
  try {
    const value = JSON.parse(data) as { sentAt?: unknown }
    return typeof value.sentAt === 'number' ? value.sentAt : null
  } catch {
    return null
  }
}

const setupStartedAt = performance.now()
const roomInputs = Array.from({ length: roomCount }, (_, index) => index)
process.stdout.write(
  `${JSON.stringify({ event: 'load-setup', phase: 'create-rooms', roomCount })}\n`
)
const rooms = await parallelBatches(roomInputs, 50, () => createRoom())
process.stdout.write(
  `${JSON.stringify({ event: 'load-setup', phase: 'pair-sockets', connections })}\n`
)
const pairs = await parallelBatches(rooms, 50, (room) => pairRoom(room))
const active = pairs.slice(0, activeRooms)

for (const pair of active) {
  pair.desktop.onBusinessMessage = (message) => {
    if (message.type !== 'pty-in' || typeof message.data !== 'string') return
    const sentAt = parseSentAt(message.data)
    if (sentAt !== null) recordLatency(sentAt)
  }
  pair.phone.onBusinessMessage = (message) => {
    if (message.type !== 'pty-out' || typeof message.data !== 'string') return
    const sentAt = parseSentAt(Buffer.from(message.data, 'base64').toString('utf8'))
    if (sentAt !== null) recordLatency(sentAt)
  }
}

let sequence = 0
const sendRound = (bytes: number): void => {
  for (let index = 0; index < active.length; index += 1) {
    const pair = active[index]
    if (!pair) continue
    const sentAt = performance.now()
    const body = payload(sentAt, sequence++, bytes)
    pair.phone.send({
      v: 1,
      type: 'pty-in',
      sessionId: `s-${index}`,
      data: body
    })
    pair.desktop.send({
      v: 1,
      type: 'pty-out',
      sessionId: `s-${index}`,
      data: Buffer.from(body).toString('base64'),
      byteLength: Buffer.byteLength(body)
    })
    sent += 2
    maxClientBufferedBytes = Math.max(
      maxClientBufferedBytes,
      pair.desktop.socket.bufferedAmount,
      pair.phone.socket.bufferedAmount
    )
  }
}

process.stdout.write(
  `${JSON.stringify({
    event: 'load-running',
    setupMs: Math.round(performance.now() - setupStartedAt),
    connections,
    activeRooms,
    durationSeconds,
    intervalMs,
    payloadBytes,
    burstBytes,
    burstIntervalMs
  })}\n`
)

const regularTraffic = setInterval(() => sendRound(payloadBytes), intervalMs)
const burstTraffic =
  burstBytes > 0 ? setInterval(() => sendRound(burstBytes), burstIntervalMs) : null
await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1_000))
clearInterval(regularTraffic)
if (burstTraffic) clearInterval(burstTraffic)
await new Promise((resolve) => setTimeout(resolve, 1_000))

const disconnected = pairs.reduce(
  (count, pair) =>
    count + Number(pair.desktop.disconnected) + Number(pair.phone.disconnected),
  0
)
const p99Ms = p99Latency()
const deliveryRatio = sent === 0 ? 0 : received / sent
for (const pair of pairs) {
  pair.desktop.stop()
  pair.phone.stop()
}

const passed =
  disconnected === 0 &&
  deliveryRatio >= 0.99 &&
  p99Ms < maxP99Ms &&
  maxClientBufferedBytes <= 1_048_576
const report = {
  result: passed ? 'passed' : 'failed',
  interface: 'independent process real WebSocket load',
  connections,
  rooms: roomCount,
  activeRooms,
  durationSeconds,
  sent,
  received,
  deliveryRatio: Number(deliveryRatio.toFixed(5)),
  p99Ms,
  maxP99Ms,
  disconnected,
  maxClientBufferedBytes
}
process.stdout.write(`${JSON.stringify(report)}\n`)
if (!passed) process.exitCode = 1
