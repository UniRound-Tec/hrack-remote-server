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
  create(): Promise<PairingActionResult>
  revoke(expectedVersion: unknown): Promise<PairingActionResult>
  rotate(expectedVersion: unknown): Promise<PairingActionResult>
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

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
        error:
          error instanceof PairingLifecycleError
            ? error.code
            : 'INTERNAL_ERROR'
      }
    }
  }

  return {
    get: () => run(getUserPairing),
    create: () => run(createUserPairing),
    revoke: (input) => {
      const version = parseVersionInput(input)
      return version
        ? run((userId) => revokeUserPairing(userId, version))
        : Promise.resolve({ ok: false, error: 'INVALID_REQUEST' })
    },
    rotate: (input) => {
      const version = parseVersionInput(input)
      return version
        ? run((userId) => rotateUserPairing(userId, version))
        : Promise.resolve({ ok: false, error: 'INVALID_REQUEST' })
    }
  }
}
