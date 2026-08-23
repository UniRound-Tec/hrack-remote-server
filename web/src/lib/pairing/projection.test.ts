import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb } from '../db'
import { pairings, user } from '../db/schema'
import { readPairingProjection } from './projection'
import { sealPairingRevokeToken } from './token'

const dirs: string[] = []
const RESTORE_TOKEN = Buffer.from(
  '0123456789abcdef0123456789abcdef',
  'utf8'
).toString('base64url')
const RESTORE_DIGEST = 'lCCDKDlTq8bBjwZVR19NQCqacFrzJhOEozO0hzjPZxo'

beforeEach(() => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-pairing-projection-'))
  dirs.push(dir)
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 8).toString('base64'))
  vi.stubEnv('BETTER_AUTH_URL', 'https://hrack.example')
})

afterEach(() => {
  closeDb()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('pairing projection', () => {
  it('versions every desired-state change and emits only active unbanned rooms', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values({
        id: 'user-id',
        name: 'User',
        email: 'user@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        banned: false
      })
      .run()

    expect(readPairingProjection()).toEqual({ revision: 0, rooms: [] })

    getDb()
      .insert(pairings)
      .values({
        id: 'pairing-id',
        userId: 'user-id',
        roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
        joinUrl: 'https://hrack.example/remote/MDEyMzQ1Njc4OWFiY2RlZg',
        revokeTokenEnc: sealPairingRevokeToken(RESTORE_TOKEN),
        status: 'active',
        createdAt: Date.now()
      })
      .run()

    expect(readPairingProjection()).toEqual({
      revision: 1,
      rooms: [
        {
          roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
          revokeDigest: RESTORE_DIGEST
        }
      ]
    })

    getDb().update(user).set({ banned: true }).where(eq(user.id, 'user-id')).run()
    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })

    getDb().update(user).set({ banned: false }).where(eq(user.id, 'user-id')).run()
    expect(readPairingProjection()).toMatchObject({ revision: 3, rooms: [{}] })

    getDb()
      .update(pairings)
      .set({ status: 'revoked', revokedAt: Date.now() })
      .where(eq(pairings.id, 'pairing-id'))
      .run()
    expect(readPairingProjection()).toEqual({ revision: 4, rooms: [] })

    getDb().delete(pairings).where(eq(pairings.id, 'pairing-id')).run()
    expect(readPairingProjection()).toEqual({ revision: 5, rooms: [] })
  })

  it('versions account deletion after the pairing row cascades away', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values({
        id: 'deleted-user',
        name: 'Deleted User',
        email: 'deleted@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        banned: false
      })
      .run()
    getDb()
      .insert(pairings)
      .values({
        id: 'deleted-pairing',
        userId: 'deleted-user',
        roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
        joinUrl: 'https://hrack.example/remote/MDEyMzQ1Njc4OWFiY2RlZg',
        revokeTokenEnc: sealPairingRevokeToken(RESTORE_TOKEN),
        status: 'active',
        createdAt: Date.now()
      })
      .run()
    expect(readPairingProjection().revision).toBe(1)

    getDb().delete(user).where(eq(user.id, 'deleted-user')).run()

    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
  })

  it('quarantines an unreadable credential without blocking healthy accounts', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values([
        {
          id: 'healthy-user',
          name: 'Healthy User',
          email: 'healthy@example.test',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          role: 'user',
          banned: false
        },
        {
          id: 'broken-user',
          name: 'Broken User',
          email: 'broken@example.test',
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          role: 'user',
          banned: false
        }
      ])
      .run()
    getDb()
      .insert(pairings)
      .values([
        {
          id: 'healthy-pairing',
          userId: 'healthy-user',
          roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
          joinUrl: 'https://hrack.example/remote/MDEyMzQ1Njc4OWFiY2RlZg',
          revokeTokenEnc: sealPairingRevokeToken(RESTORE_TOKEN),
          status: 'active',
          createdAt: Date.now()
        },
        {
          id: 'broken-pairing',
          userId: 'broken-user',
          roomId: 'ZmVkY2JhOTg3NjU0MzIxMA',
          joinUrl: 'https://hrack.example/remote/ZmVkY2JhOTg3NjU0MzIxMA',
          revokeTokenEnc: 'not-a-valid-secretbox',
          status: 'active',
          createdAt: Date.now()
        }
      ])
      .run()

    const expected = {
      revision: 3,
      rooms: [
        {
          roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
          revokeDigest: RESTORE_DIGEST
        }
      ]
    }
    expect(readPairingProjection()).toEqual(expected)
    expect(readPairingProjection()).toEqual(expected)
  })

  it('quarantines a room identity that Relay cannot restore', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values({
        id: 'invalid-room-user',
        name: 'Invalid Room User',
        email: 'invalid-room@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        banned: false
      })
      .run()
    getDb()
      .insert(pairings)
      .values({
        id: 'invalid-room-pairing',
        userId: 'invalid-room-user',
        roomId: 'not-a-relay-room-id',
        joinUrl: 'https://hrack.example/remote/not-a-relay-room-id',
        revokeTokenEnc: sealPairingRevokeToken(RESTORE_TOKEN),
        status: 'active',
        createdAt: Date.now()
      })
      .run()

    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
  })

  it('quarantines a room URL from an incompatible public origin', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values({
        id: 'old-origin-user',
        name: 'Old Origin User',
        email: 'old-origin@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        banned: false
      })
      .run()
    getDb()
      .insert(pairings)
      .values({
        id: 'old-origin-pairing',
        userId: 'old-origin-user',
        roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
        joinUrl: 'https://old.example/remote/MDEyMzQ1Njc4OWFiY2RlZg',
        revokeTokenEnc: sealPairingRevokeToken(RESTORE_TOKEN),
        status: 'active',
        createdAt: Date.now()
      })
      .run()

    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
  })

  it('quarantines a decrypted credential that Relay cannot use', () => {
    const now = new Date()
    getDb()
      .insert(user)
      .values({
        id: 'invalid-token-user',
        name: 'Invalid Token User',
        email: 'invalid-token@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        role: 'user',
        banned: false
      })
      .run()
    getDb()
      .insert(pairings)
      .values({
        id: 'invalid-token-pairing',
        userId: 'invalid-token-user',
        roomId: 'MDEyMzQ1Njc4OWFiY2RlZg',
        joinUrl: 'https://hrack.example/remote/MDEyMzQ1Njc4OWFiY2RlZg',
        revokeTokenEnc: sealPairingRevokeToken('not-a-relay-token'),
        status: 'active',
        createdAt: Date.now()
      })
      .run()

    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
    expect(readPairingProjection()).toEqual({ revision: 2, rooms: [] })
  })
})
