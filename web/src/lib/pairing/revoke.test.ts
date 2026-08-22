import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb } from '../db'
import { pairings, user } from '../db/schema'
import { revokeUserPairings } from './revoke'
import { openPairingRevokeToken, sealPairingRevokeToken } from './token'

const dirs: string[] = []

beforeEach(() => {
  closeDb()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-pairing-revoke-'))
  dirs.push(dir)
  vi.stubEnv('HRACK_WEB_DATA', dir)
  vi.stubEnv('HRACK_DRIZZLE_DIR', path.join(process.cwd(), 'drizzle'))
  vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 8).toString('base64'))
  vi.stubEnv('RELAY_INTERNAL_ORIGIN', 'http://relay.internal')
  getDb()
    .insert(user)
    .values({
      id: 'user-id',
      name: 'User',
      email: 'user@example.test',
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      role: 'user',
      banned: false
    })
    .run()
})

afterEach(() => {
  closeDb()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  for (const dir of dirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe('pairing revoke hook', () => {
  it('round-trips a purpose-bound stored revoke token', () => {
    const sealed = sealPairingRevokeToken('revoke-secret')
    expect(sealed).not.toContain('revoke-secret')
    expect(openPairingRevokeToken(sealed)).toBe('revoke-secret')
  })

  it.each([204, 404])('marks a pairing revoked after relay status %s', async (status) => {
    getDb()
      .insert(pairings)
      .values({
        id: 'pairing-id',
        userId: 'user-id',
        roomId: 'room-id',
        joinUrl: 'https://hrack.example/remote/#room-id',
        revokeTokenEnc: sealPairingRevokeToken('revoke-secret'),
        status: 'active',
        createdAt: Date.now()
      })
      .run()
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(null, { status }))

    await expect(revokeUserPairings('user-id')).resolves.toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'http://relay.internal/remote/v1/rooms/room-id',
      expect.objectContaining({
        method: 'DELETE',
        headers: { authorization: 'Bearer revoke-secret' }
      })
    )
    expect(getDb().select().from(pairings).get()).toMatchObject({
      status: 'revoked'
    })
  })
})
