import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  isMailReady,
  MailUnavailableError,
  resolveMailProvider
} from './provider'
import type { SmtpConfig } from './smtp'

const STORED_SMTP: SmtpConfig = {
  host: 'db.smtp.example',
  port: 587,
  security: 'starttls',
  username: 'db-user',
  password: 'db-password',
  from: 'HRack <db@example.test>'
}

const ENV_KEYS = [
  'MAIL_PROVIDER',
  'RESEND_API_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
  'SMTP_SECURITY'
] as const

beforeEach(() => {
  for (const key of ENV_KEYS) vi.stubEnv(key, '')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe('mail provider resolution', () => {
  it('uses console by default outside production', async () => {
    vi.stubEnv('NODE_ENV', 'test')
    await expect(resolveMailProvider()).resolves.toMatchObject({
      kind: 'console'
    })
  })

  it('is unavailable in production without configured delivery', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(resolveMailProvider()).rejects.toBeInstanceOf(
      MailUnavailableError
    )
    await expect(isMailReady()).resolves.toBe(false)
  })

  it('pins Resend over stored SMTP', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_PROVIDER', 'resend')
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    await expect(resolveMailProvider(STORED_SMTP)).resolves.toMatchObject({
      kind: 'resend'
    })
  })

  it('does not fall back from pinned Resend to stored SMTP', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_PROVIDER', 'resend')
    await expect(resolveMailProvider(STORED_SMTP)).rejects.toBeInstanceOf(
      MailUnavailableError
    )
  })

  it('does not fill pinned SMTP fields from stored settings', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_PROVIDER', 'smtp')
    vi.stubEnv('SMTP_HOST', 'env.smtp.example')
    await expect(resolveMailProvider(STORED_SMTP)).rejects.toBeInstanceOf(
      MailUnavailableError
    )
  })

  it('prefers resolved SMTP over Resend when the kind is not pinned', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('RESEND_API_KEY', 're_test_key')
    await expect(resolveMailProvider(STORED_SMTP)).resolves.toMatchObject({
      kind: 'smtp'
    })
  })

  it('combines non-empty env SMTP fields with stored settings', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_HOST', 'env.smtp.example')
    await expect(resolveMailProvider(STORED_SMTP)).resolves.toMatchObject({
      kind: 'smtp'
    })
  })

  it('treats an invalid pinned SMTP port as unavailable', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('SMTP_PORT', 'not-a-port')
    await expect(resolveMailProvider(STORED_SMTP)).rejects.toBeInstanceOf(
      MailUnavailableError
    )
  })

  it('rejects plaintext SMTP in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    await expect(
      resolveMailProvider({ ...STORED_SMTP, security: 'none' })
    ).rejects.toBeInstanceOf(MailUnavailableError)
  })

  it('suppresses forced console OTP output in production', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-mail-console-'))
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('MAIL_PROVIDER', 'console')
    vi.stubEnv('HRACK_WEB_DATA', dir)
    const info = vi.spyOn(console, 'info').mockImplementation(() => undefined)

    try {
      const provider = await resolveMailProvider(STORED_SMTP)
      await provider.send({
        email: 'hidden@example.test',
        otp: '123456',
        at: Date.now()
      })
      expect(info).toHaveBeenCalledWith(
        '[mail.console] verification OTP suppressed in production'
      )
      expect(info.mock.calls.flat().join(' ')).not.toContain('123456')
      expect(fs.existsSync(path.join(dir, 'last-otp.json'))).toBe(false)
    } finally {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })
})
