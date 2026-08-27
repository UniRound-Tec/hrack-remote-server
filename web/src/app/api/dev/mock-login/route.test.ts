import { afterEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const run = vi.fn()
  const where = vi.fn(() => ({ run }))
  const set = vi.fn(() => ({ where }))
  const update = vi.fn(() => ({ set }))
  return {
    createUser: vi.fn(),
    signInEmail: vi.fn(),
    run,
    set,
    update,
    where
  }
})

vi.mock('@/lib/auth', () => ({
  getAuth: () => ({
    api: {
      createUser: mocks.createUser,
      signInEmail: mocks.signInEmail
    }
  })
}))

vi.mock('@/lib/db', () => ({
  getDb: () => ({ update: mocks.update })
}))

vi.mock('@/lib/db/schema', () => ({ user: { email: 'email' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({ type: 'eq' })) }))

import { POST } from './route'

function request(origin = 'http://localhost:3000'): Request {
  return new Request('http://localhost:3000/api/dev/mock-login', {
    method: 'POST',
    headers: { host: 'localhost:3000', origin }
  })
}

afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('development mock login', () => {
  it('is unavailable outside development', async () => {
    vi.stubEnv('NODE_ENV', 'production')

    const response = await POST(request())

    expect(response.status).toBe(404)
    expect(mocks.createUser).not.toHaveBeenCalled()
  })

  it('rejects cross-origin requests', async () => {
    vi.stubEnv('NODE_ENV', 'development')

    const response = await POST(request('https://example.com'))

    expect(response.status).toBe(403)
    expect(mocks.createUser).not.toHaveBeenCalled()
  })

  it('creates and enforces a verified admin before forwarding the session', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    mocks.createUser.mockResolvedValue({ user: { id: 'mock-user' } })
    mocks.signInEmail.mockResolvedValue(
      new Response('{}', {
        status: 200,
        headers: { 'Set-Cookie': 'better-auth.session_token=mock; Path=/' }
      })
    )

    const response = await POST(request())

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain(
      'better-auth.session_token=mock'
    )
    expect(mocks.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.objectContaining({
          email: 'mock@hrack.local',
          role: 'admin',
          data: expect.objectContaining({ emailVerified: true })
        })
      })
    )
    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        role: 'admin',
        emailVerified: true,
        banned: false
      })
    )
  })
})
