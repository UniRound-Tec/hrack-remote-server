export interface RateLimitConfig {
  burst: number
  perMinute: number
}

export interface RelayConfig {
  publicOrigin: string
  basePath: string
  allowInsecureLoopback: boolean
  maxRooms: number
  maxConnections: number
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
}

const defaults: RelayConfig = {
  publicOrigin: 'https://relay.example',
  basePath: '',
  allowInsecureLoopback: false,
  maxRooms: 10_000,
  maxConnections: 20_000,
  maxFrameBytes: 1_048_576,
  maxRoomBufferedBytes: 1_048_576,
  createRate: { burst: 3, perMinute: 10 },
  helloRate: { burst: 5, perMinute: 20 },
  helloDeadlineMs: 5_000,
  pingIntervalMs: 30_000,
  pongTimeoutMs: 10_000,
  revokeDrainMs: 500,
  violationWindowMs: 10_000,
  violationLimit: 3
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
  return {
    ...input,
    publicOrigin: publicUrl.origin,
    basePath: normalizeBasePath(input.basePath),
    maxRooms: positiveInteger('MAX_ROOMS', input.maxRooms),
    maxConnections: positiveInteger('MAX_CONNECTIONS', input.maxConnections),
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
    violationLimit: positiveInteger('VIOLATION_LIMIT', input.violationLimit)
  }
}

export function loadRelayConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
  const baseline = defaults
  return validateRelayConfig({
    ...baseline,
    publicOrigin: env.PUBLIC_ORIGIN ?? baseline.publicOrigin,
    basePath: env.BASE_PATH ?? baseline.basePath,
    allowInsecureLoopback: env.ALLOW_INSECURE_LOOPBACK === '1',
    maxRooms: envInteger(env, 'MAX_ROOMS', baseline.maxRooms),
    maxConnections: envInteger(env, 'MAX_CONNECTIONS', baseline.maxConnections),
    maxFrameBytes: envInteger(env, 'MAX_FRAME_BYTES', baseline.maxFrameBytes),
    maxRoomBufferedBytes: envInteger(
      env,
      'MAX_ROOM_BUFFERED_BYTES',
      baseline.maxRoomBufferedBytes
    ),
    helloDeadlineMs: envInteger(env, 'HELLO_DEADLINE_MS', baseline.helloDeadlineMs),
    pingIntervalMs: envInteger(env, 'PING_INTERVAL_MS', baseline.pingIntervalMs),
    pongTimeoutMs: envInteger(env, 'PONG_TIMEOUT_MS', baseline.pongTimeoutMs),
    revokeDrainMs: envInteger(env, 'REVOKE_DRAIN_MS', baseline.revokeDrainMs),
    violationWindowMs: envInteger(
      env,
      'VIOLATION_WINDOW_MS',
      baseline.violationWindowMs
    ),
    violationLimit: envInteger(env, 'VIOLATION_LIMIT', baseline.violationLimit)
  })
}

