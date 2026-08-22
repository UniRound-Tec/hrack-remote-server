import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { otpSendGuard } from '../db/schema'
import { emptyToUndef } from '../settings/resolve'
import { sendConsoleOtp } from './console'
import { createResendProvider } from './resend'
import {
  createSmtpProvider,
  type SmtpConfig,
  type SmtpSecurity
} from './smtp'
import type { MailProvider } from './types'

const RESEND_COOLDOWN_MS = 60_000
const RESEND_WINDOW_MS = 60 * 60_000
const RESEND_WINDOW_MAX = 3

export class MailUnavailableError extends Error {
  constructor() {
    super('Mail unavailable')
    this.name = 'MailUnavailableError'
  }
}

const consoleProvider: MailProvider = {
  kind: 'console',
  send: sendConsoleOtp
}

const RESEND_SANDBOX_FROM = 'HRack <onboarding@resend.dev>'

function parsePort(value: string | undefined): number | undefined {
  if (!value || !/^\d+$/.test(value)) return undefined
  const port = Number(value)
  return port >= 1 && port <= 65_535 ? port : undefined
}

function parseSecurity(value: string | undefined): SmtpSecurity | undefined {
  return value === 'tls' || value === 'starttls' || value === 'none'
    ? value
    : undefined
}

function resolveSmtpConfig(stored?: SmtpConfig | null): SmtpConfig | undefined {
  const host = emptyToUndef(process.env.SMTP_HOST) ?? stored?.host
  const envPort = emptyToUndef(process.env.SMTP_PORT)
  const port = envPort === undefined ? stored?.port : parsePort(envPort)
  const envSecurity = emptyToUndef(process.env.SMTP_SECURITY)?.toLowerCase()
  const security =
    envSecurity === undefined
      ? stored?.security
      : parseSecurity(envSecurity)
  const username = emptyToUndef(process.env.SMTP_USER) ?? stored?.username
  const password = emptyToUndef(process.env.SMTP_PASS) ?? stored?.password
  const from = emptyToUndef(process.env.SMTP_FROM) ?? stored?.from

  if (!host || !port || !security || !from) return undefined
  if (security === 'none' && process.env.NODE_ENV === 'production') {
    return undefined
  }
  if (Boolean(username) !== Boolean(password)) return undefined
  return { host, port, security, username, password, from }
}

function resendProvider(): MailProvider | undefined {
  const apiKey = emptyToUndef(process.env.RESEND_API_KEY)
  if (!apiKey) return undefined
  return createResendProvider({
    apiKey,
    from: emptyToUndef(process.env.SMTP_FROM) ?? RESEND_SANDBOX_FROM
  })
}

/**
 * Resolve the runtime mail transport. A non-empty MAIL_PROVIDER pins the kind
 * and never falls through to stored SMTP settings.
 */
export async function resolveMailProvider(
  storedSmtp?: SmtpConfig | null
): Promise<MailProvider> {
  const pinned = emptyToUndef(process.env.MAIL_PROVIDER)?.toLowerCase()
  if (pinned === 'console') return consoleProvider
  if (pinned === 'resend') {
    const provider = resendProvider()
    if (provider) return provider
    throw new MailUnavailableError()
  }
  if (pinned === 'smtp') {
    const config = resolveSmtpConfig()
    if (config) return createSmtpProvider(config)
    throw new MailUnavailableError()
  }
  if (pinned !== undefined) throw new MailUnavailableError()

  const smtp = resolveSmtpConfig(storedSmtp)
  if (smtp) return createSmtpProvider(smtp)
  const resend = resendProvider()
  if (resend) return resend
  if (process.env.NODE_ENV !== 'production') return consoleProvider
  throw new MailUnavailableError()
}

export async function isMailReady(): Promise<boolean> {
  try {
    await resolveMailProvider()
    return true
  } catch (error) {
    if (error instanceof MailUnavailableError) return false
    throw error
  }
}

function reserveSend(email: string, now: number): boolean {
  const db = getDb()
  return db.transaction((tx) => {
    const row = tx
      .select()
      .from(otpSendGuard)
      .where(eq(otpSendGuard.email, email))
      .get()

    if (row && now - row.lastAttemptAt < RESEND_COOLDOWN_MS) return false

    const inWindow = row && now - row.windowStart < RESEND_WINDOW_MS
    if (inWindow && row.count >= RESEND_WINDOW_MAX) return false

    const windowStart = inWindow ? row.windowStart : now
    const count = inWindow ? row.count + 1 : 1
    tx.insert(otpSendGuard)
      .values({
        email,
        windowStart,
        count,
        lastAttemptAt: now,
        lastOkAt: row?.lastOkAt ?? null
      })
      .onConflictDoUpdate({
        target: otpSendGuard.email,
        set: { windowStart, count, lastAttemptAt: now }
      })
      .run()
    return true
  })
}

export async function sendVerificationOTP({
  email,
  otp
}: {
  email: string
  otp: string
  type: 'email-verification'
}): Promise<void> {
  const provider = await resolveMailProvider()

  const normalized = email.trim().toLowerCase()
  const now = Date.now()
  if (!reserveSend(normalized, now)) return

  await provider.send({ email: normalized, otp, at: now })
  getDb()
    .update(otpSendGuard)
    .set({ lastOkAt: Date.now() })
    .where(eq(otpSendGuard.email, normalized))
    .run()
}
