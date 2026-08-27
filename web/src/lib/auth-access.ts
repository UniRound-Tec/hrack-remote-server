import { and, eq, inArray } from 'drizzle-orm'
import { getDb } from './db'
import { account } from './db/auth-schema'

const TRUSTED_LOGIN_PROVIDERS = ['github', 'google', 'linux-do'] as const

export function hasTrustedOAuthIdentity(userId: string): boolean {
  return Boolean(
    getDb()
      .select({ id: account.id })
      .from(account)
      .where(
        and(
          eq(account.userId, userId),
          inArray(account.providerId, [...TRUSTED_LOGIN_PROVIDERS])
        )
      )
      .get()
  )
}

export function satisfiesVerificationPolicy(
  user: { id: string; emailVerified: boolean },
  emailVerificationRequired: boolean
): boolean {
  return (
    !emailVerificationRequired ||
    user.emailVerified ||
    hasTrustedOAuthIdentity(user.id)
  )
}
