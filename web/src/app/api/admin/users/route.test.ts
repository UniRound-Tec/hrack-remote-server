import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuth, reloadAuth } from '@/lib/auth'
import { closeDb, getDb } from '@/lib/db'
import { adminAudit, pairings } from '@/lib/db/schema'
import { sealPairingRevokeToken } from '@/lib/pairing/token'
import { POST as setup } from '../setup/route'
import { GET as getAudit } from '../audit/route'
import { GET, POST } from './route'

const ORIGIN = 'http://localhost:3000'
const dirs: string[] = []
let adminCookie = ''
let userCookie = ''
let userId = ''

function apiRequest(
  pathname: string,
  method = 'GET',
  body?: unknown,
  cookie = adminCookie
): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    method,
    headers: {
      cookie,
      ...(method === 'GET' ? {} : { origin: ORIGIN }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

function userAction(action: string, extra: Record<string, unknown> = {}) {
  return POST(
    apiRequest('/api/admin/users', 'POST', { action, userId, ...extra })
  )
}

beforeEach(async () => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-admin-users-'))
  dirs.push(dir)
  const empty = [
    'MAIL_PROVIDER',
    'RESEND_API_KEY',
    'EMAIL_VERIFICATION_REQUIRED',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'SETTINGS_ENC_KEY',
    'ADMIN_BOOTSTRAP_EMAIL'
  ]
  for (const key of empty) vi.stubEnv(key, '')
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 6).toString('base64'))
  vi.stubEnv('BETTER_AUTH_URL', ORIGIN)
  vi.stubEnv('BETTER_AUTH_SECRET', 'admin-users-secret-at-least-32-bytes')
  vi.stubEnv('ADMIN_SETUP_TOKEN', 'admin-users-setup-token-24-bytes')
  vi.stubEnv('NODE_ENV', 'test')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await reloadAuth()

  const admin = await setup(
    new Request(`${ORIGIN}/api/admin/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'admin-users-setup-token-24-bytes',
        email: 'admin@example.test',
        password: 'admin-password'
      })
    })
  )
  adminCookie = admin.headers.get('set-cookie')!.split(';', 1)[0]

  const signup = await getAuth().handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: ORIGIN },
      body: JSON.stringify({
        name: 'Managed User',
        email: 'managed@example.test',
        password: 'managed-password'
      })
    })
  )
  userCookie = signup.headers.get('set-cookie')!.split(';', 1)[0]
  userId = ((await signup.json()) as { user: { id: string } }).user.id
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('administrator user management', () => {
  it('lists and searches users in pages of 50', async () => {
    const response = await GET(
      apiRequest('/api/admin/users?search=managed')
    )
    const body = (await response.json()) as {
      users: Array<{ id: string }>
      limit: number
    }
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(body.limit).toBe(50)
    expect(body.users.map((item) => item.id)).toEqual([userId])
  })

  it('protects the last administrator through both platform and raw auth APIs', async () => {
    const currentAdmin = ((await getAuth().api.getSession({
      headers: new Headers({ cookie: adminCookie })
    }))!).user.id
    const platform = await POST(
      apiRequest('/api/admin/users', 'POST', {
        action: 'role',
        userId: currentAdmin,
        role: 'user'
      })
    )
    expect(platform.status).toBe(409)
    await expect(platform.json()).resolves.toEqual({ code: 'LAST_ADMIN' })

    for (const [pathname, body] of [
      ['/admin/set-role', { userId: currentAdmin, role: 'user' }],
      ['/admin/ban-user', { userId: currentAdmin }],
      ['/admin/remove-user', { userId: currentAdmin }],
      ['/admin/update-user', { userId: currentAdmin, data: { banned: true } }]
    ] as const) {
      const response = await getAuth().handler(
        apiRequest(`/api/auth${pathname}`, 'POST', body)
      )
      expect(response.status).toBe(403)
      await expect(response.json()).resolves.toMatchObject({
        code: 'LAST_ADMIN'
      })
    }
  })

  it('bans immediately, unbans, verifies, and changes roles', async () => {
    expect((await userAction('ban')).status).toBe(200)
    expect(
      await getAuth().api.getSession({
        headers: new Headers({ cookie: userCookie })
      })
    ).toBeNull()
    expect((await userAction('unban')).status).toBe(200)
    expect((await userAction('verify')).status).toBe(200)
    expect((await userAction('role', { role: 'admin' })).status).toBe(200)
    expect((await userAction('role', { role: 'user' })).status).toBe(200)
  })

  it('resets a password once, revokes sessions, and records only safe audit fields', async () => {
    const reset = await userAction('resetPassword')
    const body = (await reset.json()) as { temporaryPassword: string }
    expect(reset.status).toBe(200)
    expect(body.temporaryPassword).toHaveLength(24)
    expect(
      await getAuth().api.getSession({
        headers: new Headers({ cookie: userCookie })
      })
    ).toBeNull()

    const login = (password: string) =>
      getAuth().handler(
        new Request(`${ORIGIN}/api/auth/sign-in/email`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', origin: ORIGIN },
          body: JSON.stringify({ email: 'managed@example.test', password })
        })
      )
    expect((await login('managed-password')).status).toBe(401)
    expect((await login(body.temporaryPassword)).status).toBe(200)

    const audit = await getAudit(apiRequest('/api/admin/audit'))
    const text = await audit.text()
    expect(text).toContain('user.password_reset')
    expect(text).not.toContain(body.temporaryPassword)
    expect(text).not.toContain('managed@example.test')
    expect(getDb().select().from(adminAudit).all()).toHaveLength(1)
  })

  it('requires email confirmation before deleting a user', async () => {
    const mismatch = await userAction('delete', {
      confirmEmail: 'wrong@example.test'
    })
    expect(mismatch.status).toBe(400)
    await expect(mismatch.json()).resolves.toEqual({
      code: 'EMAIL_CONFIRMATION_MISMATCH'
    })

    vi.stubEnv('RELAY_INTERNAL_ORIGIN', 'http://relay.internal')
    getDb()
      .insert(pairings)
      .values({
        id: 'managed-pairing',
        userId,
        roomId: 'managed-room',
        joinUrl: 'https://hrack.example/remote/#managed-room',
        revokeTokenEnc: sealPairingRevokeToken('managed-revoke-token'),
        status: 'active',
        createdAt: Date.now()
      })
      .run()
    const revoke = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status: 204 }))

    const removed = await userAction('delete', {
      confirmEmail: 'managed@example.test'
    })
    expect(removed.status).toBe(200)
    expect(revoke).toHaveBeenCalledWith(
      'http://relay.internal/remote/v1/rooms/managed-room',
      expect.objectContaining({
        method: 'DELETE',
        headers: { authorization: 'Bearer managed-revoke-token' }
      })
    )
    expect(getDb().select().from(pairings).all()).toHaveLength(0)
    const list = (await GET(apiRequest('/api/admin/users')).then((response) => response.json())) as {
      users: Array<{ id: string }>
    }
    expect(list.users.some((item) => item.id === userId)).toBe(false)
  })
})
