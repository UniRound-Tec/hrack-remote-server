import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { testEmail, verificationEmail } from './message'
import type { MailProvider } from './types'

export type SmtpSecurity = 'tls' | 'starttls' | 'none'

export type SmtpConfig = {
  host: string
  port: number
  security: SmtpSecurity
  username?: string
  password?: string
  from: string
}

export function smtpTransportOptions(
  config: SmtpConfig
): SMTPTransport.Options {
  return {
    host: config.host,
    port: config.port,
    secure: config.security === 'tls',
    requireTLS: config.security === 'starttls',
    ignoreTLS: config.security === 'none',
    auth:
      config.username && config.password
        ? { user: config.username, pass: config.password }
        : undefined,
    disableFileAccess: true,
    disableUrlAccess: true
  }
}

export function createSmtpProvider(config: SmtpConfig): MailProvider {
  const transport = nodemailer.createTransport(smtpTransportOptions(config))

  async function send(email: string, content: ReturnType<typeof testEmail>) {
    const result = await transport.sendMail({
      from: config.from,
      to: email,
      ...content
    })
    if (result.rejected.length > 0) {
      throw new Error('SMTP rejected the verification email')
    }
  }

  return {
    kind: 'smtp',
    async send(message) {
      await send(message.email, verificationEmail(message.otp))
    },
    async sendTest(email) {
      await send(email, testEmail())
    }
  }
}
