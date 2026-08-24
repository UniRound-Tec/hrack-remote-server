export interface RateLimitConfig {
  burst: number
  perMinute: number
}

export interface RelayConfig {
  publicOrigin: string
  dshPublicOrigin: string | null
  basePath: string
  allowInsecureLoopback: boolean
  serviceToken: string | null
  enableDevCreate: boolean
  maxRooms: number
  maxConnections: number
  maxRateLimitKeys: number
  maxFrameBytes: number
  maxRoomBufferedBytes: number
  createRate: RateLimitConfig
  helloRate: RateLimitConfig
  helloDeadlineMs: number
  pingIntervalMs: number
  pongTimeoutMs: number
  revokeDrainMs: number
  violationWindowMs: number
  violationLimit: number
  dshSeatTokenTtlMs: number
  dshTicketTtlMs: number
  dshSessionTtlMs: number
  maxDshTunnels: number
  maxDshSessions: number
}

const defaults: RelayConfig = {
  publicOrigin: 'https://relay.example',
  dshPublicOrigin: null,
  basePath: '',
  allowInsecureLoopback: false,
  serviceToken: null,
  enableDevCreate: false,
  maxRooms: 10_000,
  maxConnections: 20_000,
  maxRateLimitKeys: 50_000,
  maxFrameBytes: 1_048_576,
  maxRoomBufferedBytes: 1_048_576,
  createRate: { burst: 3, perMinute: 10 },
  helloRate: { burst: 5, perMinute: 20 },
  helloDeadlineMs: 5_000,
  pingIntervalMs: 30_000,
  pongTimeoutMs: 10_000,
  revokeDrainMs: 500,
  violationWindowMs: 10_000,
  violationLimit: 3,
  dshSeatTokenTtlMs: 10 * 60_000,
  dshTicketTtlMs: 30_000,
  dshSessionTtlMs: 12 * 60 * 60 * 1_000,
  maxDshTunnels: 1_000,
  maxDshSessions: 10_000
}

export function defaultRelayConfig(
  overrides: Partial<RelayConfig> = {}
): RelayConfig {
  const config = { ...defaults, ...overrides }
  return validateRelayConfig(config)
}

function positiveInteger(name: string, value: number): number {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

function envInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const text = env[name]
  if (text === undefined) return fallback
  return positiveInteger(name, Number(text))
}

export function normalizeBasePath(value: string): string {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '/') return ''
  if (!trimmed.startsWith('/') || trimmed.endsWith('/') || trimmed.includes('..')) {
    throw new Error('BASE_PATH must be empty or an absolute path without a trailing slash')
  }
  if (!/^\/(?:[A-Za-z0-9._~-]+\/)*[A-Za-z0-9._~-]+$/.test(trimmed)) {
    throw new Error('BASE_PATH contains unsupported characters')
  }
  return trimmed
}

export function validateRelayConfig(input: RelayConfig): RelayConfig {
  const publicUrl = new URL(input.publicOrigin)
  if (publicUrl.pathname !== '/' || publicUrl.search || publicUrl.hash) {
    throw new Error('PUBLIC_ORIGIN must contain only scheme and authority')
  }
  const loopback = ['localhost', '127.0.0.1', '::1'].includes(publicUrl.hostname)
  if (publicUrl.protocol !== 'https:' && !(input.allowInsecureLoopback && loopback)) {
    throw new Error('PUBLIC_ORIGIN must be HTTPS outside explicit loopback development')
  }
  if (
    input.serviceToken !== null &&
    Buffer.byteLength(input.serviceToken, 'utf8') < 32
  ) {
    throw new Error('RELAY_SERVICE_TOKEN must be at least 32 bytes')
  }
  if (input.enableDevCreate && !loopback) {
    throw new Error('ENABLE_DEV_CREATE requires a loopback PUBLIC_ORIGIN')
  }
  let dshPublicOrigin: string | null = null
  if (input.dshPublicOrigin !== null) {
    const dshUrl = new URL(input.dshPublicOrigin)
    if (
      dshUrl.protocol !== 'https:' ||
      dshUrl.origin !== input.dshPublicOrigin ||
      dshUrl.pathname !== '/' ||
      dshUrl.search ||
      dshUrl.hash ||
      dshUrl.username ||
      dshUrl.password
    ) {
      throw new Error('DSH_PUBLIC_ORIGIN must be a canonical HTTPS origin')
    }
    if (dshUrl.origin === publicUrl.origin) {
      throw new Error('DSH_PUBLIC_ORIGIN must use an independent origin')
    }
    dshPublicOrigin = dshUrl.origin
  }
  const dshSeatTokenTtlMs = positiveInteger(
    'DSH_SEAT_TOKEN_TTL_MS',
    input.dshSeatTokenTtlMs
  )
  const dshTicketTtlMs = positiveInteger('DSH_TICKET_TTL_MS', input.dshTicketTtlMs)
  const dshSessionTtlMs = positiveInteger('DSH_SESSION_TTL_MS', input.dshSessionTtlMs)
  if (dshTicketTtlMs > 30_000) {
    throw new Error('DSH_TICKET_TTL_MS must not exceed 30000')
  }
  if (dshSessionTtlMs > 12 * 60 * 60 * 1_000) {
    throw new Error('DSH_SESSION_TTL_MS must not exceed 12 hours')
  }
  return {
    ...input,
    publicOrigin: publicUrl.origin,
    dshPublicOrigin,
    basePath: normalizeBasePath(input.basePath),
    maxRooms: positiveInteger('MAX_ROOMS', input.maxRooms),
    maxConnections: positiveInteger('MAX_CONNECTIONS', input.maxConnections),
    maxRateLimitKeys: positiveInteger(
      'MAX_RATE_LIMIT_KEYS',
      input.maxRateLimitKeys
    ),
    maxFrameBytes: positiveInteger('MAX_FRAME_BYTES', input.maxFrameBytes),
    maxRoomBufferedBytes: positiveInteger(
      'MAX_ROOM_BUFFERED_BYTES',
      input.maxRoomBufferedBytes
    ),
    helloDeadlineMs: positiveInteger('HELLO_DEADLINE_MS', input.helloDeadlineMs),
    pingIntervalMs: positiveInteger('PING_INTERVAL_MS', input.pingIntervalMs),
    pongTimeoutMs: positiveInteger('PONG_TIMEOUT_MS', input.pongTimeoutMs),
    revokeDrainMs: positiveInteger('REVOKE_DRAIN_MS', input.revokeDrainMs),
    violationWindowMs: positiveInteger(
      'VIOLATION_WINDOW_MS',
      input.violationWindowMs
    ),
    violationLimit: positiveInteger('VIOLATION_LIMIT', input.violationLimit),
    dshSeatTokenTtlMs,
    dshTicketTtlMs,
    dshSessionTtlMs,
    maxDshTunnels: positiveInteger('MAX_DSH_TUNNELS', input.maxDshTunnels),
    maxDshSessions: positiveInteger('MAX_DSH_SESSIONS', input.maxDshSessions)
  }
}

