import { and, count, eq } from 'drizzle-orm'
import { APIError } from 'better-auth/api'
import { getDb } from '../db'
import * as authSchema from '../db/auth-schema'

export async function countActiveAdmins(): Promise<number> {
  const user = authSchema.user
  return (
    getDb()
      .select({ value: count() })
      .from(user)
      .where(and(eq(user.role, 'admin'), eq(user.banned, false)))
      .get()?.value ?? 0
  )
}

type AdminMutationContext = {
  path: string
  body?: unknown
}

export async function assertNotLastAdmin(
  ctx: AdminMutationContext
): Promise<void> {
  const user = authSchema.user
  const body = ctx.body as { userId?: string; role?: string | string[] } | undefined
  const userId = body?.userId
  if (!userId) return

  const target = getDb().select().from(user).where(eq(user.id, userId)).get()
  if (!target || target.role !== 'admin' || target.banned) return

  if (ctx.path === '/admin/set-role') {
    const roles = Array.isArray(body.role) ? body.role : [body.role]
    if (roles.includes('admin')) return
  }

  if ((await countActiveAdmins()) === 1) {
    throw new APIError('FORBIDDEN', {
      code: 'LAST_ADMIN',
      message: 'The last active admin cannot be changed'
    })
  }
}
