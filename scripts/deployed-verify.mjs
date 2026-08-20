import WebSocket from 'ws'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

class Client {
  queue = []
  waiters = []

  constructor(socket) {
    this.socket = socket
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString())
      const waiter = this.waiters.shift()
      if (waiter) waiter(message)
      else this.queue.push(message)
    })
  }

  static async connect(url) {
    const socket = new WebSocket(url)
    await new Promise((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new Client(socket)
  }

  send(message) {
    this.socket.send(JSON.stringify(message))
  }

  next(label, timeoutMs = 5_000) {
    const queued = this.queue.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`message timeout: ${label}`)), timeoutMs)
      this.waiters.push((message) => {
        clearTimeout(timer)
        resolve(message)
      })
    })
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close()
  }
}

const targetOrigin = process.env.TARGET_ORIGIN ?? 'http://127.0.0.1:8787'
const basePath = process.env.TARGET_BASE_PATH ?? '/remote'
const wsOrigin = targetOrigin.replace(/^http/, 'ws')
const wsUrl = `${wsOrigin}${basePath}/v1/ws`
const clients = []
const startedAt = Date.now()

try {
  const health = await fetch(`${targetOrigin}${basePath}/healthz`)
  assert(health.status === 200, 'health check failed')

  const create = await fetch(`${targetOrigin}${basePath}/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  assert(create.status === 201, 'room creation failed')
  const room = await create.json()

  const desktop = await Client.connect(wsUrl)
  const phone = await Client.connect(wsUrl)
  clients.push(desktop, phone)

  desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
  assert((await desktop.next('desktop hello')).type === 'hello-ok', 'desktop hello failed')
  phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
  assert((await phone.next('phone hello')).type === 'hello-ok', 'phone hello failed')
  assert((await desktop.next('desktop peer join')).type === 'peer-join', 'desktop missed peer join')

  const phoneMarker = `phone-${Date.now()}`
  phone.send({ v: 1, type: 'pty-in', sessionId: 'deploy-check', data: phoneMarker })
  const atDesktop = await desktop.next('phone-to-desktop relay')
  assert(
    atDesktop.type === 'pty-in' && atDesktop.data === phoneMarker,
    'phone-to-desktop relay failed'
  )

  const desktopMarker = `desktop-${Date.now()}`
  const desktopPayload = Buffer.from(desktopMarker).toString('base64')
  desktop.send({
    v: 1,
    type: 'pty-out',
    sessionId: 'deploy-check',
    data: desktopPayload,
    byteLength: Buffer.byteLength(desktopMarker)
  })
  const atPhone = await phone.next('desktop-to-phone relay')
  assert(
    atPhone.type === 'pty-out' &&
      Buffer.from(atPhone.data, 'base64').toString('utf8') === desktopMarker,
    'desktop-to-phone relay failed'
  )

  const revoke = await fetch(`${targetOrigin}${basePath}/v1/rooms/${room.roomId}`, {
    method: 'DELETE',
    headers: { authorization: `Bearer ${room.revokeToken}` }
  })
  assert(revoke.status === 204, 'room revoke failed')
  assert((await desktop.next('desktop revoke')).type === 'revoked', 'desktop missed revoke')
  assert((await phone.next('phone revoke')).type === 'revoked', 'phone missed revoke')

  process.stdout.write(`${JSON.stringify({
    result: 'passed',
    interface: 'deployed HTTP + WebSocket',
    checks: [
      'health',
      'create',
      'pair',
      'phone-to-desktop',
      'desktop-to-phone',
      'revoke-before-close'
    ],
    elapsedMs: Date.now() - startedAt
  })}\n`)
} finally {
  for (const client of clients) client.close()
}
