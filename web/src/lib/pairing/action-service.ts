import {
  createUserPairing,
  getUserPairing,
  PairingLifecycleError,
  type PairingLifecycleErrorCode,
  type PairingView,
  revokeUserPairing,
  rotateUserPairing
} from './lifecycle'

export type PairingActionError =
  | 'UNAUTHORIZED'
  | 'INVALID_REQUEST'
  | 'INTERNAL_ERROR'
  | PairingLifecycleErrorCode

export type PairingActionResult =
  | { ok: true; pairing: PairingView }
  | { ok: false; error: PairingActionError }

export interface PairingActionService {
  get(): Promise<PairingActionResult>
  create(input?: unknown): Promise<PairingActionResult>
  revoke(expectedVersion: unknown): Promise<PairingActionResult>
  rotate(expectedVersion: unknown): Promise<PairingActionResult>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

class InvalidPairingActionInput extends Error {}

function parseVersionInput(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'version' || !('version' in value)) {
    return undefined
  }
  return typeof value.version === 'string' &&
    value.version.length <= 128 &&
    UUID_PATTERN.test(value.version)
    ? value.version
    : undefined
}

function parseCreateInput(value: unknown): string | undefined {
  if (value === undefined) return 'us-1'
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return undefined
  }
  const keys = Object.keys(value)
  if (keys.length !== 1 || keys[0] !== 'nodeId' || !('nodeId' in value)) {
    return undefined
  }
  return typeof value.nodeId === 'string' &&
    /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/.test(value.nodeId)
    ? value.nodeId
    : undefined
}

function safeActionError(error: unknown): PairingActionError {
  if (error instanceof InvalidPairingActionInput) return 'INVALID_REQUEST'
  if (error instanceof PairingLifecycleError) return error.code
  return 'INTERNAL_ERROR'
}

export function createPairingActionService(
  resolveSessionUserId: () => Promise<string | null>
): PairingActionService {
  async function run(
    operation: (userId: string) => Promise<PairingView>
  ): Promise<PairingActionResult> {
    try {
      const userId = await resolveSessionUserId()
      if (!userId) return { ok: false, error: 'UNAUTHORIZED' }
      return { ok: true, pairing: await operation(userId) }
    } catch (error) {
      return {
        ok: false,
        error: safeActionError(error)
      }
    }
  }

  return {
    get: () => run(getUserPairing),
    create: (input) =>
      run((userId) => {
        const nodeId = parseCreateInput(input)
        if (!nodeId) throw new InvalidPairingActionInput()
        return createUserPairing(userId, nodeId)
      }),
    revoke: (input) =>
      run((userId) => {
        const version = parseVersionInput(input)
        if (!version) throw new InvalidPairingActionInput()
        return revokeUserPairing(userId, version)
      }),
    rotate: (input) =>
      run((userId) => {
        const version = parseVersionInput(input)
        if (!version) throw new InvalidPairingActionInput()
        return rotateUserPairing(userId, version)
      })
  }
}
