import nodemailer from 'nodemailer'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import { verificationEmail } from './message'
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

  return {
    kind: 'smtp',
    async send(message) {
      const content = verificationEmail(message.otp)
      const result = await transport.sendMail({
        from: config.from,
        to: message.email,
        ...content
      })
      if (result.rejected.length > 0) {
        throw new Error('SMTP rejected the verification email')
      }
    }
  }
}
