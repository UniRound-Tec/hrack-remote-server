import { eq } from 'drizzle-orm'
import { open, seal, loadSettingsKey, settingsAad } from '../crypto/secretbox'
import { getDb } from '../db'
import { platformSettings } from '../db/schema'
import type { SettingKey, StoredSettings } from './types'

const ALGORITHM = 'aes-256-gcm-v1'
const KEY_VERSION = 1

export function readSetting<K extends SettingKey>(
  key: K
): StoredSettings[K] | undefined {
  const row = getDb()
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .get()
  if (!row) return undefined
  if (row.alg !== ALGORITHM || row.keyVersion !== KEY_VERSION) {
    throw new Error('Unsupported encrypted setting format')
  }
  const plaintext = open(
    row.ciphertext,
    row.nonce,
    settingsAad(key),
    loadSettingsKey()
  )
  return JSON.parse(plaintext.toString('utf8')) as StoredSettings[K]
}

export function writeSetting<K extends SettingKey>(
  key: K,
  value: StoredSettings[K],
  actorId: string
): void {
  const encrypted = seal(
    Buffer.from(JSON.stringify(value), 'utf8'),
    settingsAad(key),
    loadSettingsKey()
  )
  getDb()
    .insert(platformSettings)
    .values({
      key,
      alg: ALGORITHM,
      keyVersion: KEY_VERSION,
      nonce: encrypted.nonce,
      ciphertext: encrypted.ciphertext,
      updatedAt: Date.now(),
      updatedBy: actorId
    })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: {
        alg: ALGORITHM,
        keyVersion: KEY_VERSION,
        nonce: encrypted.nonce,
        ciphertext: encrypted.ciphertext,
        updatedAt: Date.now(),
        updatedBy: actorId
      }
    })
    .run()
}

export function deleteSetting(key: SettingKey): boolean {
  return (
    getDb()
      .delete(platformSettings)
      .where(eq(platformSettings.key, key))
      .run().changes > 0
  )
}
