import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb } from '@/lib/db'
import { account, user } from '@/lib/db/auth-schema'
import { reloadAuth } from '@/lib/auth'
import { POST } from './route'

const BASE_URL = 'http://localhost:3000'
const SETUP_TOKEN = 'pr4-setup-token-at-least-24-bytes'
const PASSWORD = 'correct horse battery staple'
const dirs: string[] = []

function request(
  overrides: Partial<{ token: string; email: string; password: string }> = {}
): Request {
  return new Request(`${BASE_URL}/api/admin/setup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: BASE_URL },
    body: JSON.stringify({
      token: SETUP_TOKEN,
      email: 'ops@example.test',
      password: PASSWORD,
      ...overrides
    })
  })
}

beforeEach(async () => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-admin-setup-'))
  dirs.push(dir)
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('BETTER_AUTH_URL', BASE_URL)
  vi.stubEnv('BETTER_AUTH_SECRET', 'pr4-test-secret-that-is-at-least-32-bytes')
  vi.stubEnv('ADMIN_SETUP_TOKEN', SETUP_TOKEN)
  vi.stubEnv('ADMIN_BOOTSTRAP_EMAIL', '')
  vi.stubEnv('EMAIL_VERIFICATION_REQUIRED', '1')
  vi.stubEnv('MAIL_PROVIDER', '')
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('NODE_ENV', 'production')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await reloadAuth()
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('POST /api/admin/setup', () => {
  it('creates one verified admin, a credential account, and a session cookie', async () => {
    const response = await POST(request())
    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )

    const users = getDb().select().from(user).all()
    expect(users).toHaveLength(1)
    expect(users[0]).toMatchObject({
      email: 'ops@example.test',
      emailVerified: true,
      role: 'admin',
      banned: false
    })
    expect(getDb().select().from(account).all()).toHaveLength(1)
    expect(
      fs.existsSync(path.join(process.env.HRACK_WEB_DATA!, 'last-otp.json'))
    ).toBe(false)
  })

  it('rejects an invalid token without creating a user', async () => {
    const response = await POST(request({ token: 'wrong-token' }))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toEqual({
      code: 'INVALID_SETUP_TOKEN'
    })
    expect(getDb().select().from(user).all()).toHaveLength(0)
  })

  it('is hidden when no valid setup token is configured', async () => {
    vi.stubEnv('ADMIN_SETUP_TOKEN', '')
    const response = await POST(request())
    expect(response.status).toBe(404)
  })

  it('is permanently hidden after an active admin exists', async () => {
    expect((await POST(request())).status).toBe(200)
    const response = await POST(request())
    expect(response.status).toBe(404)
  })

  it('serializes concurrent setup attempts', async () => {
    const responses = await Promise.all([
      POST(request({ email: 'first@example.test' })),
      POST(request({ email: 'second@example.test' }))
    ])
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 404
    ])
    const admins = getDb()
      .select()
      .from(user)
      .all()
      .filter((row) => row.role === 'admin' && !row.banned)
    expect(admins).toHaveLength(1)
  })
})
