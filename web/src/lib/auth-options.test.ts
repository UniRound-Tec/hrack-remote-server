import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb } from './db'
import { account, user } from './db/auth-schema'
import { satisfiesVerificationPolicy } from './auth-access'
import { createAuth } from './auth-options'
import type { RuntimeAuthConfig } from './settings/resolve'

const BASE_URL = 'http://localhost:3000'
const PASSWORD = 'correct horse battery staple'
const dirs: string[] = []

function jsonRequest(
  pathname: string,
  body: Record<string, unknown>,
  cookie?: string
): Request {
  return new Request(`${BASE_URL}/api/auth${pathname}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: BASE_URL,
      'x-real-ip': '127.0.0.1',
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  })
}

function testAuth(emailVerificationRequired: boolean) {
  return createAuth({ emailVerificationRequired })
}

function googleAuth(emailVerificationRequired: boolean) {
  return createAuth({
    emailVerificationRequired,
    google: {
      clientId: 'google-test-client',
      clientSecret: 'google-test-secret',
      verifyIdToken: async () => true
    }
  } as unknown as RuntimeAuthConfig)
}

function linuxDoAuth(emailVerificationRequired: boolean) {
  return createAuth({
    emailVerificationRequired,
    'linux-do': {
      clientId: 'linux-do-test-client',
      clientSecret: 'linux-do-test-secret'
    }
  })
}

function googleIdToken({
  email,
  emailVerified,
  sub
}: {
  email?: string
  emailVerified: boolean
  sub: string
}): string {
  const encode = (value: Record<string, unknown>) =>
    Buffer.from(JSON.stringify(value)).toString('base64url')
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
    aud: 'google-test-client',
    email,
    email_verified: emailVerified,
    name: 'OAuth user',
    picture: '',
    sub
  })}.test-signature`
}

async function googleIdTokenSignIn(
  auth: ReturnType<typeof googleAuth>,
  token: string
): Promise<Response> {
  return auth.handler(
    jsonRequest('/sign-in/social', {
      provider: 'google',
      callbackURL: '/dashboard',
      errorCallbackURL: '/auth',
      idToken: { token }
    })
  )
}

function cookieHeader(response: Response): string {
  return response.headers
    .get('set-cookie')!
    .split(/,(?=[^;,]+=)/)
    .map((value) => value.split(';')[0])
    .join('; ')
}

async function googleCallback(
  auth: ReturnType<typeof googleAuth>,
  token: string
): Promise<Response> {
  const start = await auth.handler(
    jsonRequest('/sign-in/social', {
      provider: 'google',
      callbackURL: '/dashboard',
      errorCallbackURL: '/auth',
      disableRedirect: true
    })
  )
  const started = (await start.json()) as { url: string }
  const state = new URL(started.url).searchParams.get('state')
  expect(state).toBeTruthy()

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.toString()
            : input
      if (url !== 'https://oauth2.googleapis.com/token') {
        throw new Error(`Unexpected OAuth request: ${url}`)
      }
      return Response.json({
        access_token: 'google-test-access',
        expires_in: 3600,
        id_token: token,
        token_type: 'Bearer'
      })
    })
  )

  return auth.handler(
    new Request(
      `${BASE_URL}/api/auth/callback/google?code=test-code&state=${encodeURIComponent(state!)}`,
      { headers: { cookie: cookieHeader(start) } }
    )
  )
}

async function linuxDoCallback(
  auth: ReturnType<typeof linuxDoAuth>
): Promise<Response> {
  const start = await auth.handler(
    jsonRequest('/sign-in/social', {
      provider: 'linux-do',
      callbackURL: '/dashboard',
      errorCallbackURL: '/auth',
      disableRedirect: true
    })
  )
  expect(start.status).toBe(200)
  const started = (await start.json()) as { url: string }
  const authorizationUrl = new URL(started.url)
  expect(authorizationUrl.origin + authorizationUrl.pathname).toBe(
    'https://connect.linux.do/oauth2/authorize'
  )
  expect(authorizationUrl.searchParams.get('redirect_uri')).toBe(
    `${BASE_URL}/api/auth/callback/linux-do`
  )
  expect(authorizationUrl.searchParams.get('code_challenge')).toBeTruthy()
  const state = authorizationUrl.searchParams.get('state')
  expect(state).toBeTruthy()

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url =
        input instanceof Request
          ? input.url
          : input instanceof URL
            ? input.toString()
            : input
      const headers = new Headers(
        init?.headers ?? (input instanceof Request ? input.headers : undefined)
      )
      if (url === 'https://connect.linux.do/oauth2/token') {
        expect(headers.get('authorization')).toBe(
          `Basic ${Buffer.from('linux-do-test-client:linux-do-test-secret').toString('base64')}`
        )
        const body = new URLSearchParams(String(init?.body))
        expect(body.get('redirect_uri')).toBe(
          `${BASE_URL}/api/auth/callback/linux-do`
        )
        expect(body.get('code_verifier')).toBeTruthy()
        return Response.json({
          access_token: 'linux-do-test-access',
          expires_in: 3600,
          token_type: 'Bearer'
        })
      }
      if (url === 'https://connect.linux.do/api/user') {
        expect(headers.get('authorization')).toBe(
          'Bearer linux-do-test-access'
        )
        return Response.json({
          id: 1189,
          username: 'reno',
          name: 'Reno',
          avatar_template:
            'https://linux.do/user_avatar/linux.do/reno/{size}/4043_2.png',
          active: true,
          trust_level: 3,
          silenced: false
        })
      }
      throw new Error(`Unexpected OAuth request: ${url}`)
    })
  )

  return auth.handler(
    new Request(
      `${BASE_URL}/api/auth/callback/linux-do?code=test-code&state=${encodeURIComponent(state!)}`,
      { headers: { cookie: cookieHeader(start) } }
    )
  )
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
  vi.stubEnv('RESEND_API_KEY', '')
  vi.stubEnv('SMTP_HOST', '')
  vi.stubEnv('SMTP_PORT', '')
  vi.stubEnv('SMTP_USER', '')
  vi.stubEnv('SMTP_PASS', '')
  vi.stubEnv('SMTP_FROM', '')
  vi.stubEnv('SMTP_SECURITY', '')
  vi.stubEnv('ADMIN_BOOTSTRAP_EMAIL', '')
})

