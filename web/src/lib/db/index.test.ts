import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { platformSettings } from './schema'

describe('getDb', () => {
  const dirs: string[] = []

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(async () => {
    const mod = await import('./index')
    mod.closeDb()
    for (const dir of dirs.splice(0)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  })

  it('does not open SQLite on import', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-db-import-'))
    dirs.push(dir)
    process.env.HRACK_WEB_DATA = dir
    await import('./index')
    expect(fs.existsSync(path.join(dir, 'app.db'))).toBe(false)
  })

  it('creates platform tables on first getDb()', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-db-open-'))
    dirs.push(dir)
    process.env.HRACK_WEB_DATA = dir
    process.env.HRACK_DRIZZLE_DIR = path.join(process.cwd(), 'drizzle')
    const { getDb } = await import('./index')
    const db = getDb()
    const nonce = Buffer.alloc(12, 1)
    const ciphertext = Buffer.alloc(32, 2)
    db.insert(platformSettings)
      .values({
        key: 'smtp.password',
        nonce,
        ciphertext,
        updatedAt: 1
      })
      .run()
    const row = db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, 'smtp.password'))
      .get()
    expect(row?.key).toBe('smtp.password')
    expect(Buffer.from(row!.nonce).equals(nonce)).toBe(true)
    expect(fs.existsSync(path.join(dir, 'app.db'))).toBe(true)
  })
})

