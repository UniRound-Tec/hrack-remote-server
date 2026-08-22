import { integer, sqliteTable, text, blob } from 'drizzle-orm/sqlite-core'

/** Encrypted platform settings (SMTP/OAuth). Secrets live in ciphertext only. */
export const platformSettings = sqliteTable('platform_settings', {
  key: text('key').primaryKey(),
  alg: text('alg').notNull().default('aes-256-gcm-v1'),
  keyVersion: integer('key_version').notNull().default(1),
  nonce: blob('nonce', { mode: 'buffer' }).notNull(),
  ciphertext: blob('ciphertext', { mode: 'buffer' }).notNull(),
  updatedAt: integer('updated_at').notNull(),
  updatedBy: text('updated_by')
})

/** Operator actions. Field names only — never secrets, OTP, or passwords. */
export const adminAudit = sqliteTable('admin_audit', {
  id: text('id').primaryKey(),
  at: integer('at').notNull(),
  actorId: text('actor_id'),
  action: text('action').notNull(),
  target: text('target'),
  fields: text('fields')
})

/** Per-email OTP send budget. last_ok_at is set only after provider.send() resolves. */
export const otpSendGuard = sqliteTable('otp_send_guard', {
  email: text('email').primaryKey(),
  windowStart: integer('window_start').notNull(),
  count: integer('count').notNull(),
  lastAttemptAt: integer('last_attempt_at').notNull(),
  lastOkAt: integer('last_ok_at')
})
