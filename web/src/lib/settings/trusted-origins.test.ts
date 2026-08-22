import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTrustedOrigins } from './trusted-origins'

afterEach(() => vi.unstubAllEnvs())

describe('trusted administrator origins', () => {
  it('normalizes, deduplicates, and ignores invalid configured origins', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://hrack.example/path')
    vi.stubEnv(
      'BETTER_AUTH_TRUSTED_ORIGINS',
      'https://www.hrack.example, https://hrack.example/other, invalid'
    )
    expect(loadTrustedOrigins()).toEqual([
      'https://hrack.example',
      'https://www.hrack.example'
    ])
  })
})
