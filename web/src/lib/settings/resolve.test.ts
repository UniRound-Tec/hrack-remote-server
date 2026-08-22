import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emptyToUndef,
  loadRuntimeConfig,
  readEmailVerificationRequired
} from './resolve'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('runtime auth config', () => {
  it('treats compose empty strings as unset', () => {
    expect(emptyToUndef(undefined)).toBeUndefined()
    expect(emptyToUndef('')).toBeUndefined()
    expect(emptyToUndef('   ')).toBeUndefined()
    expect(emptyToUndef(' value ')).toBe('value')
  })

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true]
  ])('parses EMAIL_VERIFICATION_REQUIRED=%s', (input, expected) => {
    expect(readEmailVerificationRequired(input)).toBe(expected)
  })

  it('requires both OAuth env values', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
    const config = loadRuntimeConfig()
    expect(config.github).toBeUndefined()
    expect(config.google).toEqual({
      clientId: 'google-id',
      clientSecret: 'google-secret'
    })
    expect(config.emailVerificationRequired).toBe(false)
  })
})
