import { createHash, randomBytes as systemRandomBytes, timingSafeEqual } from 'node:crypto'
import type { Duplex } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'

import WebSocket, { WebSocketServer, type RawData } from 'ws'

import {
  DSH_TUNNEL_LIMITS,
  encodeDshTunnelBinary,
  encodeDshTunnelControl,
  normalizeDshWebSocketCloseCode,
  parseDshTunnelBinary,
  parseDshTunnelControl,
  type DshTunnelControl,
  type DshTunnelHeaders
} from '../protocol/dsh-tunnel-protocol.js'
import type {
  RemoteDshTicketOk,
  RemoteDshTicketReject,
  RemoteDshSurfaceState,
  RemoteHelloOk,
  RemoteMessage,
  RemoteRole
} from '../protocol/remote-protocol.js'
import type { RelayConfig } from '../relay/relay-config.js'

interface DshGatewayDependencies {
  now(): number
  randomBytes(size: number): Uint8Array
}

export interface DshGatewayMetrics {
  healthy: boolean
  activeTunnels: number
  pendingTunnels: number
  activeWebSessions: number
  activeHttpStreams: number
  activeWebSocketStreams: number
  bufferedBytes: number
  bytesPublicToDesktop: number
  bytesDesktopToPublic: number
  errors: {
    buffer: number
    timeout: number
    protocol: number
    transport: number
    upstream: number
  }
}

type DshErrorCategory = keyof DshGatewayMetrics['errors']

interface DesktopSeat {
  roomId: string
  connectionId: string
  token: string
  tokenDigest: Buffer
  tokenExpiresAt: number
  tunnel: WebSocket | null
  tunnelGeneration: number
  surface: RemoteDshSurfaceState['surface'] | null
}

interface Ticket {
  digest: string
  roomId: string
  phoneConnectionId: string
  desktopConnectionId: string
  tunnelGeneration: number
  surfaceGeneration: number
  expiresAt: number
}

interface WebSession {
  digest: string
  roomId: string
  phoneConnectionId: string
  desktopConnectionId: string
  tunnelGeneration: number
  surfaceGeneration: number
  expiresAt: number
  streams: Set<number>
}

interface RequestFlow {
  credit: number
  sequence: number
  queued: Buffer[]
  queuedBytes: number
  ended: boolean
  endSent: boolean
  bytes: number
}

interface HttpStream {
  kind: 'http'
  id: number
  sessionDigest: string
  request: IncomingMessage
  response: ServerResponse
  requestFlow: RequestFlow
  responseSequence: number
  responseBytes: number
  responseCredit: number
  responseUnconsumed: number
  headReceived: boolean
  sse: boolean
  timer: NodeJS.Timeout | null
}

interface WebSocketStream {
  kind: 'ws'
  id: number
  sessionDigest: string
  socket: WebSocket
  sequence: number
  credit: number
  unconsumed: number
  opened: boolean
  timer: NodeJS.Timeout | null
}

type GatewayStream = HttpStream | WebSocketStream

const COOKIE_NAME = '__Host-hrack-dsh'
const NO_STORE = {
  'cache-control': 'no-store',
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
}
const REQUEST_HEADERS = new Set([
  'accept',
  'accept-encoding',
  'accept-language',
  'cache-control',
  'content-type',
  'if-modified-since',
  'if-none-match',
  'range'
])
const RESPONSE_HEADERS = new Set([
  'accept-ranges',
  'cache-control',
  'content-encoding',
  'content-length',
  'content-range',
  'content-security-policy',
  'content-type',
  'etag',
  'last-modified',
  'location',
  'referrer-policy',
  'vary',
  'x-content-type-options'
])

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

function digestKey(value: string): string {
  return digest(value).toString('base64url')
}

function secretMatches(expected: Buffer, actual: string): boolean {
  const value = digest(actual)
  return value.byteLength === expected.byteLength && timingSafeEqual(value, expected)
}

function asBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof ArrayBuffer) return Buffer.from(data)
  if (Array.isArray(data)) return Buffer.concat(data)
  throw new Error('unsupported WebSocket payload')
}

function requestPath(request: IncomingMessage): string | null {
  const raw = request.url ?? '/'
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\\0\r\n]/.test(raw)) return null
  let parsed: URL
  try {
    parsed = new URL(raw, 'https://dsh.invalid')
  } catch {
    return null
  }
  if (parsed.origin !== 'https://dsh.invalid' || parsed.hash) return null
  let decoded = parsed.pathname
  for (let pass = 0; pass < 2; pass += 1) {
    try {
      decoded = decodeURIComponent(decoded)
    } catch {
      return null
    }
    if (decoded.split('/').some((segment) => segment === '.' || segment === '..')) {
      return null
    }
  }
  return raw
}

function isAllowedHttp(method: string, rawPath: string): boolean {
  const pathname = new URL(rawPath, 'https://dsh.invalid').pathname
  if (method === 'POST') return pathname.startsWith('/api/')
  if (method !== 'GET' && method !== 'HEAD') return false
  if (pathname === '/') return method === 'GET'
  if (pathname === '/plugins/events') return method === 'GET'
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/plugins/') ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.svg'
  )
}

function isAllowedWebSocket(rawPath: string): boolean {
  const pathname = new URL(rawPath, 'https://dsh.invalid').pathname
  return pathname === '/api/events.mux' || pathname === '/api/events.host'
}

