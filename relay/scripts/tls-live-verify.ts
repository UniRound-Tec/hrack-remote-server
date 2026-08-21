import { request } from 'node:https'
import type { TLSSocket } from 'node:tls'

import WebSocket from 'ws'

interface HttpsResult {
  status: number
  headers: Record<string, string | string[] | undefined>
  body: string
  tlsProtocol: string | null
}

async function httpsCall(
  method: string,
  path: string,
  options: { body?: string; headers?: Record<string, string> } = {}
): Promise<HttpsResult> {
  return new Promise((resolve, reject) => {
    const call = request(
      {
        hostname: 'localhost',
        port: 4443,
        path,
        method,
        rejectUnauthorized: false,
        headers: options.headers
      },
      (response) => {
        const chunks: Buffer[] = []
        const tlsProtocol = (response.socket as TLSSocket).getProtocol()
        response.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        response.on('end', () => {
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            tlsProtocol
          })
        })
      }
    )
    call.once('error', reject)
    if (options.body) call.write(options.body)
    call.end()
  })
}

class SecureClient {
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

  static async connect(): Promise<SecureClient> {
    const socket = new WebSocket('wss://localhost:4443/remote/v1/ws', {
      rejectUnauthorized: false
    })
    await new Promise<void>((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new SecureClient(socket)
  }

  send(message: unknown): void {
    this.socket.send(JSON.stringify(message))
  }

  next(): Promise<unknown> {
    const message = this.queue.shift()
    if (message !== undefined) return Promise.resolve(message)
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

const page = await httpsCall('GET', '/remote/')
assert(page.status === 200, 'HTTPS generation page failed')
assert(
  String(page.headers['content-security-policy']).includes("default-src 'none'"),
  'CSP missing through TLS proxy'
)

const created = await httpsCall('POST', '/remote/v1/rooms', {
  body: '{}',
  headers: {
    'content-type': 'application/json',
    origin: 'https://localhost:4443'
  }
})
assert(created.status === 201, `HTTPS create failed with ${created.status}`)
const room = JSON.parse(created.body) as {
  roomId: string
  joinUrl: string
  revokeToken: string
}
assert(
  room.joinUrl === `https://localhost:4443/remote/${room.roomId}`,
  'HTTPS join URL mismatch'
)

const desktop = await SecureClient.connect()
const phone = await SecureClient.connect()
desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId: room.roomId })
assert((await desktop.next() as { type?: string }).type === 'hello-ok', 'WSS desktop hello failed')
phone.send({ v: 1, type: 'hello', role: 'phone', roomId: room.roomId })
assert((await phone.next() as { type?: string }).type === 'hello-ok', 'WSS phone hello failed')
assert((await desktop.next() as { type?: string }).type === 'peer-join', 'WSS peer join failed')

phone.send({ v: 1, type: 'pty-in', sessionId: 'tls-session', data: 'tls-through-nginx' })
const relayed = (await desktop.next()) as { type?: string; data?: string }
assert(relayed.type === 'pty-in' && relayed.data === 'tls-through-nginx', 'WSS relay failed')

const desktopClosed = desktop.closed()
const phoneClosed = phone.closed()
const revoked = await httpsCall('DELETE', `/remote/v1/rooms/${room.roomId}`, {
  headers: { authorization: `Bearer ${room.revokeToken}` }
})
assert(revoked.status === 204, 'HTTPS revoke failed')
assert((await desktop.next() as { type?: string }).type === 'revoked', 'WSS desktop revoke missing')
assert((await phone.next() as { type?: string }).type === 'revoked', 'WSS phone revoke missing')
await Promise.all([desktopClosed, phoneClosed])

process.stdout.write(
  `${JSON.stringify({
    result: 'passed',
    interface: 'HTTPS + WSS through real Nginx TLS reverse proxy',
    tlsProtocol: created.tlsProtocol,
    checks: [
      'HTTPS page and CSP',
      'HTTPS create and canonical join URL',
      'WSS upgrade',
      'WSS directional relay',
      'HTTPS revoke before WSS close'
    ]
  })}\n`
)
