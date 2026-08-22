import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from './db'
import { createAuth } from './auth-options'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'correct horse battery staple'
const dirs: string[] = []

function jsonRequest(pathname: string, body: Record<string, unknown>): Request {
  return new Request(`${BASE_URL}/api/auth${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'x-real-ip': '127.0.0.1'
    },
    body: JSON.stringify(body)
  })
}

function testAuth(emailVerificationRequired: boolean) {
  return createAuth({ emailVerificationRequired })
}

async function signUp(
  auth: ReturnType<typeof testAuth>,
  email: string
): Promise<Response> {
  return auth.handler(
    jsonRequest('/sign-up/email', {
      email,
      password: PASSWORD,
      name: email.split('@')[0]
    })
  )
}

beforeEach(() => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-auth-'))
  dirs.push(dir)
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('BETTER_AUTH_URL', BASE_URL)
  vi.stubEnv('BETTER_AUTH_SECRET', 'pr2-test-secret-that-is-at-least-32-bytes')
  vi.stubEnv('MAIL_PROVIDER', '')
  vi.stubEnv('ADMIN_BOOTSTRAP_EMAIL', '')
})

afterEach(() => {
  closeDb()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('Better Auth PR2 contract', () => {
  it('registers and signs in without SMTP when verification is disabled', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const auth = testAuth(false)
    const registration = await signUp(auth, 'no-smtp@example.test')
    expect(registration.status).toBe(200)
    expect(registration.headers.get('set-cookie')).toContain('better-auth.session_token')

    const login = await auth.handler(
      jsonRequest('/sign-in/email', {
        email: 'no-smtp@example.test',
        password: PASSWORD
      })
    )
    expect(login.status).toBe(200)
    expect(login.headers.get('set-cookie')).toContain('better-auth.session_token')
  })

  it('keeps fresh and duplicate registration response key order identical', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const auth = testAuth(true)
    const fresh = await signUp(auth, 'enumeration@example.test')
    const duplicate = await signUp(auth, 'enumeration@example.test')
    expect(fresh.status).toBe(200)
    expect(duplicate.status).toBe(200)

    const freshJson = (await fresh.json()) as { user: Record<string, unknown> }
    const duplicateJson = (await duplicate.json()) as {
      user: Record<string, unknown>
    }
    expect(Object.keys(duplicateJson)).toEqual(Object.keys(freshJson))
    expect(Object.keys(duplicateJson.user)).toEqual(Object.keys(freshJson.user))
  })

  it('delivers one six-digit OTP and creates a session after verification', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const auth = testAuth(true)
    const registration = await signUp(auth, 'verify@example.test')
    expect(registration.status).toBe(200)
    expect(registration.headers.get('set-cookie')).toBeNull()

    const otpFile = path.join(process.env.HRACK_WEB_DATA!, 'last-otp.json')
    await vi.waitFor(() => expect(fs.existsSync(otpFile)).toBe(true))
    const delivered = JSON.parse(fs.readFileSync(otpFile, 'utf8')) as {
      email: string
      otp: string
    }
    expect(delivered.email).toBe('verify@example.test')
    expect(delivered.otp).toMatch(/^\d{6}$/)

    const verified = await auth.handler(
      jsonRequest('/email-otp/verify-email', {
        email: delivered.email,
        otp: delivered.otp
      })
    )
    expect(verified.status).toBe(200)
    expect(verified.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )
  })

  it.each([
    ['/admin/impersonate-user', { userId: 'target' }],
    ['/admin/stop-impersonating', {}],
    ['/sign-in/email-otp', { email: 'x@example.test', otp: '123456' }],
    [
      '/email-otp/request-password-reset',
      { email: 'x@example.test', otp: '123456' }
    ],
    ['/forget-password/email-otp', { email: 'x@example.test' }],
    ['/email-otp/reset-password', { email: 'x@example.test' }]
  ])('returns 404 for disabled endpoint %s', async (pathname, body) => {
    const response = await testAuth(false).handler(jsonRequest(pathname, body))
    expect(response.status).toBe(404)
  })
})