function collectHeaders(request: IncomingMessage, publicOrigin: string): DshTunnelHeaders | null {
  const origin = request.headers.origin
  if (origin !== undefined && origin !== publicOrigin) return null
  const output: DshTunnelHeaders = []
  for (const [name, raw] of Object.entries(request.headers)) {
    if (!REQUEST_HEADERS.has(name) || raw === undefined) continue
    for (const value of Array.isArray(raw) ? raw : [raw]) output.push([name, value])
  }
  if (origin === publicOrigin) output.push(['origin', publicOrigin])
  return output
}

function responseHeaders(headers: DshTunnelHeaders, publicOrigin: string): Record<string, string | string[]> | null {
  const output: Record<string, string | string[]> = {
    'referrer-policy': 'no-referrer',
    'x-content-type-options': 'nosniff'
  }
  for (const [name, value] of headers) {
    if (!RESPONSE_HEADERS.has(name) || name === 'set-cookie') continue
    if (name === 'location') {
      let target: URL
      try {
        target = new URL(value, publicOrigin)
      } catch {
        return null
      }
      if (target.origin !== publicOrigin) return null
    }
    const current = output[name]
    if (current === undefined) output[name] = value
    else output[name] = Array.isArray(current) ? [...current, value] : [current, value]
  }
  output['referrer-policy'] = 'no-referrer'
  output['x-content-type-options'] = 'nosniff'
  return output
}

function cookieValue(request: IncomingMessage): string | null {
  const raw = request.headers.cookie
  if (!raw) return null
  for (const item of raw.split(';')) {
    const [name, ...rest] = item.trim().split('=')
    if (name === COOKIE_NAME) {
      const value = rest.join('=')
      return /^[A-Za-z0-9_-]{43}$/.test(value) ? value : null
    }
  }
  return null
}

function empty(response: ServerResponse, status: number): void {
  response.writeHead(status, NO_STORE)
  response.end()
}

function rejectUpgrade(socket: Duplex, status: 401 | 404 | 405 | 503): void {
  const reason = status === 401 ? 'Unauthorized' : status === 404 ? 'Not Found' : status === 405 ? 'Method Not Allowed' : 'Service Unavailable'
  socket.end(
    `HTTP/1.1 ${status} ${reason}\r\nConnection: close\r\nCache-Control: no-store\r\nContent-Length: 0\r\n\r\n`
  )
}

