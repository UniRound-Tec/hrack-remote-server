import {
  createHash,
  createHmac,
  randomBytes as systemRandomBytes,
  timingSafeEqual
} from 'node:crypto'
import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { extname, resolve, sep } from 'node:path'

import WebSocket, { WebSocketServer, type RawData } from 'ws'

import { DshGateway, type DshGatewayMetrics } from '../dsh/DshGateway.js'
import {
  RelayCore,
  type DesiredRoom,
  type RelayEffect
} from '../relay/RelayCore.js'
import type { RelayConfig } from '../relay/relay-config.js'

export interface SafeLogRecord {
  event: string
  connectionId?: string
  role?: 'desktop' | 'phone'
  result?: string
  frameBytes?: number
  ipKey?: string
  at: string
}

export interface RelayServerOptions {
  config: RelayConfig
  logger?: (record: SafeLogRecord) => void
  logSecret?: Uint8Array
  webRoot?: string
  lifecycleLogs?: boolean
}

export interface RunningRelayServer {
  listen(port: number, host?: string): Promise<void>
  close(): Promise<void>
  metrics(): { dsh: DshGatewayMetrics }
}

const NO_STORE = { 'cache-control': 'no-store' }
const HTML_SECURITY_HEADERS = {
  ...NO_STORE,
  'content-security-policy':
    "default-src 'none'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff'
}

function json(
  response: ServerResponse,
  status: number,
  body: unknown
): void {
  response.writeHead(status, {
    ...NO_STORE,
    'content-type': 'application/json; charset=utf-8'
  })
  response.end(JSON.stringify(body))
}

function empty(response: ServerResponse, status: number): void {
  response.writeHead(status, NO_STORE)
  response.end()
}

async function readJsonObject(request: IncomingMessage): Promise<Record<string, never>> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += value.byteLength
    if (length > 1_024) throw new Error('body-too-large')
    chunks.push(value)
  }
  const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).length !== 0
  ) {
    throw new Error('invalid-body')
  }
  return parsed as Record<string, never>
}

function bearerToken(request: IncomingMessage): string | null {
  const authorization = request.headers.authorization
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.slice('Bearer '.length)
  return token.length > 0 ? token : null
}

async function readJsonValue(
  request: IncomingMessage,
  maxBytes: number
): Promise<unknown> {
  const chunks: Buffer[] = []
  let length = 0
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    length += value.byteLength
    if (length > maxBytes) throw new Error('body-too-large')
    chunks.push(value)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown
}

function serviceTokenMatches(
  actual: string | null,
  expected: string | null
): boolean {
  if (actual === null || expected === null) return false
  const actualDigest = createHash('sha256').update(actual).digest()
  const expectedDigest = createHash('sha256').update(expected).digest()
  return timingSafeEqual(actualDigest, expectedDigest)
}

function decodeBase64Url(value: unknown, bytes: number): Buffer | null {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  const decoded = Buffer.from(value, 'base64url')
  if (decoded.byteLength !== bytes || decoded.toString('base64url') !== value) {
    return null
  }
  return decoded
}

