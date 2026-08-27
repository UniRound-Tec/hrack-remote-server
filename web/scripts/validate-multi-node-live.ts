import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { getDb, closeDb } from '../src/lib/db'
import { pairings, pairingProjectionState, user } from '../src/lib/db/schema'
import { loadRelayNodes } from '../src/lib/pairing/nodes'
import { reconcilePairingsNow } from '../src/lib/pairing/lifecycle'
import { sealPairingRevokeToken } from '../src/lib/pairing/token'
import { eq } from 'drizzle-orm'

interface CreatedRoom {
  roomId: string
  joinUrl: string
  revokeToken: string
}

async function createRoom(
  relayOrigin: string,
  serviceToken: string,
  publicOrigin: string
): Promise<CreatedRoom> {
  const response = await fetch(`${relayOrigin}/remote/v1/rooms`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${serviceToken}`,
      'content-type': 'application/json',
      origin: publicOrigin
    },
    body: '{}'
  })
  if (response.status !== 201) {
    throw new Error(`room creation failed: HTTP ${response.status}`)
  }
  return (await response.json()) as CreatedRoom
}

async function bootstrapRelay(origin: string, token: string): Promise<void> {
  const response = await fetch(`${origin}/remote/v1/system/rooms`, {
    method: 'PUT',
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({ revision: 0, rooms: [] })
  })
  if (!response.ok) {
    throw new Error(`Relay bootstrap failed: HTTP ${response.status}`)
  }
}

async function relayState(origin: string, token: string): Promise<unknown> {
  const response = await fetch(`${origin}/remote/v1/system/state`, {
    headers: { authorization: `Bearer ${token}` }
  })
  if (!response.ok) throw new Error(`state failed: HTTP ${response.status}`)
  return response.json()
}

async function roomStatus(
  origin: string,
  token: string,
  roomId: string
): Promise<number> {
  return (
    await fetch(`${origin}/remote/v1/rooms/${encodeURIComponent(roomId)}`, {
      headers: { authorization: `Bearer ${token}` }
    })
  ).status
}

async function main(): Promise<void> {
  const publicOrigin = process.env.BETTER_AUTH_URL
  if (!publicOrigin) throw new Error('BETTER_AUTH_URL is required')
  const nodes = loadRelayNodes()
  if (nodes.length < 2) throw new Error('two Relay nodes are required')
  const [first, second] = nodes
  if (!first || !second) throw new Error('two Relay nodes are required')

  await Promise.all([
    bootstrapRelay(first.relayInternalOrigin, first.serviceToken),
    bootstrapRelay(second.relayInternalOrigin, second.serviceToken)
  ])

  const [firstRoom, secondRoom] = await Promise.all([
    createRoom(first.relayInternalOrigin, first.serviceToken, publicOrigin),
    createRoom(second.relayInternalOrigin, second.serviceToken, publicOrigin)
  ])
  const now = new Date()
  getDb().transaction((transaction) => {
    for (const [index, node, room] of [
      [0, first, firstRoom] as const,
      [1, second, secondRoom] as const
    ]) {
      const userId = `multi-node-user-${index}`
      transaction
        .insert(user)
        .values({
          id: userId,
          name: `Multi-node user ${index}`,
          email: `multi-node-${index}@example.test`,
          emailVerified: true,
          createdAt: now,
          updatedAt: now,
          banned: false
        })
        .run()
      transaction
        .insert(pairings)
        .values({
          id: randomUUID(),
          userId,
          roomId: room.roomId,
          nodeId: node.id,
          joinUrl: room.joinUrl,
          revokeTokenEnc: sealPairingRevokeToken(room.revokeToken),
          status: 'active',
          createdAt: now.getTime()
        })
        .run()
    }
  })

  await reconcilePairingsNow()
  const revision = getDb()
    .select({ revision: pairingProjectionState.revision })
    .from(pairingProjectionState)
    .where(eq(pairingProjectionState.singleton, 1))
    .get()?.revision
  const [firstState, secondState] = await Promise.all([
    relayState(first.relayInternalOrigin, first.serviceToken),
    relayState(second.relayInternalOrigin, second.serviceToken)
  ])
  const placement = {
    firstOwn: await roomStatus(
      first.relayInternalOrigin,
      first.serviceToken,
      firstRoom.roomId
    ),
    firstForeign: await roomStatus(
      first.relayInternalOrigin,
      first.serviceToken,
      secondRoom.roomId
    ),
    secondOwn: await roomStatus(
      second.relayInternalOrigin,
      second.serviceToken,
      secondRoom.roomId
    ),
    secondForeign: await roomStatus(
      second.relayInternalOrigin,
      second.serviceToken,
      firstRoom.roomId
    )
  }
  if (
    placement.firstOwn !== 200 ||
    placement.firstForeign !== 404 ||
    placement.secondOwn !== 200 ||
    placement.secondForeign !== 404
  ) {
    throw new Error(`room placement failed: ${JSON.stringify(placement)}`)
  }

  const output = process.env.VALIDATION_OUTPUT
  if (output) {
    fs.writeFileSync(
      output,
      JSON.stringify(
        {
          rooms: {
            [first.id]: firstRoom.roomId,
            [second.id]: secondRoom.roomId
          }
        },
        null,
        2
      ),
      { mode: 0o600 }
    )
  }
  process.stdout.write(
    `${JSON.stringify({
      ok: true,
      revision,
      nodes: [
        { nodeId: first.id, state: firstState },
        { nodeId: second.id, state: secondState }
      ],
      placement
    })}\n`
  )
}

void main()
  .finally(closeDb)
  .catch((error: unknown) => {
    process.stderr.write(
      `${JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : 'unknown error'
      })}\n`
    )
    process.exitCode = 1
  })
