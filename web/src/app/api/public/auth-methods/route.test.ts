import { afterEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('GET /api/public/auth-methods', () => {
  it('defaults all methods and email verification to false', async () => {
    vi.stubEnv('GITHUB_CLIENT_ID', '')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    vi.stubEnv('GOOGLE_CLIENT_ID', '')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', '')
    vi.stubEnv('LINUX_DO_CLIENT_ID', '')
    vi.stubEnv('LINUX_DO_CLIENT_SECRET', '')
    vi.stubEnv('EMAIL_VERIFICATION_REQUIRED', '')
    const response = GET()
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(await response.json()).toEqual({
      github: false,
      google: false,
      'linux-do': false,
      emailVerificationRequired: false
    })
  })
})
