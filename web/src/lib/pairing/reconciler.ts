import {
  readPairingProjection,
  type PairingProjection
} from './projection'

interface RelayState {
  instanceId: string
  synchronized: boolean
  appliedRevision: number
}

interface RelayReconcileResult {
  instanceId: string
  appliedRevision: number
  activeRoomCount: number
}

export interface ReconcilePairingsOptions {
  relayOrigin: string
  serviceToken: string
  previousInstanceId?: string
  readProjection?: () => PairingProjection
  fetcher?: typeof fetch
}

export interface ReconcilePairingsResult {
  instanceId: string
  revision: number
  roomCount: number
  instanceChanged: boolean
}

export interface PairingReconcileLog {
  event: 'pairing-reconcile'
  result: 'applied' | 'failed'
  revision?: number
  roomCount?: number
  instanceChanged?: boolean
  error?: string
}

export interface PairingReconcilerHealth {
  checkedAt: number
  lastSuccessAt: number | null
  consecutiveFailures: number
  error?: string
}

export interface RunPairingReconcilerOptions {
  relayOrigin: string
  serviceToken: string
  intervalMs: number
  signal: AbortSignal
  readProjection?: () => PairingProjection
  fetcher?: typeof fetch
  logger?: (record: PairingReconcileLog) => void
  healthReporter?: (health: PairingReconcilerHealth) => void
  random?: () => number
  now?: () => number
}

export interface PairingReconcilerConfig {
  relayOrigin: string
  serviceToken: string
  intervalMs: number
}

interface PairingReconcilerEnv {
  RELAY_INTERNAL_ORIGIN?: string
  RELAY_SERVICE_TOKEN?: string
  PAIRING_RECONCILE_INTERVAL_MS?: string
}

export class RelayReconcileError extends Error {
  override readonly name = 'RelayReconcileError'

  constructor(
    readonly status: number,
    readonly code: string
  ) {
    super(`Relay reconciliation failed (${status} ${code})`)
  }
}

export function loadPairingReconcilerConfig(
  env: PairingReconcilerEnv = process.env as PairingReconcilerEnv
): PairingReconcilerConfig {
  const originText = env.RELAY_INTERNAL_ORIGIN
  if (!originText) throw new Error('RELAY_INTERNAL_ORIGIN is required')
  const origin = new URL(originText)
  if (
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  ) {
    throw new Error('RELAY_INTERNAL_ORIGIN must contain only scheme and authority')
  }
  const serviceToken = env.RELAY_SERVICE_TOKEN
  if (!serviceToken || Buffer.byteLength(serviceToken, 'utf8') < 32) {
    throw new Error('RELAY_SERVICE_TOKEN must be at least 32 bytes')
  }
  const intervalMs = Number(env.PAIRING_RECONCILE_INTERVAL_MS ?? '5000')
  if (
    !Number.isSafeInteger(intervalMs) ||
    intervalMs < 1_000 ||
    intervalMs > 60_000
  ) {
    throw new Error('PAIRING_RECONCILE_INTERVAL_MS must be 1000..60000')
  }
  return {
    relayOrigin: origin.origin,
    serviceToken,
    intervalMs
  }
}

function isRelayState(value: unknown): value is RelayState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return (
    'instanceId' in value &&
    typeof value.instanceId === 'string' &&
    'synchronized' in value &&
    typeof value.synchronized === 'boolean' &&
    'appliedRevision' in value &&
    Number.isSafeInteger(value.appliedRevision)
  )
}

function isReconcileResult(value: unknown): value is RelayReconcileResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return (
    'instanceId' in value &&
    typeof value.instanceId === 'string' &&
    'appliedRevision' in value &&
    Number.isSafeInteger(value.appliedRevision) &&
    'activeRoomCount' in value &&
    Number.isSafeInteger(value.activeRoomCount)
  )
}