export function loadRelayConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const baseline = defaults
  const enableDevCreate = env.ENABLE_DEV_CREATE === '1'
  if (
    env.ENABLE_DEV_CREATE !== undefined &&
    env.ENABLE_DEV_CREATE !== '' &&
    !enableDevCreate
  ) {
    throw new Error('ENABLE_DEV_CREATE must be empty or 1')
  }
  if (env.NODE_ENV === 'production' && enableDevCreate) {
    throw new Error('ENABLE_DEV_CREATE is forbidden in production')
  }
  const serviceToken = env.RELAY_SERVICE_TOKEN || null
  if (env.NODE_ENV === 'production' && serviceToken === null) {
    throw new Error('RELAY_SERVICE_TOKEN is required in production')
  }
  return validateRelayConfig({
    ...baseline,
    publicOrigin: env.PUBLIC_ORIGIN ?? baseline.publicOrigin,
    dshPublicOrigin: env.DSH_PUBLIC_ORIGIN || null,
    basePath: env.BASE_PATH ?? baseline.basePath,
    allowInsecureLoopback: env.ALLOW_INSECURE_LOOPBACK === '1',
    serviceToken,
    enableDevCreate,
    maxRooms: envInteger(env, 'MAX_ROOMS', baseline.maxRooms),
    maxConnections: envInteger(env, 'MAX_CONNECTIONS', baseline.maxConnections),
    maxRateLimitKeys: envInteger(
      env,
      'MAX_RATE_LIMIT_KEYS',
      baseline.maxRateLimitKeys
    ),
    maxFrameBytes: envInteger(env, 'MAX_FRAME_BYTES', baseline.maxFrameBytes),
    maxRoomBufferedBytes: envInteger(
      env,
      'MAX_ROOM_BUFFERED_BYTES',
      baseline.maxRoomBufferedBytes
    ),
    createRate: {
      burst: envInteger(env, 'CREATE_RATE_BURST', baseline.createRate.burst),
      perMinute: envInteger(
        env,
        'CREATE_RATE_PER_MINUTE',
        baseline.createRate.perMinute
      )
    },
    helloRate: {
      burst: envInteger(env, 'HELLO_RATE_BURST', baseline.helloRate.burst),
      perMinute: envInteger(
        env,
        'HELLO_RATE_PER_MINUTE',
        baseline.helloRate.perMinute
      )
    },
    helloDeadlineMs: envInteger(env, 'HELLO_DEADLINE_MS', baseline.helloDeadlineMs),
    pingIntervalMs: envInteger(env, 'PING_INTERVAL_MS', baseline.pingIntervalMs),
    pongTimeoutMs: envInteger(env, 'PONG_TIMEOUT_MS', baseline.pongTimeoutMs),
    revokeDrainMs: envInteger(env, 'REVOKE_DRAIN_MS', baseline.revokeDrainMs),
    violationWindowMs: envInteger(
      env,
      'VIOLATION_WINDOW_MS',
      baseline.violationWindowMs
    ),
    violationLimit: envInteger(env, 'VIOLATION_LIMIT', baseline.violationLimit),
    dshSeatTokenTtlMs: envInteger(
      env,
      'DSH_SEAT_TOKEN_TTL_MS',
      baseline.dshSeatTokenTtlMs
    ),
    dshTicketTtlMs: envInteger(
      env,
      'DSH_TICKET_TTL_MS',
      baseline.dshTicketTtlMs
    ),
    dshSessionTtlMs: envInteger(
      env,
      'DSH_SESSION_TTL_MS',
      baseline.dshSessionTtlMs
    ),
    maxDshTunnels: envInteger(env, 'MAX_DSH_TUNNELS', baseline.maxDshTunnels),
    maxDshSessions: envInteger(env, 'MAX_DSH_SESSIONS', baseline.maxDshSessions)
  })
}
