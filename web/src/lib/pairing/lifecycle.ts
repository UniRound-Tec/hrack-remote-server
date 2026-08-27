import { randomUUID } from 'node:crypto'
import { and, desc, eq, or } from 'drizzle-orm'
import { getDb } from '../db'
import { pairingProjectionState, pairings } from '../db/schema'
import {
  loadPairingReconcilerConfig,
  reconcilePairingsOnce
} from './reconciler'
import { loadRelayNodes, type RelayNode } from './nodes'
import { readPairingProjection } from './projection'
import {
  openPairingRevokeToken,
  PairingTokenFormatError,
  sealPairingRevokeToken
} from './token'

export type PairingView =
  | { kind: 'empty' }
  | {
      kind: 'ready' | 'recovering'
      version: string
      joinUrl: string
      createdAt: number
      nodeId: string
      region: string
      nodeLabel: string
    }
  | {
      kind: 'stale'
      version: string
      createdAt: number
    }

interface RelayState {
  instanceId: string
  synchronized: boolean
  appliedRevision: number
}

interface RelayCreatedRoom {
  roomId: string
  joinUrl: string
  revokeToken: string
}

interface LifecycleConfig {
  nodes: RelayNode[]
  publicOrigin: string
}

interface RelayLifecycleConfig {
  relayOrigin: string
  serviceToken: string
  publicOrigin: string
}

export type PairingLifecycleErrorCode =
  | 'RELAY_CAPACITY'
  | 'RELAY_UNAVAILABLE'
  | 'PAIRING_CREATE_FAILED'
  | 'PAIRING_REVOKE_FAILED'
  | 'PAIRING_CHANGED'
  | 'PAIRING_STALE'
  | 'PAIRING_NODE_UNAVAILABLE'

export class PairingLifecycleError extends Error {
  override readonly name = 'PairingLifecycleError'

  constructor(readonly code: PairingLifecycleErrorCode) {
    super(code)
  }
}

function lifecycleConfig(): LifecycleConfig {
  const authUrl = process.env.BETTER_AUTH_URL
  if (!authUrl) throw new Error('BETTER_AUTH_URL is required')
  const publicUrl = new URL(authUrl)
  if (
    !['http:', 'https:'].includes(publicUrl.protocol) ||
    publicUrl.pathname !== '/' ||
    publicUrl.search ||
    publicUrl.hash ||
    publicUrl.username ||
    publicUrl.password
  ) {
    throw new Error('BETTER_AUTH_URL must contain only scheme and authority')
  }
  return {
    nodes: loadRelayNodes(),
    publicOrigin: publicUrl.origin
  }
}

function relayLifecycleConfig(
  config: LifecycleConfig,
  nodeId: string
): RelayLifecycleConfig {
  const node = config.nodes.find(
    (candidate) => candidate.id === nodeId && candidate.enabled
  )
  if (!node) throw new PairingLifecycleError('PAIRING_NODE_UNAVAILABLE')
  return {
    relayOrigin: node.relayInternalOrigin,
    serviceToken: node.serviceToken,
    publicOrigin: config.publicOrigin
  }
}

function isBase64UrlBytes(value: string, bytes: number): boolean {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return false
  const decoded = Buffer.from(value, 'base64url')
  return decoded.byteLength === bytes && decoded.toString('base64url') === value
}

function isRelayState(value: unknown): value is RelayState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  return (
    'instanceId' in value &&
    typeof value.instanceId === 'string' &&
    'synchronized' in value &&
    typeof value.synchronized === 'boolean' &&
    'appliedRevision' in value &&
    Number.isSafeInteger(value.appliedRevision)
  )
}

function isCreatedRoom(
  value: unknown,
  publicOrigin: string
): value is RelayCreatedRoom {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false
  }
  if (
    !('roomId' in value) ||
    typeof value.roomId !== 'string' ||
    !isBase64UrlBytes(value.roomId, 16) ||
    !('revokeToken' in value) ||
    typeof value.revokeToken !== 'string' ||
    !isBase64UrlBytes(value.revokeToken, 32) ||
    !('joinUrl' in value) ||
    typeof value.joinUrl !== 'string'
  ) {
    return false
  }
  return value.joinUrl === `${publicOrigin}/remote/${value.roomId}`
}

async function relayJson(
  url: string,
  init: RequestInit
): Promise<{ status: number; value: unknown }> {
  const response = await fetch(url, {
    ...init,
    signal: AbortSignal.timeout(5_000)
  })
  return {
    status: response.status,
    value: await response.json().catch(() => null)
  }
}

