import { describe, expect, it } from 'vitest'
import { smtpTransportOptions, type SmtpConfig } from './smtp'

function config(overrides: Partial<SmtpConfig> = {}): SmtpConfig {
  return {
    host: 'smtp.example.test',
    port: 587,
    security: 'starttls',
    from: 'HRack <hello@example.test>',
    ...overrides
  }
}

describe('SMTP transport', () => {
  it('requires STARTTLS for starttls security', () => {
    expect(smtpTransportOptions(config())).toMatchObject({
      secure: false,
      requireTLS: true,
      ignoreTLS: false,
      disableFileAccess: true,
      disableUrlAccess: true
    })
  })

  it('uses implicit TLS and paired credentials', () => {
    expect(
      smtpTransportOptions(
        config({
          port: 465,
          security: 'tls',
          username: 'mailer',
          password: 'secret'
        })
      )
    ).toMatchObject({
      secure: true,
      requireTLS: false,
      ignoreTLS: false,
      auth: { user: 'mailer', pass: 'secret' }
    })
  })

  it('only permits plaintext SMTP when explicitly selected', () => {
    expect(
      smtpTransportOptions(config({ port: 2525, security: 'none' }))
    ).toMatchObject({ secure: false, requireTLS: false, ignoreTLS: true })
  })
})