afterEach(() => {
  closeDb()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('Better Auth contract', () => {
  it('rejects verified registration before insert when production mail is unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const auth = testAuth(true)
    const registration = await signUp(auth, 'blocked@example.test')
    expect(registration.status).toBe(400)
    await expect(registration.json()).resolves.toMatchObject({
      code: 'MAIL_UNAVAILABLE'
    })
    expect(getDb().select().from(user).all()).toHaveLength(0)
  })

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

  it('changes an authenticated credential password only after verifying the current password', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const auth = testAuth(false)
    const email = 'change-password@example.test'
    const nextPassword = 'updated horse battery staple'
    const registration = await signUp(auth, email)
    const cookie = cookieHeader(registration)

    const rejected = await auth.handler(
      jsonRequest(
        '/change-password',
        {
          currentPassword: 'not-the-current-password',
          newPassword: nextPassword,
          revokeOtherSessions: true
        },
        cookie
      )
    )
    expect(rejected.status).toBe(400)
    await expect(rejected.json()).resolves.toMatchObject({
      code: 'INVALID_PASSWORD'
    })

    const changed = await auth.handler(
      jsonRequest(
        '/change-password',
        {
          currentPassword: PASSWORD,
          newPassword: nextPassword,
          revokeOtherSessions: true
        },
        cookie
      )
    )
    expect(changed.status).toBe(200)
    expect(changed.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )

    const oldLogin = await auth.handler(
      jsonRequest('/sign-in/email', { email, password: PASSWORD })
    )
    expect(oldLogin.status).toBe(401)

    const newLogin = await auth.handler(
      jsonRequest('/sign-in/email', { email, password: nextPassword })
    )
    expect(newLogin.status).toBe(200)
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

  it('accepts an OAuth identity without local email verification', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const auth = googleAuth(true)
    const response = await googleIdTokenSignIn(
      auth,
      googleIdToken({
        email: 'unverified-google@example.test',
        emailVerified: false,
        sub: 'google-unverified'
      })
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )
  })

  it('redirects an unverified Google callback to the dashboard', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    const response = await googleCallback(
      googleAuth(true),
      googleIdToken({
        email: 'unverified-callback@example.test',
        emailVerified: false,
        sub: 'google-unverified-callback'
      })
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')
    expect(response.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )
  })

  it('signs in with Linux.do using its stable id and an internal placeholder email', async () => {
    const response = await linuxDoCallback(linuxDoAuth(true))
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/dashboard')
    expect(response.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )

    const created = getDb()
      .select()
      .from(user)
      .where(eq(user.email, 'linuxdo-1189@oauth.invalid'))
      .get()
    expect(created).toMatchObject({
      name: 'Reno',
      emailVerified: false,
      image: 'https://linux.do/user_avatar/linux.do/reno/288/4043_2.png'
    })
    expect(
      getDb()
        .select({ providerId: account.providerId, accountId: account.accountId })
        .from(account)
        .where(eq(account.userId, created!.id))
        .get()
    ).toEqual({ providerId: 'linux-do', accountId: '1189' })
    expect(satisfiesVerificationPolicy(created!, true)).toBe(true)
  })

  it('rejects a Google identity without email without inserting a user', async () => {
    const auth = googleAuth(false)
    const response = await googleIdTokenSignIn(
      auth,
      googleIdToken({
        emailVerified: true,
        sub: 'google-no-email'
      })
    )

    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({
      code: 'USER_EMAIL_NOT_FOUND'
    })
    expect(getDb().select().from(user).all()).toHaveLength(0)
  })

  it('redirects a callback without email instead of returning a server error', async () => {
    const response = await googleCallback(
      googleAuth(false),
      googleIdToken({
        emailVerified: true,
        sub: 'google-callback-no-email'
      })
    )

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe(
      '/auth?error=email_not_found'
    )
    expect(getDb().select().from(user).all()).toHaveLength(0)
  })

  it('replaces an unverified credential-only identity before trusted Google sign-in', async () => {
    const email = 'victim@example.test'
    const auth = googleAuth(false)
    const attackerRegistration = await signUp(auth, email)
    expect(attackerRegistration.status).toBe(200)

    const victimLogin = await googleIdTokenSignIn(
      auth,
      googleIdToken({
        email,
        emailVerified: true,
        sub: 'google-victim'
      })
    )
    expect(victimLogin.status).toBe(200)
    expect(victimLogin.headers.get('set-cookie')).toContain(
      'better-auth.session_token'
    )

    const attackerLogin = await auth.handler(
      jsonRequest('/sign-in/email', { email, password: PASSWORD })
    )
    expect(attackerLogin.status).toBe(401)

    const replacement = getDb()
      .select()
      .from(user)
      .where(eq(user.email, email))
      .get()
    expect(replacement?.emailVerified).toBe(true)
    expect(
      getDb()
        .select({ providerId: account.providerId })
        .from(account)
        .where(eq(account.userId, replacement!.id))
        .all()
    ).toEqual([{ providerId: 'google' }])
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