async function createRelayRoom(
  config: RelayLifecycleConfig
): Promise<RelayCreatedRoom> {
  let result: Awaited<ReturnType<typeof relayJson>>
  try {
    result = await relayJson(`${config.relayOrigin}/remote/v1/rooms`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${config.serviceToken}`,
        'content-type': 'application/json',
        origin: config.publicOrigin
      },
      body: '{}'
    })
  } catch {
    throw new PairingLifecycleError('RELAY_UNAVAILABLE')
  }
  if (result.status === 503) {
    throw new PairingLifecycleError('RELAY_CAPACITY')
  }
  if (result.status !== 201 || !isCreatedRoom(result.value, config.publicOrigin)) {
    throw new PairingLifecycleError('PAIRING_CREATE_FAILED')
  }
  return result.value
}

async function revokeRelayRoom(
  config: RelayLifecycleConfig,
  room: Pick<RelayCreatedRoom, 'roomId' | 'revokeToken'>
): Promise<void> {
  let response: Response
  try {
    response = await fetch(
      `${config.relayOrigin}/remote/v1/rooms/${encodeURIComponent(room.roomId)}`,
      {
        method: 'DELETE',
        headers: { authorization: `Bearer ${room.revokeToken}` },
        signal: AbortSignal.timeout(5_000)
      }
    )
  } catch {
    throw new PairingLifecycleError('PAIRING_REVOKE_FAILED')
  }
  if (response.status !== 204 && response.status !== 404) {
    throw new PairingLifecycleError('PAIRING_REVOKE_FAILED')
  }
}

function isUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'SQLITE_CONSTRAINT_UNIQUE'
  )
}

async function roomIsReady(
  config: RelayLifecycleConfig,
  roomId: string,
  requiredRevision: number
): Promise<boolean> {
  try {
    const headers = {
      authorization: `Bearer ${config.serviceToken}`
    }
    const state = await relayJson(
      `${config.relayOrigin}/remote/v1/system/state`,
      { headers }
    )
    if (state.status !== 200 || !isRelayState(state.value)) return false
    if (!state.value.synchronized) return false
    if (state.value.appliedRevision !== requiredRevision) return false
    const room = await fetch(
      `${config.relayOrigin}/remote/v1/rooms/${encodeURIComponent(roomId)}`,
      { headers, signal: AbortSignal.timeout(5_000) }
    )
    return room.status === 200
  } catch {
    return false
  }
}

export async function getUserPairing(userId: string): Promise<PairingView> {
  const database = getDb()
  const row = database
    .select({
      id: pairings.id,
      roomId: pairings.roomId,
      joinUrl: pairings.joinUrl,
      revokeTokenEnc: pairings.revokeTokenEnc,
      createdAt: pairings.createdAt,
      nodeId: pairings.nodeId
    })
    .from(pairings)
    .where(and(eq(pairings.userId, userId), eq(pairings.status, 'active')))
    .orderBy(desc(pairings.createdAt))
    .get()
  if (!row) {
    const stale = database
      .select({ id: pairings.id, createdAt: pairings.createdAt })
      .from(pairings)
      .where(and(eq(pairings.userId, userId), eq(pairings.status, 'stale')))
      .orderBy(desc(pairings.createdAt))
      .get()
    return stale
      ? { kind: 'stale', version: stale.id, createdAt: stale.createdAt }
      : { kind: 'empty' }
  }

  const config = lifecycleConfig()
  const node = config.nodes.find(
    (candidate) => candidate.id === row.nodeId && candidate.enabled
  )
  let staleRecord =
    !isBase64UrlBytes(row.roomId, 16) ||
    row.joinUrl !== `${config.publicOrigin}/remote/${row.roomId}`
  if (!staleRecord) {
    try {
      staleRecord = !isBase64UrlBytes(
        openPairingRevokeToken(row.revokeTokenEnc),
        32
      )
    } catch (error) {
      if (!(error instanceof PairingTokenFormatError)) throw error
      staleRecord = true
    }
  }
  if (staleRecord) {
    database
      .update(pairings)
      .set({ status: 'stale' })
      .where(and(eq(pairings.id, row.id), eq(pairings.status, 'active')))
      .run()
    return { kind: 'stale', version: row.id, createdAt: row.createdAt }
  }

  const projection = database
    .select({ revision: pairingProjectionState.revision })
    .from(pairingProjectionState)
    .where(eq(pairingProjectionState.singleton, 1))
    .get()
  if (!projection) throw new Error('pairing projection state is missing')

  return {
    kind: node && (await roomIsReady(
      relayLifecycleConfig(config, node.id),
      row.roomId,
      projection.revision
    ))
      ? 'ready'
      : 'recovering',
    version: row.id,
    joinUrl: row.joinUrl,
    createdAt: row.createdAt,
    nodeId: row.nodeId,
    region: node?.region ?? 'unknown',
    nodeLabel: node?.label ?? row.nodeId
  }
}

export async function reconcilePairingsNow(): Promise<void> {
  const config = loadPairingReconcilerConfig()
  await Promise.all(
    config.nodes.map((node) =>
      reconcilePairingsOnce({
        relayOrigin: node.relayInternalOrigin,
        serviceToken: node.serviceToken,
        readProjection: () => readPairingProjection(node.id)
      })
    )
  )
}

export async function createUserPairing(
  userId: string,
  nodeId = 'us-1'
): Promise<PairingView> {
  const existing = await getUserPairing(userId)
  if (existing.kind !== 'empty') return existing

  const config = lifecycleConfig()
  const relayConfig = relayLifecycleConfig(config, nodeId)
  const room = await createRelayRoom(relayConfig)
  try {
    getDb()
      .insert(pairings)
      .values({
        id: randomUUID(),
        userId,
        roomId: room.roomId,
        nodeId,
        joinUrl: room.joinUrl,
        revokeTokenEnc: sealPairingRevokeToken(room.revokeToken),
        status: 'active',
        createdAt: Date.now()
      })
      .run()
  } catch (error) {
    await revokeRelayRoom(relayConfig, room).catch(() => undefined)
    if (isUniqueConstraint(error)) {
      await reconcilePairingsNow().catch(() => undefined)
      return getUserPairing(userId)
    }
    throw error
  }
  await reconcilePairingsNow().catch(() => undefined)
  return getUserPairing(userId)
}

export async function revokeUserPairing(
  userId: string,
  expectedVersion: string
): Promise<PairingView> {
  const row = getDb()
    .select({
      id: pairings.id,
      roomId: pairings.roomId,
      revokeTokenEnc: pairings.revokeTokenEnc,
      status: pairings.status,
      nodeId: pairings.nodeId
    })
    .from(pairings)
    .where(
      and(
        eq(pairings.userId, userId),
        eq(pairings.id, expectedVersion),
        or(eq(pairings.status, 'active'), eq(pairings.status, 'stale'))
      )
    )
    .get()
  if (!row) return getUserPairing(userId)

  if (row.status === 'stale') {
    getDb()
      .update(pairings)
      .set({ status: 'revoked', revokedAt: Date.now() })
      .where(
        and(
          eq(pairings.id, row.id),
          eq(pairings.userId, userId),
          eq(pairings.status, 'stale')
        )
      )
      .run()
    await reconcilePairingsNow().catch(() => undefined)
    return getUserPairing(userId)
  }

  const config = lifecycleConfig()
  const relayConfig = relayLifecycleConfig(config, row.nodeId)
  await revokeRelayRoom(relayConfig, {
    roomId: row.roomId,
    revokeToken: openPairingRevokeToken(row.revokeTokenEnc)
  })

  getDb()
    .update(pairings)
    .set({ status: 'revoked', revokedAt: Date.now() })
    .where(
      and(
        eq(pairings.id, row.id),
        eq(pairings.userId, userId),
        eq(pairings.status, 'active')
      )
    )
    .run()
  await reconcilePairingsNow().catch(() => undefined)
  return getUserPairing(userId)
}

export async function rotateUserPairing(
  userId: string,
  expectedVersion: string
): Promise<PairingView> {
  const current = getDb()
    .select({
      id: pairings.id,
      roomId: pairings.roomId,
      revokeTokenEnc: pairings.revokeTokenEnc,
      status: pairings.status,
      nodeId: pairings.nodeId
    })
    .from(pairings)
    .where(
      and(
        eq(pairings.userId, userId),
        eq(pairings.id, expectedVersion),
        or(eq(pairings.status, 'active'), eq(pairings.status, 'stale'))
      )
    )
    .get()
  if (!current) return getUserPairing(userId)

  const config = lifecycleConfig()
  const relayConfig = relayLifecycleConfig(config, current.nodeId)
  const oldRevokeToken =
    current.status === 'active'
      ? openPairingRevokeToken(current.revokeTokenEnc)
      : undefined
  const candidate = await createRelayRoom(relayConfig)
  const candidateId = randomUUID()
  const now = Date.now()

  try {
    getDb().transaction((tx) => {
      const updated = tx
        .update(pairings)
        .set({ status: 'revoked', revokedAt: now })
        .where(
          and(
            eq(pairings.id, current.id),
            eq(pairings.userId, userId),
            eq(pairings.status, current.status)
          )
        )
        .run()
      if (updated.changes !== 1) {
        throw new PairingLifecycleError('PAIRING_CHANGED')
      }
      tx.insert(pairings)
        .values({
          id: candidateId,
          userId,
          roomId: candidate.roomId,
          nodeId: current.nodeId,
          joinUrl: candidate.joinUrl,
          revokeTokenEnc: sealPairingRevokeToken(candidate.revokeToken),
          status: 'active',
          createdAt: now
        })
        .run()
    })
  } catch (error) {
    await revokeRelayRoom(relayConfig, candidate).catch(() => undefined)
    if (
      isUniqueConstraint(error) ||
      (error instanceof PairingLifecycleError &&
        error.code === 'PAIRING_CHANGED')
    ) {
      await reconcilePairingsNow().catch(() => undefined)
      return getUserPairing(userId)
    }
    throw error
  }

  if (oldRevokeToken) {
    await revokeRelayRoom(relayConfig, {
      roomId: current.roomId,
      revokeToken: oldRevokeToken
    }).catch(() => undefined)
  }
  await reconcilePairingsNow().catch(() => undefined)
  return getUserPairing(userId)
}
