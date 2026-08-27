import { sql } from 'drizzle-orm'
import {
  blob,
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from 'drizzle-orm/sqlite-core'
import { user } from './auth-schema'

export * from './auth-schema'

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

/** Monotonic version of the account-owned desired Relay room set. */
export const pairingProjectionState = sqliteTable(
  'pairing_projection_state',
  {
    singleton: integer('singleton').primaryKey(),
    revision: integer('revision').notNull()
  },
  (table) => [
    check('pairing_projection_singleton_check', sql`${table.singleton} = 1`)
  ]
)

/** One active remote pairing per authenticated user. CRUD lands in pairing P3. */
export const pairings = sqliteTable(
  'pairings',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    roomId: text('room_id').notNull(),
    nodeId: text('node_id').notNull().default('us-1'),
    joinUrl: text('join_url').notNull(),
    revokeTokenEnc: text('revoke_token_enc').notNull(),
    status: text('status', { enum: ['active', 'revoked', 'stale'] })
      .notNull()
      .default('active'),
    createdAt: integer('created_at').notNull(),
    revokedAt: integer('revoked_at')
  },
  (table) => [
    index('pairings_room_id_idx').on(table.roomId),
    uniqueIndex('one_active_per_user')
      .on(table.userId)
      .where(sql`${table.status} = 'active'`)
  ]
)
