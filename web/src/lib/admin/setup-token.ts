import { createHash, timingSafeEqual } from 'node:crypto'

const MIN_SETUP_TOKEN_BYTES = 24

function configuredToken(): string | undefined {
  const value = process.env.ADMIN_SETUP_TOKEN
  if (!value || Buffer.byteLength(value, 'utf8') < MIN_SETUP_TOKEN_BYTES) {
    return undefined
  }
  return value
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value, 'utf8').digest()
}

export function hasConfiguredSetupToken(): boolean {
  return configuredToken() !== undefined
}

export function matchesSetupToken(candidate: string): boolean {
  const expected = configuredToken()
  if (!expected) return false
  return timingSafeEqual(digest(candidate), digest(expected))
}
