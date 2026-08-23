import { createHash } from 'node:crypto'
import { and, asc, eq, isNull, or } from 'drizzle-orm'
import { getDb } from '../db'
import {
  pairingProjectionState,
  pairings,
  user
} from '../db/schema'
import {
  openPairingRevokeToken,
  PairingTokenFormatError
} from './token'

export interface DesiredPairingRoom {
  roomId: string
  revokeDigest: string
}

export interface PairingProjection {
  revision: number
  rooms: DesiredPairingRoom[]
}

export function revokeDigest(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('base64url')
}

function isRelayRoomId(value: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false
  const decoded = Buffer.from(value, 'base64url')
  return decoded.byteLength === 16 && decoded.toString('base64url') === value
}

/** Read one SQLite snapshot of the durable pairing identity projection. */
export function readPairingProjection(): PairingProjection {
  return getDb().transaction((transaction) => {
    const rows = transaction
      .select({
        id: pairings.id,
        roomId: pairings.roomId,
        revokeTokenEnc: pairings.revokeTokenEnc
      })
      .from(pairings)
      .innerJoin(user, eq(pairings.userId, user.id))
      .where(
        and(
          eq(pairings.status, 'active'),
          or(eq(user.banned, false), isNull(user.banned))
        )
      )
      .orderBy(asc(pairings.roomId))
      .all()
    const rooms: DesiredPairingRoom[] = []
    const quarantine = (id: string): void => {
      transaction
        .update(pairings)
        .set({ status: 'stale' })
        .where(
          and(
            eq(pairings.id, id),
            eq(pairings.status, 'active')
          )
        )
        .run()
    }
    for (const row of rows) {
      if (!isRelayRoomId(row.roomId)) {
        quarantine(row.id)
        continue
      }
      try {
        rooms.push({
          roomId: row.roomId,
          revokeDigest: revokeDigest(
            openPairingRevokeToken(row.revokeTokenEnc)
          )
        })
      } catch (error) {
        if (!(error instanceof PairingTokenFormatError)) throw error
        quarantine(row.id)
      }
    }
    const state = transaction
      .select({ revision: pairingProjectionState.revision })
      .from(pairingProjectionState)
      .where(eq(pairingProjectionState.singleton, 1))
      .get()
    if (!state) throw new Error('pairing projection state is missing')

    return {
      revision: state.revision,
      rooms
    }
  })
}
