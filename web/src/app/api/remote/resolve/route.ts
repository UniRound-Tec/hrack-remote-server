import { getDb } from '@/lib/db'
import { pairings, user } from '@/lib/db/schema'
import { loadRelayNodes } from '@/lib/pairing/nodes'
import { and, eq, isNull, or } from 'drizzle-orm'
import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const RESPONSE_HEADERS = {
  'cache-control': 'no-store',
  'x-hrack-resolver': '1'
}

function isRoomId(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    return false
  }
  const decoded = Buffer.from(value, 'base64url')
  return decoded.byteLength === 16 && decoded.toString('base64url') === value
}

export async function POST(request: Request) {
  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > 1_024) {
    return NextResponse.json(
      { error: 'REQUEST_TOO_LARGE' },
      { status: 413, headers: RESPONSE_HEADERS }
    )
  }
  const body = (() => {
    try {
      return JSON.parse(text) as unknown
    } catch {
      return null
    }
  })()
  if (
    typeof body !== 'object' ||
    body === null ||
    Array.isArray(body) ||
    Object.keys(body).length !== 1 ||
    !('roomId' in body) ||
    !isRoomId(body.roomId)
  ) {
    return NextResponse.json(
      { error: 'INVALID_REQUEST' },
      { status: 400, headers: RESPONSE_HEADERS }
    )
  }

  const row = getDb()
    .select({ nodeId: pairings.nodeId })
    .from(pairings)
    .innerJoin(user, eq(pairings.userId, user.id))
    .where(
      and(
        eq(pairings.roomId, body.roomId),
        eq(pairings.status, 'active'),
        or(eq(user.banned, false), isNull(user.banned))
      )
    )
    .get()
  const node = row
    ? loadRelayNodes().find(
        (candidate) => candidate.id === row.nodeId && candidate.enabled
      )
    : undefined
  if (!node) {
    return NextResponse.json(
      { error: 'ROOM_NOT_FOUND' },
      { status: 404, headers: RESPONSE_HEADERS }
    )
  }

  return NextResponse.json(
    {
      v: 1,
      nodeId: node.id,
      region: node.region,
      label: node.label,
      relayOrigin: node.relayPublicOrigin,
      dshOrigin: node.dshPublicOrigin
    },
    { headers: RESPONSE_HEADERS }
  )
}
