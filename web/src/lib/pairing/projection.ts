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

function isRelayRevokeToken(value: string): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false
  const decoded = Buffer.from(value, 'base64url')
  return decoded.byteLength === 32 && decoded.toString('base64url') === value
}

function pairingPublicOrigin(): string {
  const value = process.env.BETTER_AUTH_URL
  if (!value) throw new Error('BETTER_AUTH_URL is required')
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error('BETTER_AUTH_URL must contain only scheme and authority')
  }
  return url.origin
}

/** Read one SQLite snapshot of the durable pairing identity projection. */
export function readPairingProjection(): PairingProjection {
  const publicOrigin = pairingPublicOrigin()
  return getDb().transaction((transaction) => {
    const rows = transaction
      .select({
        id: pairings.id,
        roomId: pairings.roomId,
        joinUrl: pairings.joinUrl,
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
      if (
        !isRelayRoomId(row.roomId) ||
        row.joinUrl !== `${publicOrigin}/remote/${row.roomId}`
      ) {
        quarantine(row.id)
        continue
      }
      try {
        const token = openPairingRevokeToken(row.revokeTokenEnc)
        if (!isRelayRevokeToken(token)) {
          quarantine(row.id)
          continue
        }
        rooms.push({
          roomId: row.roomId,
          revokeDigest: revokeDigest(token)
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
