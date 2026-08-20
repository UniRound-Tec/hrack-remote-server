import { createHash, timingSafeEqual } from 'node:crypto'

import {
  isRemoteDesktopToPhoneMessage,
  isRemotePhoneToDesktopMessage,
  parseRemoteFrame,
  type RemoteMessage,
  type RemoteRole
} from '../protocol/remote-protocol.js'
import type { RelayConfig } from './relay-config.js'
import type { RateLimitConfig } from './relay-config.js'

export interface RelayDependencies {
  now(): number
  randomBytes(size: number): Uint8Array
}

export type CreateRoomResult =
  | {
      ok: true
      roomId: string
      joinUrl: string
      revokeToken: string
    }
  | { ok: false; reason: 'rate-limited' | 'capacity' }

interface OpenRoom {
  status: 'open'
  revokeDigest: Buffer
  desktop: string | null
  phone: string | null
}

interface RevokedRoom {
  status: 'revoked'
  revokeDigest: Buffer
}

type Room = OpenRoom | RevokedRoom

interface TokenBucket {
  tokens: number
  updatedAt: number
}

interface Connection {
  id: string
  ipKey: string
  openedAt: number
  role: RemoteRole | null
  roomId: string | null
  lastPingAt: number
  awaitingPongSince: number | null
  violations: number[]
  closing: boolean
}

export type RelayEffect =
  | { kind: 'send'; connectionId: string; message: RemoteMessage }
  | { kind: 'ping'; connectionId: string }
  | { kind: 'close'; connectionId: string; code: number; reason: string }
  | {
      kind: 'close-after-send'
      connectionId: string
      message: RemoteMessage
      code: number
      reason: string
      deadlineMs: number
    }

export type RelaySocketEvent =
  | { type: 'open'; connectionId: string; ipKey: string }
  | {
      type: 'text'
      connectionId: string
      text: string
      bufferedAmount(connectionId: string): number
    }
  | { type: 'pong'; connectionId: string }
  | { type: 'close'; connectionId: string }
  | { type: 'tick' }

export class RelayCore {
  readonly #rooms = new Map<string, Room>()
  readonly #connections = new Map<string, Connection>()
  readonly #createBuckets = new Map<string, TokenBucket>()
  readonly #helloBuckets = new Map<string, TokenBucket>()

  constructor(
    readonly config: RelayConfig,
    readonly dependencies: RelayDependencies
  ) {}

