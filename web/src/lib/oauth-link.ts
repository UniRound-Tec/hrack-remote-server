import { and, eq, or } from 'drizzle-orm'
import { getDb } from './db'
import * as authSchema from './db/auth-schema'

/**
 * Remove only an unverified, credential-only identity before trusted OAuth
 * linking. Verified or multi-provider users are never touched.
 */
export async function deleteUnverifiedCredentialOnlyUserByEmail(
  email: string
): Promise<void> {
  const { account, session, user, verification } = authSchema
  const db = getDb()
  const existing = db
    .select()
    .from(user)
    .where(and(eq(user.email, email.toLowerCase()), eq(user.emailVerified, false)))
    .get()
  if (!existing) return

  const accounts = db
    .select()
    .from(account)
    .where(eq(account.userId, existing.id))
    .all()
  if (accounts.length !== 1 || accounts[0]?.providerId !== 'credential') return

  db.transaction((tx) => {
    tx.delete(session).where(eq(session.userId, existing.id)).run()
    tx.delete(account).where(eq(account.userId, existing.id)).run()
    tx.delete(verification)
      .where(
        or(
          eq(verification.identifier, existing.email),
          eq(
            verification.identifier,
            `email-verification-otp-${existing.email}`
          )
        )
      )
      .run()
    tx.delete(user).where(eq(user.id, existing.id)).run()
  })
}
