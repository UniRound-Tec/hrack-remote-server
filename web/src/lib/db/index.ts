import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import * as schema from './schema'

export type WebDatabase = BetterSQLite3Database<typeof schema>
type Sqlite = InstanceType<typeof Database>

let cached: WebDatabase | undefined
let sqliteHandle: Sqlite | undefined

function dataDir(): string {
  return process.env.HRACK_WEB_DATA ?? path.join(process.cwd(), 'data')
}

function drizzleFolder(): string {
  return process.env.HRACK_DRIZZLE_DIR ?? path.join(process.cwd(), 'drizzle')
}

/**
 * Lazy SQLite open. Safe to import during `next build` — this function
 * must be the only way the file is created.
 */
export function getDb(): WebDatabase {
  if (cached) return cached
  const dir = dataDir()
  fs.mkdirSync(dir, { recursive: true })
  const sqlite = new Database(path.join(dir, 'app.db'))
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('synchronous = NORMAL')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder: drizzleFolder() })
  sqliteHandle = sqlite
  cached = db
  return db
}

/** Drop the cached connection. Tests must call this before deleting the data dir. */
export function closeDb(): void {
  sqliteHandle?.close()
  sqliteHandle = undefined
  cached = undefined
}