  createRoom(input: { ipKey: string }): CreateRoomResult {
    if (this.#rooms.size >= this.config.maxRooms) {
      return { ok: false, reason: 'capacity' }
    }
    if (!this.#takeToken(this.#createBuckets, input.ipKey, this.config.createRate)) {
      return { ok: false, reason: 'rate-limited' }
    }

    let roomId: string
    do {
      roomId = Buffer.from(this.dependencies.randomBytes(16)).toString('base64url')
    } while (this.#rooms.has(roomId))

    const revokeToken = Buffer.from(this.dependencies.randomBytes(32)).toString(
      'base64url'
    )
    this.#rooms.set(roomId, {
      status: 'open',
      revokeDigest: createHash('sha256').update(revokeToken).digest(),
      desktop: null,
      phone: null
    })
    return {
      ok: true,
      roomId,
      joinUrl: `${this.config.publicOrigin}${this.config.basePath}/${roomId}`,
      revokeToken
    }
  }

  roomAvailability(roomId: string): 'open' | 'unavailable' {
    return this.#rooms.get(roomId)?.status === 'open' ? 'open' : 'unavailable'
  }

  revokeRoom(input: {
    roomId: string
    token: string
  }): { status: 'revoked' | 'not-found'; effects: RelayEffect[] } {
    const room = this.#rooms.get(input.roomId)
    if (!room || !this.#tokenMatches(room.revokeDigest, input.token)) {
      return { status: 'not-found', effects: [] }
    }
    if (room.status === 'revoked') {
      return { status: 'revoked', effects: [] }
    }
    return {
      status: 'revoked',
      effects: this.#revokeOpenRoom(input.roomId, room)
    }
  }

  handleSocket(event: RelaySocketEvent): RelayEffect[] {
    switch (event.type) {
      case 'open':
        return this.#openConnection(event.connectionId, event.ipKey)
      case 'text':
        return this.#handleText(event)
      case 'pong': {
        const connection = this.#connections.get(event.connectionId)
        if (connection) connection.awaitingPongSince = null
        return []
      }
      case 'close':
        return this.#disconnect(event.connectionId)
      case 'tick':
        return this.#tick()
    }
  }

  #openConnection(connectionId: string, ipKey: string): RelayEffect[] {
    if (this.#connections.has(connectionId)) return []
    if (this.#connections.size >= this.config.maxConnections) {
      return [
        {
          kind: 'close',
          connectionId,
          code: 1013,
          reason: 'capacity'
        }
      ]
    }
    const now = this.dependencies.now()
    this.#connections.set(connectionId, {
      id: connectionId,
      ipKey,
      openedAt: now,
      role: null,
      roomId: null,
      lastPingAt: now,
      awaitingPongSince: null,
      violations: [],
      closing: false
    })
    return []
  }

  #handleText(
    event: Extract<RelaySocketEvent, { type: 'text' }>
  ): RelayEffect[] {
    const connection = this.#connections.get(event.connectionId)
    if (!connection || connection.closing) return []
    const parsed = parseRemoteFrame(event.text)
    if (!parsed.ok) return this.#violate(connection)
    const message = parsed.value

    if (message.type === 'hello') {
      return this.#hello(connection, message.roomId, message.role)
    }
    if (connection.roomId === null || connection.role === null) {
      return this.#violate(connection)
    }

    const room = this.#rooms.get(connection.roomId)
    if (!room || room.status !== 'open') {
      connection.closing = true
      return [
        {
          kind: 'close-after-send',
          connectionId: connection.id,
          message: { v: 1, type: 'bad-key' },
          code: 1008,
          reason: 'bad-key',
          deadlineMs: this.config.revokeDrainMs
        }
      ]
    }

    if (message.type === 'revoke') {
      if (connection.role !== 'desktop' || message.roomId !== connection.roomId) {
        return this.#violate(connection)
      }
      return this.#revokeOpenRoom(connection.roomId, room)
    }

    const allowed =
      connection.role === 'desktop'
        ? isRemoteDesktopToPhoneMessage(message)
        : isRemotePhoneToDesktopMessage(message)
    if (!allowed) return this.#violate(connection)

    const peerRole = connection.role === 'desktop' ? 'phone' : 'desktop'
    const peerId = room[peerRole]
    if (peerId === null) return []
    const buffered =
      event.bufferedAmount(connection.id) + event.bufferedAmount(peerId)
    if (buffered > this.config.maxRoomBufferedBytes) {
      return this.#closeRoomForBackpressure(connection.roomId, room)
    }
    return [{ kind: 'send', connectionId: peerId, message }]
  }

  #hello(
    connection: Connection,
    roomId: string,
    role: RemoteRole
  ): RelayEffect[] {
    if (connection.roomId !== null || connection.role !== null) {
      if (connection.roomId === roomId && connection.role === role) {
        const room = this.#rooms.get(roomId)
        if (room?.status === 'open') {
          return [this.#helloOk(connection.id, room)]
        }
      }
      return [{ kind: 'send', connectionId: connection.id, message: { v: 1, type: 'occupied' } }]
    }

    if (!this.#takeToken(this.#helloBuckets, connection.ipKey, this.config.helloRate)) {
      connection.closing = true
      return [
        {
          kind: 'close',
          connectionId: connection.id,
          code: 1008,
          reason: 'hello-rate-limit'
        }
      ]
    }

    const room = this.#rooms.get(roomId)
    if (!room || room.status !== 'open') {
      connection.closing = true
      return [
        {
          kind: 'close-after-send',
          connectionId: connection.id,
          message: { v: 1, type: 'bad-key' },
          code: 1008,
          reason: 'bad-key',
          deadlineMs: this.config.revokeDrainMs
        }
      ]
    }
    if (room[role] !== null && room[role] !== connection.id) {
      return [
        {
          kind: 'send',
          connectionId: connection.id,
          message: { v: 1, type: 'occupied' }
        }
      ]
    }

    room[role] = connection.id
    connection.roomId = roomId
    connection.role = role
    const effects: RelayEffect[] = [this.#helloOk(connection.id, room)]
    const peerRole = role === 'desktop' ? 'phone' : 'desktop'
    const peerId = room[peerRole]
    if (peerId !== null) {
      effects.push({
        kind: 'send',
        connectionId: peerId,
        message: { v: 1, type: 'peer-join', role }
      })
    }
    return effects
  }

  #helloOk(connectionId: string, room: OpenRoom): RelayEffect {
    return {
      kind: 'send',
      connectionId,
      message: {
        v: 1,
        type: 'hello-ok',
        peer: { desktop: room.desktop !== null, phone: room.phone !== null }
      }
    }
  }

  #violate(connection: Connection): RelayEffect[] {
    const now = this.dependencies.now()
    connection.violations = connection.violations.filter(
      (at) => now - at <= this.config.violationWindowMs
    )
    connection.violations.push(now)
    if (connection.violations.length < this.config.violationLimit) return []
    connection.closing = true
    return [
      {
        kind: 'close',
        connectionId: connection.id,
        code: 1008,
        reason: 'policy-violation'
      }
    ]
  }

  #closeRoomForBackpressure(roomId: string, room: OpenRoom): RelayEffect[] {
    const effects: RelayEffect[] = []
    for (const connectionId of [room.desktop, room.phone]) {
      if (connectionId === null) continue
      const connection = this.#connections.get(connectionId)
      if (connection) connection.closing = true
      effects.push({
        kind: 'close',
        connectionId,
        code: 1013,
        reason: 'backpressure'
      })
    }
    this.#rooms.set(roomId, {
      status: 'revoked',
      revokeDigest: room.revokeDigest
    })
    return effects
  }

  #disconnect(connectionId: string): RelayEffect[] {
    const connection = this.#connections.get(connectionId)
    if (!connection) return []
    this.#connections.delete(connectionId)
    if (connection.roomId === null || connection.role === null) return []
    const room = this.#rooms.get(connection.roomId)
    if (!room || room.status !== 'open') return []
    if (room[connection.role] === connectionId) room[connection.role] = null
    const peerRole = connection.role === 'desktop' ? 'phone' : 'desktop'
    const peerId = room[peerRole]
    if (peerId === null) return []
    return [
      {
        kind: 'send',
        connectionId: peerId,
        message: { v: 1, type: 'peer-leave', role: connection.role }
      }
    ]
  }

  #tick(): RelayEffect[] {
    const now = this.dependencies.now()
    const effects: RelayEffect[] = []
    for (const connection of this.#connections.values()) {
      if (connection.closing) continue
      if (
        connection.roomId === null &&
        now - connection.openedAt >= this.config.helloDeadlineMs
      ) {
        connection.closing = true
        effects.push({
          kind: 'close',
          connectionId: connection.id,
          code: 1008,
          reason: 'hello-timeout'
        })
        continue
      }
      if (
        connection.awaitingPongSince !== null &&
        now - connection.awaitingPongSince >= this.config.pongTimeoutMs
      ) {
        connection.closing = true
        effects.push({
          kind: 'close',
          connectionId: connection.id,
          code: 1001,
          reason: 'pong-timeout'
        })
        continue
      }
      if (
        connection.awaitingPongSince === null &&
        now - connection.lastPingAt >= this.config.pingIntervalMs
      ) {
        connection.lastPingAt = now
        connection.awaitingPongSince = now
        effects.push({ kind: 'ping', connectionId: connection.id })
      }
    }
    return effects
  }

  #revokeOpenRoom(roomId: string, room: OpenRoom): RelayEffect[] {
    this.#rooms.set(roomId, {
      status: 'revoked',
      revokeDigest: room.revokeDigest
    })
    const effects: RelayEffect[] = []
    for (const connectionId of [room.desktop, room.phone]) {
      if (connectionId === null) continue
      const connection = this.#connections.get(connectionId)
      if (connection) connection.closing = true
      effects.push({
        kind: 'close-after-send',
        connectionId,
        message: { v: 1, type: 'revoked' },
        code: 1000,
        reason: 'revoked',
        deadlineMs: this.config.revokeDrainMs
      })
    }
    return effects
  }

  #tokenMatches(expected: Buffer, token: string): boolean {
    const actual = createHash('sha256').update(token).digest()
    return actual.byteLength === expected.byteLength && timingSafeEqual(actual, expected)
  }

  #takeToken(
    buckets: Map<string, TokenBucket>,
    key: string,
    limit: RateLimitConfig
  ): boolean {
    const now = this.dependencies.now()
    const bucket = buckets.get(key) ?? { tokens: limit.burst, updatedAt: now }
    const elapsed = Math.max(0, now - bucket.updatedAt)
    bucket.tokens = Math.min(
      limit.burst,
      bucket.tokens + (elapsed * limit.perMinute) / 60_000
    )
    bucket.updatedAt = now
    if (bucket.tokens < 1) {
      buckets.set(key, bucket)
      return false
    }
    bucket.tokens -= 1
    buckets.set(key, bucket)
    return true
  }
}