async function relayJson(
  fetcher: typeof fetch,
  url: string,
  init: RequestInit
): Promise<unknown> {
  const response = await fetcher(url, {
    ...init,
    signal: AbortSignal.timeout(5_000)
  })
  const body = (await response.json().catch(() => null)) as unknown
  if (!response.ok) {
    const code =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof body.error === 'string'
        ? body.error
        : 'HTTP_ERROR'
    throw new RelayReconcileError(response.status, code)
  }
  return body
}

export async function reconcilePairingsOnce(
  options: ReconcilePairingsOptions
): Promise<ReconcilePairingsResult> {
  const projection = (options.readProjection ?? readPairingProjection)()
  const origin = options.relayOrigin.replace(/\/$/, '')
  const fetcher = options.fetcher ?? fetch
  const authorization = `Bearer ${options.serviceToken}`
  const stateValue = await relayJson(
    fetcher,
    `${origin}/remote/v1/system/state`,
    { headers: { authorization } }
  )
  if (!isRelayState(stateValue)) {
    throw new RelayReconcileError(502, 'INVALID_STATE_RESPONSE')
  }

  const resultValue = await relayJson(
    fetcher,
    `${origin}/remote/v1/system/rooms`,
    {
      method: 'PUT',
      headers: {
        authorization,
        'content-type': 'application/json'
      },
      body: JSON.stringify(projection)
    }
  )
  if (!isReconcileResult(resultValue)) {
    throw new RelayReconcileError(502, 'INVALID_RECONCILE_RESPONSE')
  }

  return {
    instanceId: resultValue.instanceId,
    revision: resultValue.appliedRevision,
    roomCount: resultValue.activeRoomCount,
    instanceChanged: options.previousInstanceId !== resultValue.instanceId
  }
}

function wait(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(finish, milliseconds)
    function finish(): void {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    signal.addEventListener('abort', finish, { once: true })
  })
}

export async function runPairingReconciler(
  options: RunPairingReconcilerOptions
): Promise<void> {
  const logger = options.logger ?? (() => {})
  const healthReporter = options.healthReporter ?? (() => {})
  const random = options.random ?? Math.random
  const now = options.now ?? Date.now
  let previousInstanceId: string | undefined
  let failures = 0
  let lastSuccessAt: number | null = null

  function reportHealth(error?: string): void {
    try {
      healthReporter({
        checkedAt: now(),
        lastSuccessAt,
        consecutiveFailures: failures,
        ...(error === undefined ? {} : { error })
      })
    } catch {
      // The health adapter must never interrupt reconciliation. Its stale output
      // will make the container unhealthy and let the external monitor report it.
    }
  }

  while (!options.signal.aborted) {
    try {
      const result = await reconcilePairingsOnce({
        relayOrigin: options.relayOrigin,
        serviceToken: options.serviceToken,
        ...(previousInstanceId === undefined ? {} : { previousInstanceId }),
        ...(options.readProjection === undefined
          ? {}
          : { readProjection: options.readProjection }),
        ...(options.fetcher === undefined ? {} : { fetcher: options.fetcher })
      })
      previousInstanceId = result.instanceId
      failures = 0
      lastSuccessAt = now()
      logger({
        event: 'pairing-reconcile',
        result: 'applied',
        revision: result.revision,
        roomCount: result.roomCount,
        instanceChanged: result.instanceChanged
      })
      reportHealth()
    } catch (error) {
      if (options.signal.aborted) break
      failures += 1
      const errorCode =
        error instanceof RelayReconcileError
          ? error.code
          : 'PROJECTION_OR_NETWORK_ERROR'
      logger({
        event: 'pairing-reconcile',
        result: 'failed',
        error: errorCode
      })
      reportHealth(errorCode)
    }

    const maximumDelay =
      failures === 0
        ? options.intervalMs
        : Math.min(options.intervalMs, 250 * 2 ** Math.min(failures - 1, 8))
    const delay =
      failures === 0
        ? maximumDelay
        : Math.max(1, Math.floor(maximumDelay * (0.5 + random() * 0.5)))
    await wait(delay, options.signal)
  }
}
