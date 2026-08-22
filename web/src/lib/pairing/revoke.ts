import { and, eq } from 'drizzle-orm'
import { getDb } from '../db'
import { pairings } from '../db/schema'
import { openPairingRevokeToken } from './token'

export class PairingRevokeError extends Error {
  constructor() {
    super('Pairing revoke failed')
    this.name = 'PairingRevokeError'
  }
}

export async function revokeUserPairings(userId: string): Promise<number> {
  const active = getDb()
    .select()
    .from(pairings)
    .where(and(eq(pairings.userId, userId), eq(pairings.status, 'active')))
    .all()
  if (active.length === 0) return 0

  const origin = process.env.RELAY_INTERNAL_ORIGIN?.replace(/\/$/, '')
  if (!origin) throw new PairingRevokeError()

  for (const pairing of active) {
    let token: string
    try {
      token = openPairingRevokeToken(pairing.revokeTokenEnc)
    } catch {
      throw new PairingRevokeError()
    }
    let response: Response
    try {
      response = await fetch(
        `${origin}/remote/v1/rooms/${encodeURIComponent(pairing.roomId)}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5_000)
        }
      )
    } catch {
      throw new PairingRevokeError()
    }
    if (response.status !== 204 && response.status !== 404) {
      throw new PairingRevokeError()
    }
    getDb()
      .update(pairings)
      .set({ status: 'revoked', revokedAt: Date.now() })
      .where(eq(pairings.id, pairing.id))
      .run()
  }
  return active.length
}
