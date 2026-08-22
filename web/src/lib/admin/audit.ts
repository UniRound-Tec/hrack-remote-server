import { randomUUID } from 'node:crypto'
import { desc } from 'drizzle-orm'
import { getDb } from '../db'
import { adminAudit } from '../db/schema'

export type AuditAction =
  | 'settings.mail.update'
  | 'settings.mail.clear'
  | 'settings.mail.test'
  | 'settings.oauth.update'
  | 'settings.oauth.clear'
  | 'user.ban'
  | 'user.unban'
  | 'user.verify'
  | 'user.delete'
  | 'user.role'
  | 'user.password_reset'
  | 'user.sessions_revoke'

export function recordAudit(
  actorId: string,
  action: AuditAction,
  target: string | null,
  fields: string[] = []
): void {
  try {
    getDb()
      .insert(adminAudit)
      .values({
        id: randomUUID(),
        at: Date.now(),
        actorId,
        action,
        target,
        fields: JSON.stringify([...new Set(fields)].sort())
      })
      .run()
  } catch {
    console.error(
      JSON.stringify({ event: 'admin.audit_write_failed', level: 'error' })
    )
  }
}

export function listAudit(offset: number, limit = 50) {
  return getDb()
    .select()
    .from(adminAudit)
    .orderBy(desc(adminAudit.at))
    .limit(limit)
    .offset(offset)
    .all()
    .map((row) => ({
      ...row,
      fields: row.fields ? (JSON.parse(row.fields) as string[]) : []
    }))
}
