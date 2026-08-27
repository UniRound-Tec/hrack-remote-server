import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '@/lib/db'
import { getAuth, reloadAuth } from '@/lib/auth'
import { POST as setup } from '../setup/route'
import {
  DELETE as deleteMail,
  GET as getMail,
  PUT as putMail
} from './mail/route'
import { POST as testMail } from './mail/test/route'
import {
  DELETE as deleteOAuth,
  GET as getOAuth,
  PUT as putOAuth
} from './oauth/route'
import { GET as getAuthMethods } from '../../public/auth-methods/route'

const ORIGIN = 'http://localhost:3000'
const dirs: string[] = []
let cookie = ''

function request(
  pathname: string,
  method = 'GET',
  body?: unknown,
  origin = ORIGIN,
  authenticated = true
): Request {
  return new Request(`${ORIGIN}${pathname}`, {
    method,
    headers: {
      ...(authenticated ? { cookie } : {}),
      ...(method === 'GET' ? {} : { origin }),
      ...(body === undefined ? {} : { 'content-type': 'application/json' })
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  })
}

beforeEach(async () => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-settings-route-'))
  dirs.push(dir)
  const empty = [
    'MAIL_PROVIDER',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_FROM',
    'SMTP_SECURITY',
    'RESEND_API_KEY',
    'GITHUB_CLIENT_ID',
    'GITHUB_CLIENT_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'LINUX_DO_CLIENT_ID',
    'LINUX_DO_CLIENT_SECRET',
    'EMAIL_VERIFICATION_REQUIRED',
    'SETTINGS_ENC_KEY',
    'BETTER_AUTH_TRUSTED_ORIGINS'
  ]
  for (const key of empty) vi.stubEnv(key, '')
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 4).toString('base64'))
  vi.stubEnv('BETTER_AUTH_URL', ORIGIN)
  vi.stubEnv('BETTER_AUTH_SECRET', 'settings-route-secret-at-least-32-bytes')
  vi.stubEnv('ADMIN_SETUP_TOKEN', 'settings-route-setup-token-24-bytes')
  vi.stubEnv('NODE_ENV', 'test')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
  await reloadAuth()
  const response = await setup(
    new Request(`${ORIGIN}/api/admin/setup`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        token: 'settings-route-setup-token-24-bytes',
        email: 'operator@example.test',
        password: 'operator-password'
      })
    })
  )
  expect(response.status).toBe(200)
  cookie = response.headers.get('set-cookie')!.split(';', 1)[0]
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('administrator settings routes', () => {
  it('requires an administrator session and a trusted write origin', async () => {
    expect(
      (await getMail(request('/api/admin/settings/mail', 'GET', undefined, ORIGIN, false))).status
    ).toBe(401)
    expect(
      (
        await putMail(
          request(
            '/api/admin/settings/mail',
            'PUT',
            { emailVerificationRequired: false },
            'https://attacker.example'
          )
        )
      ).status
    ).toBe(403)
  })

  it('persists mail settings without returning its password', async () => {
    const response = await putMail(
      request('/api/admin/settings/mail', 'PUT', {
        smtp: {
          host: 'smtp.example.test',
          port: 2525,
          security: 'none',
          username: 'mailer',
          password: 'route-smtp-secret',
          from: 'HRack <hello@example.test>'
        },
        emailVerificationRequired: true
      })
    )
    expect(response.status).toBe(200)
    expect(await response.text()).not.toContain('route-smtp-secret')

    const getResponse = await getMail(request('/api/admin/settings/mail'))
    const text = await getResponse.text()
    expect(getResponse.status).toBe(200)
    expect(getResponse.headers.get('cache-control')).toBe('no-store')
    expect(text).not.toContain('route-smtp-secret')
    expect(JSON.parse(text).smtp.passwordConfigured).toBe(true)
    vi.stubEnv('MAIL_PROVIDER', 'console')
    expect((await testMail(request('/api/admin/settings/mail/test', 'POST'))).status).toBe(200)
  })

  it('hot-loads OAuth and preserves the final overlapping write', async () => {
    const responses = await Promise.all([
      putOAuth(
        request('/api/admin/settings/oauth', 'PUT', {
          provider: 'github',
          enabled: true,
          clientId: 'first-id',
          clientSecret: 'first-secret'
        })
      ),
      putOAuth(
        request('/api/admin/settings/oauth', 'PUT', {
          provider: 'github',
          enabled: true,
          clientId: 'last-id',
          clientSecret: 'last-secret'
        })
      )
    ])
    expect(responses.map((response) => response.status)).toEqual([200, 200])
    expect(await getAuthMethods().json()).toMatchObject({
      github: true
    })
    const view = await getOAuth(request('/api/admin/settings/oauth'))
    const text = await view.text()
    expect(text).toContain('last-id')
    expect(text).not.toContain('last-secret')

    expect(
      (
        await deleteOAuth(
          request('/api/admin/settings/oauth', 'DELETE', { provider: 'github' })
        )
      ).status
    ).toBe(200)
    expect(await getAuthMethods().json()).toMatchObject({
      github: false
    })
  })

  it('rejects environment-pinned writes and clears database mail settings', async () => {
    expect(
      (
        await putMail(
          request('/api/admin/settings/mail', 'PUT', {
            emailVerificationRequired: false
          })
        )
      ).status
    ).toBe(200)
    expect((await deleteMail(request('/api/admin/settings/mail', 'DELETE'))).status).toBe(200)

    vi.stubEnv('EMAIL_VERIFICATION_REQUIRED', 'false')
    const pinned = await putMail(
      request('/api/admin/settings/mail', 'PUT', {
        emailVerificationRequired: true
      })
    )
    expect(pinned.status).toBe(409)
    await expect(pinned.json()).resolves.toEqual({ code: 'PINNED' })
  })

  it('hot-loads verification so an existing unverified account enters OTP flow', async () => {
    const authRequest = (pathname: string) =>
      new Request(`${ORIGIN}/api/auth${pathname}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: ORIGIN },
        body: JSON.stringify({
          email: 'unverified@example.test',
          password: 'unverified-password',
          name: 'Unverified'
        })
      })
    expect(
      (await getAuth().handler(authRequest('/sign-up/email'))).status
    ).toBe(200)

    const enabled = await putMail(
      request('/api/admin/settings/mail', 'PUT', {
        emailVerificationRequired: true
      })
    )
    expect(enabled.status).toBe(200)
    expect(await getAuthMethods().json()).toMatchObject({
      emailVerificationRequired: true
    })

    const login = await getAuth().handler(authRequest('/sign-in/email'))
    expect(login.status).toBe(403)
    await expect(login.json()).resolves.toMatchObject({
      code: 'EMAIL_NOT_VERIFIED'
    })
  })
})
