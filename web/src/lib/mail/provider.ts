import { eq } from 'drizzle-orm'
import { getDb } from '../db'
import { otpSendGuard } from '../db/schema'
import { emptyToUndef } from '../settings/resolve'
import { sendConsoleOtp } from './console'

const RESEND_COOLDOWN_MS = 60_000
const RESEND_WINDOW_MS = 60 * 60_000
const RESEND_WINDOW_MAX = 3

export class MailUnavailableError extends Error {
  constructor() {
    super('Mail unavailable')
    this.name = 'MailUnavailableError'
  }
}

function consoleIsReady(): boolean {
  const provider = emptyToUndef(process.env.MAIL_PROVIDER)?.toLowerCase()
  if (provider === 'console') return true
  if (provider !== undefined) return false
  return process.env.NODE_ENV !== 'production'
}

/** PR2 provides console delivery. PR3 adds SMTP and Resend resolution. */
export async function isMailReady(): Promise<boolean> {
  return consoleIsReady()
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
  if (!(await isMailReady())) throw new MailUnavailableError()

  const normalized = email.trim().toLowerCase()
  const now = Date.now()
  if (!reserveSend(normalized, now)) return

  await sendConsoleOtp({ email: normalized, otp, at: now })
  getDb()
    .update(otpSendGuard)
    .set({ lastOkAt: Date.now() })
    .where(eq(otpSendGuard.email, normalized))
    .run()
}