export class DshGateway {
  readonly #publicOrigin: string | null
  readonly #publicAuthority: string | null
  readonly #desktopSeats = new Map<string, DesktopSeat>()
  readonly #phoneSeats = new Map<string, string>()
  readonly #tickets = new Map<string, Ticket>()
  readonly #sessions = new Map<string, WebSession>()
  readonly #streams = new Map<number, GatewayStream>()
  readonly #usedStreamIds = new Set<number>()
  readonly #tunnelServer = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    perMessageDeflate: false,
    maxPayload: DSH_TUNNEL_LIMITS.controlBytes + DSH_TUNNEL_LIMITS.framePayloadBytes + 10
  })
  readonly #publicWebSocketServer = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    perMessageDeflate: false,
    maxPayload: DSH_TUNNEL_LIMITS.framePayloadBytes
  })
  #nextStreamId = 1
  #pendingTunnels = 0
  #bytesPublicToDesktop = 0
  #bytesDesktopToPublic = 0
  readonly #errors: DshGatewayMetrics['errors'] = {
    buffer: 0,
    timeout: 0,
    protocol: 0,
    transport: 0,
    upstream: 0
  }
  readonly #pruner: NodeJS.Timeout

  constructor(
    readonly config: RelayConfig,
    readonly dependencies: DshGatewayDependencies = {
      now: Date.now,
      randomBytes: (size) => systemRandomBytes(size)
    }
  ) {
    this.#publicOrigin = config.dshPublicOrigin
    this.#publicAuthority = config.dshPublicOrigin
      ? new URL(config.dshPublicOrigin).host.toLowerCase()
      : null
    this.#pruner = setInterval(() => this.#pruneExpired(), 30_000)
    this.#pruner.unref()
  }

  get enabled(): boolean {
    return this.#publicOrigin !== null
  }

  metrics(): DshGatewayMetrics {
    let activeHttpStreams = 0
    let activeWebSocketStreams = 0
    let bufferedBytes = 0
    for (const stream of this.#streams.values()) {
      if (stream.kind === 'http') {
        activeHttpStreams += 1
        bufferedBytes += stream.requestFlow.queuedBytes + stream.responseUnconsumed
      } else {
        activeWebSocketStreams += 1
        bufferedBytes += stream.unconsumed
      }
    }
    return {
      healthy: this.enabled,
      activeTunnels: this.#activeTunnelCount(),
      pendingTunnels: this.#pendingTunnels,
      activeWebSessions: this.#sessions.size,
      activeHttpStreams,
      activeWebSocketStreams,
      bufferedBytes,
      bytesPublicToDesktop: this.#bytesPublicToDesktop,
      bytesDesktopToPublic: this.#bytesDesktopToPublic,
      errors: { ...this.#errors }
    }
  }

  isPublicHost(request: IncomingMessage): boolean {
    return this.#publicAuthority !== null && request.headers.host?.toLowerCase() === this.#publicAuthority
  }

  decorateHelloOk(input: {
    connectionId: string
    roomId: string
    role: RemoteRole
  }): Pick<RemoteHelloOk, 'relayCapabilities' | 'dshSeatToken'> {
    if (!this.#publicOrigin) return {}
    const relayCapabilities = {
      dshWebTunnel: { origin: this.#publicOrigin, protocol: 1 as const }
    }
    if (input.role === 'phone') {
      this.#phoneSeats.set(input.roomId, input.connectionId)
      return { relayCapabilities }
    }
    let seat = this.#desktopSeats.get(input.roomId)
    if (!seat || seat.connectionId !== input.connectionId) {
      if (seat) this.#dropDesktopSeat(seat)
      const token = Buffer.from(this.dependencies.randomBytes(32)).toString('base64url')
      seat = {
        roomId: input.roomId,
        connectionId: input.connectionId,
        token,
        tokenDigest: digest(token),
        tokenExpiresAt: this.dependencies.now() + this.config.dshSeatTokenTtlMs,
        tunnel: null,
        tunnelGeneration: 0,
        surface: null
      }
      this.#desktopSeats.set(input.roomId, seat)
    }
    return { relayCapabilities, dshSeatToken: seat.token }
  }

  observeDesktopMessage(input: {
    connectionId: string
    roomId: string
    message: RemoteMessage
  }): void {
    if (input.message.type !== 'dsh-surface-state') return
    const seat = this.#desktopSeats.get(input.roomId)
    if (!seat || seat.connectionId !== input.connectionId) return
    const changed = seat.surface?.generation !== input.message.surface.generation
    seat.surface = { ...input.message.surface }
    if (changed || input.message.surface.state !== 'ready') {
      this.#invalidateWebAccess(input.roomId)
    }
  }

  issueTicket(input: {
    connectionId: string
    roomId: string
    requestId: string
  }): RemoteDshTicketOk | RemoteDshTicketReject {
    const reject = (reason: RemoteDshTicketReject['reason']): RemoteDshTicketReject => ({
      v: 1,
      type: 'dsh-ticket-reject',
      requestId: input.requestId,
      reason
    })
    if (!this.#publicOrigin) return reject('unsupported')
    if (this.#phoneSeats.get(input.roomId) !== input.connectionId) return reject('unavailable')
    const seat = this.#desktopSeats.get(input.roomId)
    if (!seat) return reject('desktop-offline')
    if (!seat.tunnel || seat.tunnel.readyState !== WebSocket.OPEN) return reject('tunnel-offline')
    if (seat.surface?.state !== 'ready') return reject('disabled')
    this.#pruneExpired()
    if (this.#tickets.size + this.#sessions.size >= this.config.maxDshSessions) {
      return reject('busy')
    }
    const raw = Buffer.from(this.dependencies.randomBytes(32)).toString('base64url')
    const expiresAt = this.dependencies.now() + this.config.dshTicketTtlMs
    const record: Ticket = {
      digest: digestKey(raw),
      roomId: input.roomId,
      phoneConnectionId: input.connectionId,
      desktopConnectionId: seat.connectionId,
      tunnelGeneration: seat.tunnelGeneration,
      surfaceGeneration: seat.surface.generation,
      expiresAt
    }
    this.#tickets.set(record.digest, record)
    return {
      v: 1,
      type: 'dsh-ticket-ok',
      requestId: input.requestId,
      url: `${this.#publicOrigin}/_connect/${raw}`,
      expiresAt
    }
  }

  onConnectionClosed(input: {
    connectionId: string
    roomId: string | null
    role: RemoteRole | null
  }): void {
    if (!input.roomId || !input.role) return
    if (input.role === 'phone') {
      if (this.#phoneSeats.get(input.roomId) === input.connectionId) {
        this.#phoneSeats.delete(input.roomId)
        this.#invalidateWebAccess(input.roomId)
      }
      return
    }
    const seat = this.#desktopSeats.get(input.roomId)
    if (seat?.connectionId === input.connectionId) this.#dropDesktopSeat(seat)
  }

  revokeRoom(roomId: string): void {
    this.#phoneSeats.delete(roomId)
    const seat = this.#desktopSeats.get(roomId)
    if (seat) this.#dropDesktopSeat(seat)
    else this.#invalidateWebAccess(roomId)
  }

  async handlePublicHttp(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const rawPath = requestPath(request)
    if (!rawPath) {
      empty(response, 400)
      return
    }
    const url = new URL(rawPath, this.#publicOrigin ?? 'https://dsh.invalid')
    if (request.method === 'GET' && url.pathname === '/_healthz' && !url.search) {
      response.writeHead(200, { ...NO_STORE, 'content-type': 'application/json; charset=utf-8' })
      response.end('{"ok":true}')
      return
    }
    if (url.pathname.startsWith('/_connect/')) {
      this.#connectTicket(request, response, url)
      return
    }
    const session = this.#authenticate(request)
    if (!session) {
      empty(response, 401)
      return
    }
    const method = request.method ?? 'GET'
    if (!isAllowedHttp(method, rawPath)) {
      empty(response, ['CONNECT', 'TRACE'].includes(method) ? 405 : 404)
      return
    }
    const seat = this.#currentSeat(session)
    if (!seat?.tunnel) {
      empty(response, 503)
      return
    }
    const headers = collectHeaders(request, this.#publicOrigin!)
    if (!headers) {
      empty(response, 403)
      return
    }
    const contentLengthText = request.headers['content-length']
    const contentLength = contentLengthText === undefined ? null : Number(contentLengthText)
    if (
      contentLength !== null &&
      (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > DSH_TUNNEL_LIMITS.requestBodyBytes)
    ) {
      empty(response, 413)
      return
    }
    const sse = url.pathname === '/plugins/events'
    const sessionHttp = [...session.streams]
      .map((id) => this.#streams.get(id))
      .filter((stream): stream is HttpStream => stream?.kind === 'http')
    if (
      sessionHttp.length >= DSH_TUNNEL_LIMITS.concurrentHttp ||
      (sse && sessionHttp.some((stream) => stream.sse))
    ) {
      empty(response, 429)
      return
    }
    const id = this.#allocateStreamId()
    const stream: HttpStream = {
      kind: 'http',
      id,
      sessionDigest: session.digest,
      request,
      response,
      requestFlow: {
        credit: 0,
        sequence: 0,
        queued: [],
        queuedBytes: 0,
        ended: false,
        endSent: false,
        bytes: 0
      },
      responseSequence: 0,
      responseBytes: 0,
      responseCredit: DSH_TUNNEL_LIMITS.initialCreditBytes,
      responseUnconsumed: 0,
      headReceived: false,
      sse,
      timer: null
    }
    this.#streams.set(id, stream)
    session.streams.add(id)
    this.#touchStream(stream, 10_000)
    request.pause()
    request.on('data', (chunk: Buffer) => this.#queueRequestBody(stream, Buffer.from(chunk)))
    request.once('end', () => {
      stream.requestFlow.ended = true
      this.#drainRequest(stream)
    })
    request.once('error', () => {
      this.#recordError('transport')
      this.#abortHttp(stream, 'public-request-failed')
    })
    response.once('close', () => {
      if (this.#streams.get(stream.id) === stream) {
        this.#recordError('transport')
        this.#abortHttp(stream, 'public-response-closed')
      }
    })
    this.#sendControl(seat, {
      type: 'http-open',
      streamId: id,
      method,
      path: rawPath,
      headers,
      ...(contentLength !== null ? { bodyLength: contentLength } : {})
    })
    if (contentLength === 0 || (method !== 'POST' && contentLength === null)) {
      stream.requestFlow.ended = true
      this.#drainRequest(stream)
    } else {
      request.resume()
    }
  }

  handleUpgrade(request: IncomingMessage, socket: Duplex, head: Buffer, tunnelPath: string): boolean {
    const rawPath = requestPath(request)
    if (this.isPublicHost(request)) {
      if (!rawPath || !isAllowedWebSocket(rawPath)) {
        rejectUpgrade(socket, 404)
        return true
      }
      const session = this.#authenticate(request)
      if (!session) {
        rejectUpgrade(socket, 401)
        return true
      }
      const seat = this.#currentSeat(session)
      if (!seat?.tunnel) {
        rejectUpgrade(socket, 503)
        return true
      }
      const wsCount = [...session.streams]
        .map((id) => this.#streams.get(id))
        .filter((stream) => stream?.kind === 'ws').length
      if (wsCount >= DSH_TUNNEL_LIMITS.concurrentWebSocket) {
        rejectUpgrade(socket, 503)
        return true
      }
      const headers = collectHeaders(request, this.#publicOrigin!)
      if (!headers) {
        rejectUpgrade(socket, 401)
        return true
      }
      this.#publicWebSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.#openPublicWebSocket(session, seat, webSocket, rawPath, headers)
      })
      return true
    }
    if (rawPath === tunnelPath && this.enabled) {
      if (this.#pendingTunnels + this.#activeTunnelCount() >= this.config.maxDshTunnels) {
        rejectUpgrade(socket, 503)
        return true
      }
      this.#pendingTunnels += 1
      this.#tunnelServer.handleUpgrade(request, socket, head, (webSocket) => {
        this.#acceptTunnel(webSocket)
      })
      return true
    }
    return false
  }

  close(): void {
    clearInterval(this.#pruner)
    for (const seat of this.#desktopSeats.values()) seat.tunnel?.terminate()
    for (const stream of [...this.#streams.values()]) this.#dropStream(stream)
    this.#desktopSeats.clear()
    this.#phoneSeats.clear()
    this.#tickets.clear()
    this.#sessions.clear()
    this.#tunnelServer.close()
    this.#publicWebSocketServer.close()
  }

  #connectTicket(request: IncomingMessage, response: ServerResponse, url: URL): void {
    if (
      request.method !== 'GET' ||
      url.search ||
      url.pathname.split('/').length !== 3 ||
      request.headers['sec-fetch-dest'] && request.headers['sec-fetch-dest'] !== 'document' ||
      request.headers['sec-fetch-mode'] && request.headers['sec-fetch-mode'] !== 'navigate'
    ) {
      empty(response, request.method === 'GET' ? 404 : 405)
      return
    }
    const raw = url.pathname.slice('/_connect/'.length)
    if (!/^[A-Za-z0-9_-]{43}$/.test(raw)) {
      empty(response, 404)
      return
    }
    const key = digestKey(raw)
    const ticket = this.#tickets.get(key)
    this.#tickets.delete(key)
    if (!ticket || ticket.expiresAt <= this.dependencies.now() || !this.#ticketCurrent(ticket)) {
      empty(response, 404)
      return
    }
    this.#pruneExpired()
    if (this.#sessions.size >= this.config.maxDshSessions) {
      empty(response, 503)
      return
    }
    const sessionSecret = Buffer.from(this.dependencies.randomBytes(32)).toString('base64url')
    const session: WebSession = {
      digest: digestKey(sessionSecret),
      roomId: ticket.roomId,
      phoneConnectionId: ticket.phoneConnectionId,
      desktopConnectionId: ticket.desktopConnectionId,
      tunnelGeneration: ticket.tunnelGeneration,
      surfaceGeneration: ticket.surfaceGeneration,
      expiresAt: this.dependencies.now() + this.config.dshSessionTtlMs,
      streams: new Set()
    }
    this.#sessions.set(session.digest, session)
    response.writeHead(303, {
      ...NO_STORE,
      location: '/',
      'set-cookie': `${COOKIE_NAME}=${sessionSecret}; Secure; HttpOnly; SameSite=Strict; Path=/`
    })
    response.end()
  }

  #authenticate(request: IncomingMessage): WebSession | null {
    const raw = cookieValue(request)
    if (!raw) return null
    const session = this.#sessions.get(digestKey(raw))
    if (!session || session.expiresAt <= this.dependencies.now() || !this.#sessionCurrent(session)) {
      if (session) this.#dropSession(session)
      return null
    }
    return session
  }

  #ticketCurrent(ticket: Ticket): boolean {
    const seat = this.#desktopSeats.get(ticket.roomId)
    return (
      this.#phoneSeats.get(ticket.roomId) === ticket.phoneConnectionId &&
      seat?.connectionId === ticket.desktopConnectionId &&
      seat.tunnel?.readyState === WebSocket.OPEN &&
      seat.tunnelGeneration === ticket.tunnelGeneration &&
      seat.surface?.state === 'ready' &&
      seat.surface.generation === ticket.surfaceGeneration
    )
  }

  #sessionCurrent(session: WebSession): boolean {
    const seat = this.#desktopSeats.get(session.roomId)
    return (
      this.#phoneSeats.get(session.roomId) === session.phoneConnectionId &&
      seat?.connectionId === session.desktopConnectionId &&
      seat.tunnel?.readyState === WebSocket.OPEN &&
      seat.tunnelGeneration === session.tunnelGeneration &&
      seat.surface?.state === 'ready' &&
      seat.surface.generation === session.surfaceGeneration
    )
  }

  #currentSeat(session: WebSession): DesktopSeat | null {
    return this.#sessionCurrent(session) ? this.#desktopSeats.get(session.roomId) ?? null : null
  }

  #acceptTunnel(socket: WebSocket): void {
    let authenticated: DesktopSeat | null = null
    let settled = false
    const timer = setTimeout(() => socket.close(1008, 'hello-timeout'), 5_000)
    timer.unref()
    const finishPending = (): void => {
      if (settled) return
      settled = true
      this.#pendingTunnels = Math.max(0, this.#pendingTunnels - 1)
    }
    socket.once('close', () => {
      clearTimeout(timer)
      finishPending()
      if (authenticated?.tunnel === socket) {
        authenticated.tunnel = null
        this.#invalidateWebAccess(authenticated.roomId)
        for (const stream of [...this.#streams.values()]) {
          const session = this.#sessions.get(stream.sessionDigest)
          if (session?.roomId === authenticated.roomId) this.#dropStream(stream)
        }
      }
    })
    socket.on('error', () => {})
    socket.on('message', (data, isBinary) => {
      if (!authenticated) {
        if (isBinary) {
          socket.close(1002, 'protocol-error')
          return
        }
        const parsed = parseDshTunnelControl(asBuffer(data).toString('utf8'))
        if (!parsed.ok || parsed.value.type !== 'dsh-tunnel-hello') {
          socket.close(1008, 'invalid-hello')
          return
        }
        const message = parsed.value
        const seat = this.#desktopSeats.get(message.roomId)
        if (
          !seat ||
          seat.tunnel ||
          seat.tokenExpiresAt <= this.dependencies.now() ||
          !secretMatches(seat.tokenDigest, message.dshSeatToken)
        ) {
          socket.close(1008, 'unauthorized')
          return
        }
        authenticated = seat
        seat.tunnel = socket
        seat.tunnelGeneration += 1
        clearTimeout(timer)
        finishPending()
        this.#invalidateWebAccess(seat.roomId)
        return
      }
      if (isBinary) this.#onTunnelBinary(authenticated, asBuffer(data))
      else this.#onTunnelControl(authenticated, asBuffer(data).toString('utf8'))
    })
  }

  #onTunnelControl(seat: DesktopSeat, text: string): void {
    const parsed = parseDshTunnelControl(text)
    if (!parsed.ok || parsed.value.type === 'dsh-tunnel-hello') {
      this.#protocolError(seat)
      return
    }
    const message = parsed.value
    if (message.type === 'ping') {
      this.#sendControl(seat, { type: 'pong' })
      return
    }
    if (message.type === 'pong') return
    if (message.type === 'credit') {
      const stream = this.#streams.get(message.streamId)
      if (!stream && this.#usedStreamIds.has(message.streamId)) return
      if (
        !stream ||
        stream.kind !== 'http' ||
        stream.requestFlow.credit + message.bytes > DSH_TUNNEL_LIMITS.streamBufferBytes
      ) {
        this.#protocolError(seat)
        return
      }
      stream.requestFlow.credit += message.bytes
      this.#drainRequest(stream)
      return
    }
    const stream = 'streamId' in message ? this.#streams.get(message.streamId) : undefined
    if (!stream) {
      // Stream ids are never reused. Once a stream is removed, frames already
      // queued by Desktop may still arrive; discard those known tombstones but
      // keep treating never-issued ids as a protocol violation.
      if ('streamId' in message && this.#usedStreamIds.has(message.streamId)) return
      this.#protocolError(seat)
      return
    }
    switch (message.type) {
      case 'http-head':
        if (stream.kind !== 'http' || stream.headReceived) return this.#protocolError(seat)
        this.#handleHttpHead(stream, message.status, message.headers)
        return
      case 'http-end':
        if (stream.kind !== 'http' || !stream.headReceived) return this.#protocolError(seat)
        stream.response.end()
        this.#dropStream(stream, false)
        return
      case 'http-abort':
        if (stream.kind !== 'http') return this.#protocolError(seat)
        this.#recordError('upstream')
        if (!stream.headReceived && !stream.response.headersSent) empty(stream.response, 502)
        else stream.response.destroy()
        this.#dropStream(stream, false)
        return
      case 'ws-open-ok':
        if (stream.kind !== 'ws' || stream.opened) return this.#protocolError(seat)
        stream.opened = true
        this.#touchStream(stream, 90_000)
        return
      case 'ws-open-reject':
        if (stream.kind !== 'ws' || stream.opened) return this.#protocolError(seat)
        this.#recordError('upstream')
        stream.socket.close(1013, 'upstream-rejected')
        this.#dropStream(stream, false)
        return
      case 'ws-close':
        if (stream.kind !== 'ws') return this.#protocolError(seat)
        stream.socket.close(message.code, message.reason)
        this.#dropStream(stream, false)
        return
      default:
        this.#protocolError(seat)
    }
  }

  #onTunnelBinary(seat: DesktopSeat, data: Buffer): void {
    const parsed = parseDshTunnelBinary(data)
    if (!parsed.ok || parsed.value.kind === 3) {
      this.#protocolError(seat)
      return
    }
    const frame = parsed.value
    const stream = this.#streams.get(frame.streamId)
    if (!stream && this.#usedStreamIds.has(frame.streamId)) return
    if (!stream) {
      this.#protocolError(seat)
      return
    }
    if (stream.kind === 'http') {
      if (
        frame.kind !== 1 ||
        !stream.headReceived ||
        frame.sequence !== stream.responseSequence ||
        frame.payload.byteLength > stream.responseCredit ||
        (!stream.sse && stream.responseBytes + frame.payload.byteLength > DSH_TUNNEL_LIMITS.responseBodyBytes)
      ) {
        this.#protocolError(seat)
        return
      }
      const roomId = this.#sessions.get(stream.sessionDigest)?.roomId
      if (
        stream.responseUnconsumed + frame.payload.byteLength > DSH_TUNNEL_LIMITS.streamBufferBytes ||
        (roomId && this.#roomUnconsumed(roomId) + frame.payload.byteLength > DSH_TUNNEL_LIMITS.roomBufferBytes)
      ) {
        this.#recordError('buffer')
        this.#abortHttp(stream, 'buffer-limit', 502)
        return
      }
      this.#bytesDesktopToPublic += frame.payload.byteLength
      stream.responseSequence += 1
      stream.responseBytes += frame.payload.byteLength
      stream.responseCredit -= frame.payload.byteLength
      stream.responseUnconsumed += frame.payload.byteLength
      this.#touchStream(stream, stream.sse ? 90_000 : 60_000)
      stream.response.write(frame.payload, () => {
        if (stream.responseUnconsumed < frame.payload.byteLength) return
        stream.responseUnconsumed -= frame.payload.byteLength
        stream.responseCredit += frame.payload.byteLength
        this.#sendControl(seat, { type: 'credit', streamId: stream.id, bytes: frame.payload.byteLength })
      })
      return
    }
    if (
      frame.kind !== 2 ||
      frame.sequence !== stream.sequence ||
      !stream.opened ||
      frame.payload.byteLength > stream.credit
    ) {
      this.#protocolError(seat)
      return
    }
    const roomId = this.#sessions.get(stream.sessionDigest)?.roomId
    if (
      stream.unconsumed + frame.payload.byteLength > DSH_TUNNEL_LIMITS.streamBufferBytes ||
      (roomId && this.#roomUnconsumed(roomId) + frame.payload.byteLength > DSH_TUNNEL_LIMITS.roomBufferBytes)
    ) {
      this.#recordError('buffer')
      this.#sendControl(seat, { type: 'ws-close', streamId: stream.id, code: 1013, reason: 'buffer-limit' })
      this.#dropStream(stream, false)
      return
    }
    this.#bytesDesktopToPublic += frame.payload.byteLength
    stream.sequence += 1
    stream.credit -= frame.payload.byteLength
    stream.unconsumed += frame.payload.byteLength
    this.#touchStream(stream, 90_000)
    if (stream.socket.readyState !== WebSocket.OPEN) return
    stream.socket.send(frame.payload, { binary: false }, () => {
      if (stream.unconsumed < frame.payload.byteLength) return
      stream.unconsumed -= frame.payload.byteLength
      stream.credit += frame.payload.byteLength
      this.#sendControl(seat, { type: 'credit', streamId: stream.id, bytes: frame.payload.byteLength })
    })
  }

  #handleHttpHead(stream: HttpStream, status: number, rawHeaders: DshTunnelHeaders): void {
    const headers = responseHeaders(rawHeaders, this.#publicOrigin!)
    if (!headers) {
      this.#recordError('upstream')
      this.#abortHttp(stream, 'invalid-response')
      return
    }
    const url = new URL(stream.request.url ?? '/', this.#publicOrigin!)
    const revisionedStatic =
      url.searchParams.has('rev') &&
      (url.pathname.startsWith('/assets/') ||
        (url.pathname.startsWith('/plugins/') && url.pathname !== '/plugins/events'))
    headers['cache-control'] = revisionedStatic
      ? 'private, max-age=31536000, immutable'
      : stream.sse
        ? 'no-cache'
        : 'no-store'
    stream.headReceived = true
    stream.response.writeHead(status, headers)
    this.#touchStream(stream, stream.sse ? 90_000 : 60_000)
  }

  #queueRequestBody(stream: HttpStream, payload: Buffer): void {
    if (this.#streams.get(stream.id) !== stream) return
    stream.request.pause()
    stream.requestFlow.bytes += payload.byteLength
    const roomQueued = [...this.#streams.values()].reduce(
      (total, candidate) => {
        if (candidate.kind !== 'http') return total
        const candidateRoom = this.#sessions.get(candidate.sessionDigest)?.roomId
        const streamRoom = this.#sessions.get(stream.sessionDigest)?.roomId
        return candidateRoom === streamRoom ? total + candidate.requestFlow.queuedBytes : total
      },
      0
    )
    if (
      stream.requestFlow.bytes > DSH_TUNNEL_LIMITS.requestBodyBytes ||
      stream.requestFlow.queuedBytes + payload.byteLength > DSH_TUNNEL_LIMITS.streamBufferBytes ||
      roomQueued + payload.byteLength > DSH_TUNNEL_LIMITS.roomBufferBytes
    ) {
      this.#recordError('buffer')
      this.#abortHttp(stream, 'request-too-large', 413)
      return
    }
    stream.requestFlow.queued.push(payload)
    stream.requestFlow.queuedBytes += payload.byteLength
    this.#drainRequest(stream)
  }

  #drainRequest(stream: HttpStream): void {
    const seat = this.#desktopSeats.get(this.#sessions.get(stream.sessionDigest)?.roomId ?? '')
    if (!seat || this.#streams.get(stream.id) !== stream) return
    while (stream.requestFlow.credit > 0 && stream.requestFlow.queued.length > 0) {
      const first = stream.requestFlow.queued[0]!
      const length = Math.min(first.byteLength, stream.requestFlow.credit, DSH_TUNNEL_LIMITS.framePayloadBytes)
      const payload = first.subarray(0, length)
      this.#sendBinary(seat, 1, stream.id, stream.requestFlow.sequence++, payload)
      stream.requestFlow.credit -= length
      stream.requestFlow.queuedBytes -= length
      if (length === first.byteLength) stream.requestFlow.queued.shift()
      else stream.requestFlow.queued[0] = first.subarray(length)
    }
    if (stream.requestFlow.queued.length === 0) {
      if (!stream.requestFlow.ended) stream.request.resume()
      if (stream.requestFlow.ended && !stream.requestFlow.endSent) {
        stream.requestFlow.endSent = true
        this.#sendControl(seat, { type: 'http-end', streamId: stream.id })
      }
    }
  }

  #openPublicWebSocket(
    session: WebSession,
    seat: DesktopSeat,
    socket: WebSocket,
    path: string,
    headers: DshTunnelHeaders
  ): void {
    const id = this.#allocateStreamId()
    const stream: WebSocketStream = {
      kind: 'ws',
      id,
      sessionDigest: session.digest,
      socket,
      sequence: 0,
      credit: DSH_TUNNEL_LIMITS.initialCreditBytes,
      unconsumed: 0,
      opened: false,
      timer: null
    }
    this.#streams.set(id, stream)
    session.streams.add(id)
    this.#touchStream(stream, 10_000)
    socket.on('message', () => {
      this.#sendControl(seat, { type: 'ws-close', streamId: id, code: 1008, reason: 'downstream-data-forbidden' })
      socket.close(1008, 'downstream-data-forbidden')
    })
    socket.once('close', (code, reason) => {
      if (this.#streams.get(id) !== stream) return
      this.#sendControl(seat, {
        type: 'ws-close',
        streamId: id,
        code: normalizeDshWebSocketCloseCode(code),
        ...(reason.byteLength ? { reason: reason.toString('utf8').slice(0, 123) } : {})
      })
      this.#dropStream(stream, false)
    })
    socket.on('error', () => {})
    this.#sendControl(seat, { type: 'ws-open', streamId: id, path, headers })
  }

  #abortHttp(stream: HttpStream, reason: string, status = 502): void {
    const session = this.#sessions.get(stream.sessionDigest)
    const seat = session ? this.#desktopSeats.get(session.roomId) : null
    if (seat) this.#sendControl(seat, { type: 'http-abort', streamId: stream.id, reason })
    if (!stream.response.headersSent) empty(stream.response, status)
    else stream.response.destroy()
    this.#dropStream(stream, false)
  }

  #allocateStreamId(): number {
    for (let attempts = 0; attempts < 0xffff_ffff; attempts += 1) {
      const id = this.#nextStreamId
      this.#nextStreamId = id === 0xffff_ffff ? 1 : id + 1
      if (!this.#usedStreamIds.has(id)) {
        this.#usedStreamIds.add(id)
        return id
      }
    }
    throw new Error('DSH tunnel stream id space exhausted')
  }

  #sendControl(seat: DesktopSeat, message: DshTunnelControl): void {
    if (seat.tunnel?.readyState === WebSocket.OPEN) {
      seat.tunnel.send(encodeDshTunnelControl(message))
    }
  }

  #sendBinary(
    seat: DesktopSeat,
    kind: 1 | 2,
    streamId: number,
    sequence: number,
    payload: Buffer
  ): void {
    if (seat.tunnel?.readyState === WebSocket.OPEN) {
      seat.tunnel.send(encodeDshTunnelBinary({ kind, streamId, sequence, payload }))
      this.#bytesPublicToDesktop += payload.byteLength
    }
  }

  #protocolError(seat: DesktopSeat): void {
    this.#recordError('protocol')
    seat.tunnel?.close(1002, 'protocol-error')
  }

  #recordError(category: DshErrorCategory): void {
    this.#errors[category] += 1
  }

  #dropDesktopSeat(seat: DesktopSeat): void {
    this.#desktopSeats.delete(seat.roomId)
    seat.tunnel?.close(1000, 'main-seat-closed')
    seat.tunnel = null
    this.#invalidateWebAccess(seat.roomId)
  }

  #invalidateWebAccess(roomId: string): void {
    for (const [key, ticket] of this.#tickets) {
      if (ticket.roomId === roomId) this.#tickets.delete(key)
    }
    for (const session of [...this.#sessions.values()]) {
      if (session.roomId === roomId) this.#dropSession(session)
    }
  }

  #dropSession(session: WebSession): void {
    for (const id of [...session.streams]) {
      const stream = this.#streams.get(id)
      if (stream) this.#dropStream(stream)
    }
    this.#sessions.delete(session.digest)
    session.streams.clear()
  }

  #dropStream(stream: GatewayStream, notifyDesktop = true): void {
    if (this.#streams.get(stream.id) !== stream) return
    if (stream.timer) clearTimeout(stream.timer)
    stream.timer = null
    this.#streams.delete(stream.id)
    this.#sessions.get(stream.sessionDigest)?.streams.delete(stream.id)
    const session = this.#sessions.get(stream.sessionDigest)
    const seat = session ? this.#desktopSeats.get(session.roomId) : null
    if (notifyDesktop && seat) {
      if (stream.kind === 'http') {
        this.#sendControl(seat, { type: 'http-abort', streamId: stream.id, reason: 'session-closed' })
      } else {
        this.#sendControl(seat, { type: 'ws-close', streamId: stream.id, code: 1001, reason: 'session-closed' })
      }
    }
    if (stream.kind === 'http') {
      stream.request.destroy()
      if (!stream.response.writableEnded) stream.response.destroy()
    } else if (
      stream.socket.readyState === WebSocket.OPEN ||
      stream.socket.readyState === WebSocket.CONNECTING
    ) {
      stream.socket.close(1001, 'session-closed')
    }
  }

  #pruneExpired(): void {
    const now = this.dependencies.now()
    for (const [key, ticket] of this.#tickets) {
      if (ticket.expiresAt <= now) this.#tickets.delete(key)
    }
    for (const session of [...this.#sessions.values()]) {
      if (session.expiresAt <= now) this.#dropSession(session)
    }
  }

  #activeTunnelCount(): number {
    let count = 0
    for (const seat of this.#desktopSeats.values()) {
      if (seat.tunnel?.readyState === WebSocket.OPEN) count += 1
    }
    return count
  }

  #roomUnconsumed(roomId: string): number {
    let total = 0
    for (const stream of this.#streams.values()) {
      const session = this.#sessions.get(stream.sessionDigest)
      if (session?.roomId !== roomId) continue
      total += stream.kind === 'http' ? stream.responseUnconsumed : stream.unconsumed
    }
    return total
  }

  #touchStream(stream: GatewayStream, milliseconds: number): void {
    if (stream.timer) clearTimeout(stream.timer)
    stream.timer = setTimeout(() => {
      if (this.#streams.get(stream.id) !== stream) return
      this.#recordError('timeout')
      if (stream.kind === 'http') {
        this.#abortHttp(stream, 'timeout', 504)
        return
      }
      const session = this.#sessions.get(stream.sessionDigest)
      const seat = session ? this.#desktopSeats.get(session.roomId) : null
      if (seat) {
        this.#sendControl(seat, { type: 'ws-close', streamId: stream.id, code: 1001, reason: 'timeout' })
      }
      this.#dropStream(stream, false)
    }, milliseconds)
    stream.timer.unref()
  }
}
