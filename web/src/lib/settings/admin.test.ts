import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAuth } from '../auth'
import { closeDb, getDb } from '../db'
import { platformSettings } from '../db/schema'
import {
  getMailSettingsView,
  getOAuthSettingsView,
  saveMailSettings,
  saveOAuthSettings,
  SettingsMutationError
} from './admin'
import { loadRuntimeConfig } from './resolve'
import { readSetting, writeSetting } from './store'

const dirs: string[] = []
const SMTP = {
  host: 'smtp.example.test',
  port: 587,
  security: 'starttls' as const,
  username: 'mailer',
  password: 'stored-smtp-password',
  from: 'HRack <hello@example.test>'
}

const EMPTY_ENV = [
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
  'EMAIL_VERIFICATION_REQUIRED',
  'SETTINGS_ENC_KEY'
] as const

beforeEach(() => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-settings-'))
  dirs.push(dir)
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 7).toString('base64'))
  vi.stubEnv('BETTER_AUTH_URL', 'http://localhost:3000')
  vi.stubEnv('BETTER_AUTH_SECRET', 'settings-test-secret-at-least-32-bytes')
  vi.stubEnv('NODE_ENV', 'production')
  vi.stubEnv('ADMIN_SETUP_TOKEN', 'settings-test-setup-token-24-bytes')
  for (const key of EMPTY_ENV) vi.stubEnv(key, '')
  vi.spyOn(console, 'info').mockImplementation(() => undefined)
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('encrypted administrator settings', () => {
  it('stores ciphertext and round-trips SMTP without plaintext secrets', () => {
    writeSetting('smtp', SMTP, 'admin-id')
    expect(readSetting('smtp')).toEqual(SMTP)

    const row = getDb().select().from(platformSettings).get()!
    expect(row.updatedBy).toBe('admin-id')
    expect(row.ciphertext.toString('utf8')).not.toContain(SMTP.password)
    expect(row.nonce).toHaveLength(12)
  })

  it('never returns the saved SMTP password from the settings view', async () => {
    const view = await saveMailSettings({ smtp: SMTP }, 'admin-id')
    expect(view.smtp.passwordConfigured).toBe(true)
    expect(JSON.stringify(view)).not.toContain(SMTP.password)
    expect(getMailSettingsView().smtp.source).toBe('db')
  })

  it('requires ready mail before enabling verification', async () => {
    await expect(
      saveMailSettings({ emailVerificationRequired: true }, 'admin-id')
    ).rejects.toMatchObject({
      status: 409,
      code: 'MAIL_UNAVAILABLE'
    })

    const view = await saveMailSettings(
      { smtp: SMTP, emailVerificationRequired: true },
      'admin-id'
    )
    expect(view.emailVerificationRequired).toMatchObject({
      value: true,
      source: 'db'
    })
    expect(loadRuntimeConfig().emailVerificationRequired).toBe(true)
  })

  it('rejects writes to environment-pinned settings', async () => {
    vi.stubEnv('EMAIL_VERIFICATION_REQUIRED', 'false')
    await expect(
      saveMailSettings({ emailVerificationRequired: true }, 'admin-id')
    ).rejects.toBeInstanceOf(SettingsMutationError)

    vi.stubEnv('SMTP_HOST', 'pinned.smtp.example')
    await expect(saveMailSettings({ smtp: SMTP }, 'admin-id')).rejects.toMatchObject(
      { status: 409, code: 'PINNED' }
    )
  })

  it('serializes overlapping OAuth writes and reloads the final provider', async () => {
    await Promise.all([
      saveOAuthSettings(
        {
          provider: 'github',
          enabled: true,
          clientId: 'first-client',
          clientSecret: 'first-secret'
        },
        'admin-id'
      ),
      saveOAuthSettings(
        {
          provider: 'github',
          enabled: true,
          clientId: 'last-client',
          clientSecret: 'last-secret'
        },
        'admin-id'
      )
    ])

    expect(readSetting('github')).toEqual({
      clientId: 'last-client',
      clientSecret: 'last-secret'
    })
    expect(loadRuntimeConfig().github?.clientId).toBe('last-client')
    const options = getAuth().options as {
      socialProviders?: { github?: { clientId?: string } }
    }
    expect(options.socialProviders?.github?.clientId).toBe('last-client')
    const view = getOAuthSettingsView()
    expect(view.github.clientSecretConfigured).toBe(true)
    expect(JSON.stringify(view)).not.toContain('last-secret')
  })

  it('does not decrypt ignored database rows when complete env settings pin them', () => {
    writeSetting('smtp', SMTP, 'admin-id')
    writeSetting(
      'github',
      { clientId: 'stored-id', clientSecret: 'stored-secret' },
      'admin-id'
    )
    vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 9).toString('base64'))
    vi.stubEnv('MAIL_PROVIDER', 'console')
    vi.stubEnv('GITHUB_CLIENT_ID', 'env-id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', 'env-secret')

    expect(getMailSettingsView().smtp.source).toBe('env')
    expect(getOAuthSettingsView().github).toMatchObject({
      clientId: 'env-id',
      source: 'env',
      enabled: true
    })
    expect(loadRuntimeConfig().github?.clientSecret).toBe('env-secret')
  })
})
