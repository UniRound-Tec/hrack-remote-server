import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { APIError } from 'better-auth/api'
import { getAuth } from '../auth'
import { getDb } from '../db'
import { user } from '../db/auth-schema'
import { PairingRevokeError, revokeUserPairings } from '../pairing/revoke'
import { recordAudit } from './audit'
import { assertNotLastAdmin } from './last-admin'

export type UserAction =
  | { action: 'ban'; userId: string }
  | { action: 'unban'; userId: string }
  | { action: 'verify'; userId: string }
  | { action: 'delete'; userId: string; confirmEmail: string }
  | { action: 'role'; userId: string; role: 'user' | 'admin' }
  | { action: 'resetPassword'; userId: string }
  | { action: 'revokeSessions'; userId: string }

export class AdminUserError extends Error {
  constructor(
    readonly status: 400 | 404 | 409 | 502,
    readonly code: string
  ) {
    super(code)
    this.name = 'AdminUserError'
  }
}

let mutationChain: Promise<void> = Promise.resolve()

function serialized<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationChain.then(operation, operation)
  mutationChain = result.then(
    () => undefined,
    () => undefined
  )
  return result
}

function target(userId: string) {
  const result = getDb().select().from(user).where(eq(user.id, userId)).get()
  if (!result) throw new AdminUserError(404, 'USER_NOT_FOUND')
  return result
}

function apiCode(error: APIError): string | undefined {
  const body = error.body as { code?: unknown } | undefined
  return typeof body?.code === 'string' ? body.code : undefined
}

function mapApiError(error: unknown): never {
  if (error instanceof AdminUserError) throw error
  if (error instanceof PairingRevokeError) {
    throw new AdminUserError(502, 'PAIRING_REVOKE_FAILED')
  }
  if (error instanceof APIError) {
    const code = apiCode(error)
    if (code === 'LAST_ADMIN') throw new AdminUserError(409, code)
    if (error.statusCode === 404) {
      throw new AdminUserError(404, code ?? 'USER_NOT_FOUND')
    }
    throw new AdminUserError(400, code ?? 'USER_MUTATION_FAILED')
  }
  throw new AdminUserError(502, 'USER_MUTATION_FAILED')
}

export async function listUsers(
  headers: Headers,
  search: string,
  offset: number
) {
  return getAuth().api.listUsers({
    headers,
    query: {
      limit: 50,
      offset,
      sortBy: 'createdAt',
      sortDirection: 'desc',
      ...(search
        ? {
            searchValue: search,
            searchField: 'email' as const,
            searchOperator: 'contains' as const
          }
        : {})
    }
  })
}

export function mutateUser(
  input: UserAction,
  actorId: string,
  headers: Headers
): Promise<{ temporaryPassword?: string }> {
  return serialized(async () => {
    try {
      const auth = getAuth()
      const current = target(input.userId)
      switch (input.action) {
        case 'ban':
          await assertNotLastAdmin({
            path: '/admin/ban-user',
            body: { userId: input.userId }
          })
          await auth.api.banUser({ headers, body: { userId: input.userId } })
          recordAudit(actorId, 'user.ban', input.userId, ['banned'])
          break
        case 'unban':
          await auth.api.unbanUser({ headers, body: { userId: input.userId } })
          recordAudit(actorId, 'user.unban', input.userId, ['banned'])
          break
        case 'verify':
          await auth.api.adminUpdateUser({
            headers,
            body: { userId: input.userId, data: { emailVerified: true } }
          })
          recordAudit(actorId, 'user.verify', input.userId, [
            'emailVerified'
          ])
          break
        case 'role':
          await assertNotLastAdmin({
            path: '/admin/set-role',
            body: { userId: input.userId, role: input.role }
          })
          await auth.api.setRole({
            headers,
            body: { userId: input.userId, role: input.role }
          })
          recordAudit(actorId, 'user.role', input.userId, ['role'])
          break
        case 'revokeSessions':
          await auth.api.revokeUserSessions({
            headers,
            body: { userId: input.userId }
          })
          recordAudit(actorId, 'user.sessions_revoke', input.userId, [
            'sessions'
          ])
          break
        case 'resetPassword': {
          const temporaryPassword = randomBytes(18).toString('base64url')
          await auth.api.setUserPassword({
            headers,
            body: { userId: input.userId, newPassword: temporaryPassword }
          })
          await auth.api.revokeUserSessions({
            headers,
            body: { userId: input.userId }
          })
          recordAudit(actorId, 'user.password_reset', input.userId, [
            'credential',
            'sessions'
          ])
          return { temporaryPassword }
        }
        case 'delete':
          if (
            input.confirmEmail.trim().toLowerCase() !==
            current.email.toLowerCase()
          ) {
            throw new AdminUserError(400, 'EMAIL_CONFIRMATION_MISMATCH')
          }
          if (actorId === input.userId) {
            throw new AdminUserError(400, 'CANNOT_DELETE_SELF')
          }
          await assertNotLastAdmin({
            path: '/admin/remove-user',
            body: { userId: input.userId }
          })
          await revokeUserPairings(input.userId)
          await auth.api.removeUser({
            headers,
            body: { userId: input.userId }
          })
          recordAudit(actorId, 'user.delete', input.userId, [
            'account',
            'pairings',
            'sessions'
          ])
          break
      }
      return {}
    } catch (error) {
      mapApiError(error)
    }
  })
}