export function createRelayServer(options: RelayServerOptions): RunningRelayServer {
  const { config } = options
  const logger = options.logger ?? (() => {})
  const logSecret = Buffer.from(options.logSecret ?? systemRandomBytes(32))
  const instanceId = systemRandomBytes(16).toString('base64url')
  let synchronized = false
  let appliedRevision = -1
  let appliedSnapshotHash: string | null = null
  const sockets = new Map<string, WebSocket>()
  const drainTimers = new Set<NodeJS.Timeout>()
  const dshGateway = new DshGateway(config)
  const core = new RelayCore(config, {
    now: Date.now,
    randomBytes: (size) => systemRandomBytes(size),
    decorateHelloOk: (input) => dshGateway.decorateHelloOk(input),
    issueDshTicket: (input) => dshGateway.issueTicket(input),
    observeDesktopMessage: (input) => dshGateway.observeDesktopMessage(input),
    onConnectionClosed: (input) => dshGateway.onConnectionClosed(input),
    onRoomRevoked: (roomId) => dshGateway.revokeRoom(roomId)
  })
  const webRoot = resolve(
    options.webRoot ??
      (existsSync(resolve(process.cwd(), 'dist/web/index.html'))
        ? resolve(process.cwd(), 'dist/web')
        : resolve(process.cwd(), 'src/web'))
  )

  const serveIndex = async (
    response: ServerResponse,
    page: 'generate' | 'join' | 'demo',
    roomAvailable: boolean
  ): Promise<void> => {
    const template = await readFile(resolve(webRoot, 'index.html'), 'utf8')
    const html = template
      .replaceAll('__HRACK_BASE__', config.basePath)
      .replaceAll('__HRACK_PAGE__', page)
      .replaceAll('__HRACK_ROOM_AVAILABLE__', roomAvailable ? '1' : '0')
    response.writeHead(200, {
      ...HTML_SECURITY_HEADERS,
      'content-type': 'text/html; charset=utf-8'
    })
    response.end(html)
  }

  const serveAsset = async (
    response: ServerResponse,
    relativePath: string
  ): Promise<boolean> => {
    if (
      relativePath.includes('..') ||
      relativePath.startsWith('/') ||
      !/^(?:assets\/[^/]+|app\.js|style\.css)$/.test(relativePath)
    ) {
      return false
    }
    const filename = resolve(webRoot, relativePath)
    if (!filename.startsWith(`${webRoot}${sep}`) || !existsSync(filename)) return false
    const contentTypes: Record<string, string> = {
      '.js': 'text/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png'
    }
    response.writeHead(200, {
      ...NO_STORE,
      'content-type': contentTypes[extname(filename)] ?? 'application/octet-stream',
      'x-content-type-options': 'nosniff'
    })
    response.end(await readFile(filename))
    return true
  }

  const safeIpKey = (request: IncomingMessage): string => {
    const address = request.socket.remoteAddress ?? 'unknown'
    const day = new Date().toISOString().slice(0, 10)
    return createHmac('sha256', logSecret)
      .update(day)
      .update('\0')
      .update(address)
      .digest('hex')
      .slice(0, 24)
  }

  const log = (record: Omit<SafeLogRecord, 'at'>): void => {
    logger({ ...record, at: new Date().toISOString() })
  }

  const execute = (effects: RelayEffect[]): void => {
    for (const effect of effects) {
      const socket = sockets.get(effect.connectionId)
      if (!socket) continue
      if (effect.kind === 'send') {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(effect.message))
        }
        continue
      }
      if (effect.kind === 'ping') {
        if (socket.readyState === WebSocket.OPEN) socket.ping()
        continue
      }
      if (effect.kind === 'close') {
        if (effect.reason === 'pong-timeout') {
          socket.terminate()
        } else if (
          socket.readyState === WebSocket.OPEN ||
          socket.readyState === WebSocket.CONNECTING
        ) {
          socket.close(effect.code, effect.reason)
        }
        continue
      }

      if (socket.readyState !== WebSocket.OPEN) {
        socket.terminate()
        continue
      }
      let settled = false
      const finish = (): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        drainTimers.delete(timer)
        if (socket.readyState === WebSocket.OPEN) {
          socket.close(effect.code, effect.reason)
        }
      }
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        drainTimers.delete(timer)
        socket.terminate()
      }, effect.deadlineMs)
      timer.unref()
      drainTimers.add(timer)
      socket.send(JSON.stringify(effect.message), finish)
    }
  }

  const base = config.basePath
  const roomApiPrefix = `${base}/v1/rooms/`

  const httpServer = createServer(async (request, response) => {
    try {
      if (dshGateway.isPublicHost(request)) {
        await dshGateway.handlePublicHttp(request, response)
        return
      }
      const url = new URL(request.url ?? '/', 'http://relay.invalid')
      const path = url.pathname
      if (request.method === 'GET' && path === `${base}/healthz`) {
        json(response, 200, { ok: true })
        return
      }

      if (request.method === 'GET' && path === `${base}/v1/system/state`) {
        if (!serviceTokenMatches(bearerToken(request), config.serviceToken)) {
          empty(response, 401)
          return
        }
        json(response, 200, { instanceId, synchronized, appliedRevision })
        return
      }

      if (request.method === 'PUT' && path === `${base}/v1/system/rooms`) {
        if (!serviceTokenMatches(bearerToken(request), config.serviceToken)) {
          empty(response, 401)
          return
        }
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          empty(response, 415)
          return
        }
        const body = await readJsonValue(
          request,
          Math.max(1_024, config.maxRooms * 160)
        )
        if (
          typeof body !== 'object' ||
          body === null ||
          Array.isArray(body)
        ) {
          empty(response, 400)
          return
        }
        const bodyKeys = Object.keys(body).sort()
        if (
          bodyKeys.length !== 2 ||
          bodyKeys[0] !== 'revision' ||
          bodyKeys[1] !== 'rooms' ||
          !('revision' in body) ||
          !('rooms' in body) ||
          !Number.isSafeInteger(body.revision) ||
          Number(body.revision) < 0 ||
          !Array.isArray(body.rooms)
        ) {
          empty(response, 400)
          return
        }
        if (body.rooms.length > config.maxRooms) {
          json(response, 503, { error: 'CAPACITY' })
          return
        }
        const desiredRooms: DesiredRoom[] = []
        const roomIds = new Set<string>()
        for (const item of body.rooms) {
          if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            empty(response, 400)
            return
          }
          const keys = Object.keys(item).sort()
          if (
            keys.length !== 2 ||
            keys[0] !== 'revokeDigest' ||
            keys[1] !== 'roomId' ||
            !('roomId' in item) ||
            !('revokeDigest' in item)
          ) {
            empty(response, 400)
            return
          }
          const roomIdBytes = decodeBase64Url(item.roomId, 16)
          const revokeDigest = decodeBase64Url(item.revokeDigest, 32)
          if (
            roomIdBytes === null ||
            revokeDigest === null ||
            typeof item.roomId !== 'string' ||
            roomIds.has(item.roomId)
          ) {
            empty(response, 400)
            return
          }
          roomIds.add(item.roomId)
          desiredRooms.push({ roomId: item.roomId, revokeDigest })
        }
        desiredRooms.sort((left, right) =>
          left.roomId.localeCompare(right.roomId)
        )
        const revision = Number(body.revision)
        const snapshotHash = createHash('sha256')
          .update(
            JSON.stringify(
              desiredRooms.map((room) => ({
                roomId: room.roomId,
                revokeDigest: room.revokeDigest.toString('base64url')
              }))
            )
          )
          .digest('base64url')
        if (synchronized && revision < appliedRevision) {
          json(response, 409, { error: 'STALE_REVISION' })
          return
        }
        if (
          synchronized &&
          revision === appliedRevision &&
          snapshotHash !== appliedSnapshotHash
        ) {
          json(response, 409, { error: 'REVISION_CONFLICT' })
          return
        }
        const result = core.reconcileRooms(desiredRooms)
        if (!result.ok) {
          json(response, 409, { error: 'ROOM_CREDENTIAL_CONFLICT' })
          return
        }
        execute(result.effects)
        appliedRevision = revision
        appliedSnapshotHash = snapshotHash
        synchronized = true
        json(response, 200, {
          instanceId,
          appliedRevision,
          activeRoomCount: desiredRooms.length
        })
        return
      }

      if (request.method === 'POST' && path === `${base}/v1/rooms`) {
        const serviceAuthenticated = serviceTokenMatches(
          bearerToken(request),
          config.serviceToken
        )
        if (!serviceAuthenticated && !config.enableDevCreate) {
          empty(response, 401)
          return
        }
        if (serviceAuthenticated && !synchronized) {
          response.writeHead(503, { ...NO_STORE, 'retry-after': '5' })
          response.end()
          return
        }
        const origin = request.headers.origin
        if (origin !== undefined) {
          let normalized: string
          try {
            normalized = new URL(origin).origin
          } catch {
            empty(response, 403)
            return
          }
          if (normalized !== config.publicOrigin) {
            empty(response, 403)
            return
          }
        }
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          empty(response, 415)
          return
        }
        await readJsonObject(request)
        const result = core.createRoom({
          ipKey: safeIpKey(request),
          bypassRateLimit: serviceAuthenticated
        })
        if (!result.ok) {
          empty(response, result.reason === 'rate-limited' ? 429 : 503)
          return
        }
        json(response, 201, {
          roomId: result.roomId,
          joinUrl: result.joinUrl,
          revokeToken: result.revokeToken
        })
        if (options.lifecycleLogs) {
          log({ event: 'room-create', result: 'created', ipKey: safeIpKey(request) })
        }
        return
      }

      if (request.method === 'GET' && path.startsWith(roomApiPrefix)) {
        if (!serviceTokenMatches(bearerToken(request), config.serviceToken)) {
          empty(response, 401)
          return
        }
        const roomId = decodeURIComponent(path.slice(roomApiPrefix.length))
        if (
          decodeBase64Url(roomId, 16) === null ||
          core.roomAvailability(roomId) !== 'open'
        ) {
          empty(response, 404)
          return
        }
        json(response, 200, { exists: true })
        return
      }

      if (request.method === 'DELETE' && path.startsWith(roomApiPrefix)) {
        const roomId = decodeURIComponent(path.slice(roomApiPrefix.length))
        if (roomId.length === 0 || roomId.includes('/')) {
          empty(response, 404)
          return
        }
        const token = bearerToken(request)
        if (token === null) {
          empty(response, 404)
          return
        }
        const result = core.revokeRoom({ roomId, token })
        if (result.status === 'not-found') {
          empty(response, 404)
          return
        }
        execute(result.effects)
        empty(response, 204)
        log({ event: 'room-revoke', result: 'revoked', ipKey: safeIpKey(request) })
        return
      }

      const rootPath = base === '' ? '/' : `${base}/`
      if (request.method === 'GET' && path === rootPath) {
        if (config.enableDevCreate) {
          await serveIndex(response, 'generate', false)
        } else {
          empty(response, 404)
        }
        return
      }

      const demoPath = `${base}/demo`
      const demoPrefix = `${demoPath}/`
      if (
        !config.enableDevCreate &&
        request.method === 'GET' &&
        (path === demoPath || path.startsWith(demoPrefix))
      ) {
        empty(response, 404)
        return
      }
      if (
        config.enableDevCreate &&
        request.method === 'GET' &&
        (path === demoPath || path === demoPrefix)
      ) {
        await serveIndex(response, 'demo', true)
        return
      }

      if (
        config.enableDevCreate &&
        request.method === 'GET' &&
        path.startsWith(demoPrefix)
      ) {
        const relativePath = path.slice(demoPrefix.length)
        if (await serveAsset(response, relativePath)) return
        const roomId = decodeURIComponent(relativePath)
        if (roomId.length > 0 && !roomId.includes('/')) {
          const available = core.roomAvailability(roomId) === 'open'
          await serveIndex(response, 'demo', available)
          return
        }
      }

      if (request.method === 'GET' && path.startsWith(`${base}/`)) {
        const relativePath = path.slice(base.length + 1)
        if (await serveAsset(response, relativePath)) return
        const roomId = decodeURIComponent(relativePath)
        if (roomId.length > 0 && !roomId.includes('/')) {
          if (!synchronized && !config.enableDevCreate) {
            response.writeHead(503, { ...NO_STORE, 'retry-after': '5' })
            response.end()
            return
          }
          const available = core.roomAvailability(roomId) === 'open'
          await serveIndex(response, 'join', available)
          return
        }
      }

      empty(response, 404)
    } catch {
      empty(response, 400)
    }
  })

  const webSocketServer = new WebSocketServer({
    noServer: true,
    clientTracking: false,
    maxPayload: config.maxFrameBytes,
    perMessageDeflate: false
  })

  httpServer.on('upgrade', (request, socket, head) => {
    if (dshGateway.handleUpgrade(request, socket, head, `${base}/v1/dsh-tunnel`)) {
      return
    }
    let path: string
    try {
      path = new URL(request.url ?? '/', 'http://relay.invalid').pathname
    } catch {
      socket.destroy()
      return
    }
    if (path !== `${base}/v1/ws`) {
      socket.destroy()
      return
    }
    webSocketServer.handleUpgrade(request, socket, head, (webSocket) => {
      webSocketServer.emit('connection', webSocket, request)
    })
  })

  webSocketServer.on('connection', (socket, request) => {
    if (!synchronized && !config.enableDevCreate) {
      socket.close(1013, 'restoring')
      return
    }
    const connectionId = systemRandomBytes(12).toString('base64url')
    sockets.set(connectionId, socket)
    execute(
      core.handleSocket({
        type: 'open',
        connectionId,
        ipKey: safeIpKey(request)
      })
    )
    if (options.lifecycleLogs) {
      log({ event: 'socket-open', connectionId, ipKey: safeIpKey(request) })
    }

    socket.on('pong', () => {
      execute(core.handleSocket({ type: 'pong', connectionId }))
    })
    socket.on('message', (data: RawData, isBinary: boolean) => {
      if (isBinary) {
        socket.close(1003, 'text-only')
        return
      }
      const text = data.toString()
      execute(
        core.handleSocket({
          type: 'text',
          connectionId,
          text,
          bufferedAmount: (id) => sockets.get(id)?.bufferedAmount ?? 0
        })
      )
    })
    socket.on('close', () => {
      sockets.delete(connectionId)
      execute(core.handleSocket({ type: 'close', connectionId }))
      if (options.lifecycleLogs) {
        log({ event: 'socket-close', connectionId, result: 'closed' })
      }
    })
    socket.on('error', () => {
      log({ event: 'socket-error', connectionId, result: 'transport-error' })
    })
  })

  const tickEvery = Math.max(
    10,
    Math.min(
      1_000,
      config.helloDeadlineMs,
      config.pingIntervalMs,
      config.pongTimeoutMs
    ) / 2
  )
  const ticker = setInterval(() => execute(core.handleSocket({ type: 'tick' })), tickEvery)
  ticker.unref()

  let closePromise: Promise<void> | null = null

  return {
    listen: (port, host = '127.0.0.1') =>
      new Promise<void>((resolve, reject) => {
        httpServer.once('error', reject)
        httpServer.listen(port, host, () => {
          httpServer.off('error', reject)
          resolve()
        })
      }),
    metrics: () => ({ dsh: dshGateway.metrics() }),
    close: () => {
      if (closePromise) return closePromise
      closePromise = (async () => {
        clearInterval(ticker)
        for (const timer of drainTimers) clearTimeout(timer)
        drainTimers.clear()
        for (const socket of sockets.values()) socket.terminate()
        sockets.clear()
        dshGateway.close()
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => (error ? reject(error) : resolve()))
        })
        webSocketServer.close()
      })()
      return closePromise
    }
  }
}
