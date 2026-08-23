import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb, getDb } from '../db'
import { pairings, user } from '../db/schema'
import { createPairingActionService } from './action-service'
import {
  createUserPairing,
  getUserPairing,
  reconcilePairingsNow,
  revokeUserPairing,
  rotateUserPairing
} from './lifecycle'

const ROOM_ID = 'MDEyMzQ1Njc4OWFiY2RlZg'
const SECOND_ROOM_ID = 'ZmVkY2JhOTg3NjU0MzIxMA'
const THIRD_ROOM_ID = 'YWJjZGVmZ2hpamtsbW5vcA'
const REVOKE_TOKEN = Buffer.from(
  '0123456789abcdef0123456789abcdef',
  'utf8'
).toString('base64url')
const SECOND_REVOKE_TOKEN = Buffer.from(
  'fedcba9876543210fedcba9876543210',
  'utf8'
).toString('base64url')
const THIRD_REVOKE_TOKEN = Buffer.from(
  'abcdefghijklmnopabcdefghijklmnop',
  'utf8'
).toString('base64url')
const JOIN_URL = `https://hrack.example/remote/${ROOM_ID}`
const SECOND_JOIN_URL = `https://hrack.example/remote/${SECOND_ROOM_ID}`
const THIRD_JOIN_URL = `https://hrack.example/remote/${THIRD_ROOM_ID}`
const SERVICE_TOKEN = 'lifecycle-service-token-is-at-least-32-bytes'
const PAIRING_KEY = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='

class RelayFixture {
  readonly #server = createServer((request, response) => {
    void this.#handle(request, response)
  })
  #instanceId = 'MDEyMzQ1Njc4OWFiY2RlZg'
  #synchronized = true
  #revision = 0
  #rooms = new Map<string, string>()
  #createIndex = 0
  #heldCreateTarget = 0
  #heldCreateCount = 0
  #releaseHeldCreates: (() => void) | undefined
  #heldCreates: Promise<void> | undefined
  #nextCreateStatus: number | undefined
  #nextDeleteStatus: number | undefined
  #nextReconcileStatus: number | undefined

  async listen(): Promise<string> {
    await new Promise<void>((resolve, reject) => {
      this.#server.once('error', reject)
      this.#server.listen(0, '127.0.0.1', resolve)
    })
    const address = this.#server.address()
    if (!address || typeof address === 'string') throw new Error('missing address')
    return `http://127.0.0.1:${address.port}`
  }

  restart(): void {
    this.#instanceId = 'ZmVkY2JhOTg3NjU0MzIxMA'
    this.#synchronized = false
    this.#revision = -1
    this.#rooms.clear()
  }

  holdNextCreates(count: number): void {
    this.#heldCreateTarget = count
    this.#heldCreateCount = 0
    this.#heldCreates = new Promise<void>((resolve) => {
      this.#releaseHeldCreates = resolve
    })
  }

  failNextCreate(status: number): void {
    this.#nextCreateStatus = status
  }

  failNextDelete(status: number): void {
    this.#nextDeleteStatus = status
  }

  failNextReconcile(status: number): void {
    this.#nextReconcileStatus = status
  }

  async close(): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      this.#server.close((error) => (error ? reject(error) : resolve()))
    )
  }

  async #handle(
    request: IncomingMessage,
    response: ServerResponse
  ): Promise<void> {
    const url = new URL(request.url ?? '/', 'http://relay.test')
    const revokeRequest =
      request.method === 'DELETE' &&
      url.pathname.startsWith('/remote/v1/rooms/')
    if (
      !revokeRequest &&
      request.headers.authorization !== `Bearer ${SERVICE_TOKEN}`
    ) {
      response.writeHead(401).end()
      return
    }

    if (request.method === 'GET' && url.pathname === '/remote/v1/system/state') {
      this.#json(response, 200, {
        instanceId: this.#instanceId,
        synchronized: this.#synchronized,
        appliedRevision: this.#revision
      })
      return
    }

    if (request.method === 'PUT' && url.pathname === '/remote/v1/system/rooms') {
      if (this.#nextReconcileStatus !== undefined) {
        const status = this.#nextReconcileStatus
        this.#nextReconcileStatus = undefined
        response.writeHead(status).end()
        return
      }
      const body = JSON.parse(await this.#body(request)) as {
        revision: number
        rooms: Array<{ roomId: string; revokeDigest: string }>
      }
      this.#rooms = new Map(
        body.rooms.map((room) => [room.roomId, room.revokeDigest])
      )
      this.#revision = body.revision
      this.#synchronized = true
      this.#json(response, 200, {
        instanceId: this.#instanceId,
        appliedRevision: this.#revision,
        activeRoomCount: this.#rooms.size
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/remote/v1/rooms') {
      if (this.#nextCreateStatus !== undefined) {
        const status = this.#nextCreateStatus
        this.#nextCreateStatus = undefined
        response.writeHead(status).end()
        return
      }
      const created = [
        { roomId: ROOM_ID, joinUrl: JOIN_URL, revokeToken: REVOKE_TOKEN },
        {
          roomId: SECOND_ROOM_ID,
          joinUrl: SECOND_JOIN_URL,
          revokeToken: SECOND_REVOKE_TOKEN
        },
        {
          roomId: THIRD_ROOM_ID,
          joinUrl: THIRD_JOIN_URL,
          revokeToken: THIRD_REVOKE_TOKEN
        }
      ][this.#createIndex]
      if (!created) {
        response.writeHead(503).end()
        return
      }
      this.#createIndex += 1
      this.#rooms.set(
        created.roomId,
        createHash('sha256')
          .update(created.revokeToken)
          .digest('base64url')
      )
      if (this.#heldCreates) {
        this.#heldCreateCount += 1
        if (this.#heldCreateCount === this.#heldCreateTarget) {
          this.#releaseHeldCreates?.()
        }
        await this.#heldCreates
      }
      this.#json(response, 201, created)
      return
    }

    if (url.pathname.startsWith('/remote/v1/rooms/')) {
      const roomId = decodeURIComponent(
        url.pathname.slice('/remote/v1/rooms/'.length)
      )
      if (request.method === 'GET') {
        if (!this.#synchronized || !this.#rooms.has(roomId)) {
          response.writeHead(404).end()
          return
        }
        this.#json(response, 200, { exists: true })
        return
      }
      if (request.method === 'DELETE') {
        if (this.#nextDeleteStatus !== undefined) {
          const status = this.#nextDeleteStatus
          this.#nextDeleteStatus = undefined
          response.writeHead(status).end()
          return
        }
        const expectedToken =
          roomId === ROOM_ID
            ? REVOKE_TOKEN
            : roomId === SECOND_ROOM_ID
              ? SECOND_REVOKE_TOKEN
              : roomId === THIRD_ROOM_ID
                ? THIRD_REVOKE_TOKEN
                : undefined
        if (
          expectedToken === undefined ||
          request.headers.authorization !== `Bearer ${expectedToken}`
        ) {
          response.writeHead(404).end()
          return
        }
        this.#rooms.delete(roomId)
        response.writeHead(204).end()
        return
      }
      if (!this.#synchronized || !this.#rooms.has(roomId)) {
        response.writeHead(404).end()
        return
      }
    }

    response.writeHead(404).end()
  }

  async #body(request: IncomingMessage): Promise<string> {
    const chunks: Buffer[] = []
    for await (const chunk of request) chunks.push(Buffer.from(chunk))
    return Buffer.concat(chunks).toString('utf8')
  }

  #json(response: ServerResponse, status: number, body: unknown): void {
    response.writeHead(status, { 'content-type': 'application/json' })
    response.end(JSON.stringify(body))
  }
}

let dataDir: string
let relay: RelayFixture

beforeEach(async () => {
  closeDb()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-pairing-lifecycle-'))
  relay = new RelayFixture()
  vi.stubEnv('HRACK_WEB_DATA', dataDir)
  vi.stubEnv('PAIRING_ENC_KEY', PAIRING_KEY)
  vi.stubEnv('RELAY_SERVICE_TOKEN', SERVICE_TOKEN)
  vi.stubEnv('RELAY_INTERNAL_ORIGIN', await relay.listen())
  vi.stubEnv('BETTER_AUTH_URL', 'https://hrack.example')
  const now = new Date()
  getDb()
    .insert(user)
    .values([
      {
        id: 'account-id',
        name: 'Pairing owner',
        email: 'owner@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        banned: false
      },
      {
        id: 'other-account-id',
        name: 'Other account',
        email: 'other@example.test',
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        banned: false
      }
    ])
    .run()
})

afterEach(async () => {
  closeDb()
  vi.unstubAllEnvs()
  await relay.close()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('account pairing lifecycle', () => {
  it('restores the same persisted URL after the Web and Relay restart', async () => {
    const created = await createUserPairing('account-id')
    expect(created).toMatchObject({ kind: 'ready', joinUrl: JOIN_URL })

    closeDb()
    relay.restart()

    expect(await getUserPairing('account-id')).toMatchObject({
      kind: 'recovering',
      joinUrl: JOIN_URL
    })

    await reconcilePairingsNow()

    expect(await getUserPairing('account-id')).toMatchObject({
      kind: 'ready',
      joinUrl: JOIN_URL
    })
  })

  it('returns one winning pairing when the account double-clicks create', async () => {
    relay.holdNextCreates(2)

    const [first, second] = await Promise.all([
      createUserPairing('account-id'),
      createUserPairing('account-id')
    ])

    expect(first).toEqual(second)
    expect(first).toMatchObject({ kind: 'ready' })
    expect([JOIN_URL, SECOND_JOIN_URL]).toContain(
      first.kind === 'empty' || first.kind === 'stale' ? '' : first.joinUrl
    )
  })

  it('keeps the account empty when Relay has no room capacity', async () => {
    relay.failNextCreate(503)

    await expect(createUserPairing('account-id')).rejects.toMatchObject({
      code: 'RELAY_CAPACITY'
    })
    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'empty'
    })
  })

  it('reports Relay network failures without creating a database record', async () => {
    vi.stubEnv('RELAY_INTERNAL_ORIGIN', 'http://127.0.0.1:1')

    await expect(createUserPairing('account-id')).rejects.toMatchObject({
      code: 'RELAY_UNAVAILABLE'
    })
    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'empty'
    })
  })

  it('never restores a pairing URL after the account revokes it', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }

    await expect(
      revokeUserPairing('account-id', created.version)
    ).resolves.toEqual({ kind: 'empty' })

    closeDb()
    relay.restart()
    await reconcilePairingsNow()

    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'empty'
    })
  })

  it('keeps the persisted URL when Relay cannot confirm revocation', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    relay.failNextDelete(500)

    await expect(
      revokeUserPairing('account-id', created.version)
    ).rejects.toMatchObject({ code: 'PAIRING_REVOKE_FAILED' })
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version: created.version,
      joinUrl: created.joinUrl
    })
  })

  it('keeps the persisted URL when Relay is unreachable during revocation', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    const relayOrigin = process.env.RELAY_INTERNAL_ORIGIN
    if (!relayOrigin) throw new Error('expected Relay origin')
    vi.stubEnv('RELAY_INTERNAL_ORIGIN', 'http://127.0.0.1:1')

    await expect(
      revokeUserPairing('account-id', created.version)
    ).rejects.toMatchObject({ code: 'PAIRING_REVOKE_FAILED' })

    vi.stubEnv('RELAY_INTERNAL_ORIGIN', relayOrigin)
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version: created.version,
      joinUrl: created.joinUrl
    })
  })

  it('atomically rotates to a new URL that survives a Relay restart', async () => {
    const original = await createUserPairing('account-id')
    if (original.kind === 'empty' || original.kind === 'stale') {
      throw new Error('expected active pairing')
    }

    const rotated = await rotateUserPairing('account-id', original.version)

    expect(rotated).toMatchObject({
      kind: 'ready',
      joinUrl: SECOND_JOIN_URL
    })
    expect(rotated).not.toMatchObject({ version: original.version })
    const oldAvailability = await fetch(
      `${process.env.RELAY_INTERNAL_ORIGIN}/remote/v1/rooms/${ROOM_ID}`,
      { headers: { authorization: `Bearer ${SERVICE_TOKEN}` } }
    )
    expect(oldAvailability.status).toBe(404)

    closeDb()
    relay.restart()
    await reconcilePairingsNow()

    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version:
        rotated.kind === 'empty' || rotated.kind === 'stale'
          ? ''
          : rotated.version,
      joinUrl: SECOND_JOIN_URL
    })
  })

  it('keeps the original URL when Relay cannot create a rotation candidate', async () => {
    const original = await createUserPairing('account-id')
    if (original.kind === 'empty' || original.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    relay.failNextCreate(503)

    await expect(
      rotateUserPairing('account-id', original.version)
    ).rejects.toMatchObject({ code: 'RELAY_CAPACITY' })
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version: original.version,
      joinUrl: original.joinUrl
    })
  })

  it('returns one winning URL when the account double-clicks rotate', async () => {
    const original = await createUserPairing('account-id')
    if (original.kind === 'empty' || original.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    relay.holdNextCreates(2)

    const [first, second] = await Promise.all([
      rotateUserPairing('account-id', original.version),
      rotateUserPairing('account-id', original.version)
    ])

    expect(first).toEqual(second)
    expect(first).toMatchObject({ kind: 'ready' })
    const winnerUrl =
      first.kind === 'empty' || first.kind === 'stale' ? '' : first.joinUrl
    expect([SECOND_JOIN_URL, THIRD_JOIN_URL]).toContain(winnerUrl)

    closeDb()
    relay.restart()
    await reconcilePairingsNow()
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      joinUrl: winnerUrl,
      version:
        first.kind === 'empty' || first.kind === 'stale' ? '' : first.version
    })
  })

  it('keeps the created URL when immediate reconciliation fails', async () => {
    relay.failNextReconcile(500)

    const created = await createUserPairing('account-id')
    expect(created).toMatchObject({ joinUrl: JOIN_URL })

    closeDb()
    relay.restart()
    await reconcilePairingsNow()

    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      joinUrl: JOIN_URL,
      version:
        created.kind === 'empty' || created.kind === 'stale'
          ? ''
          : created.version
    })
  })

  it('quarantines an incompatible persisted URL without exposing it', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    getDb()
      .update(pairings)
      .set({ joinUrl: `https://old.example/remote/${ROOM_ID}` })
      .where(eq(pairings.id, created.version))
      .run()

    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'stale',
      version: created.version,
      createdAt: created.createdAt
    })

    closeDb()
    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'stale',
      version: created.version,
      createdAt: created.createdAt
    })
  })

  it('quarantines a pairing with an unsupported token format', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    getDb()
      .update(pairings)
      .set({ revokeTokenEnc: 'legacy-token-format' })
      .where(eq(pairings.id, created.version))
      .run()

    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'stale',
      version: created.version,
      createdAt: created.createdAt
    })
  })

  it('revokes a stale record locally without calling Relay', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    getDb()
      .update(pairings)
      .set({ revokeTokenEnc: 'legacy-token-format' })
      .where(eq(pairings.id, created.version))
      .run()
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'stale',
      version: created.version
    })
    relay.failNextDelete(500)

    await expect(
      revokeUserPairing('account-id', created.version)
    ).resolves.toEqual({ kind: 'empty' })
    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'empty'
    })
  })

  it('explicitly rotates a stale record to a new persistent URL', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    getDb()
      .update(pairings)
      .set({ revokeTokenEnc: 'legacy-token-format' })
      .where(eq(pairings.id, created.version))
      .run()
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'stale',
      version: created.version
    })
    relay.failNextDelete(500)

    const rotated = await rotateUserPairing('account-id', created.version)
    expect(rotated).toMatchObject({
      kind: 'ready',
      joinUrl: SECOND_JOIN_URL
    })

    closeDb()
    relay.restart()
    await reconcilePairingsNow()
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version:
        rotated.kind === 'empty' || rotated.kind === 'stale'
          ? ''
          : rotated.version,
      joinUrl: SECOND_JOIN_URL
    })
  })

  it('does not mark a pairing stale when the deployment key is wrong', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }

    vi.stubEnv('PAIRING_ENC_KEY', Buffer.alloc(32, 1).toString('base64'))
    await expect(getUserPairing('account-id')).rejects.toThrow()

    vi.stubEnv('PAIRING_ENC_KEY', PAIRING_KEY)
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version: created.version,
      joinUrl: created.joinUrl
    })
  })

  it('keeps a committed revocation when immediate reconciliation fails', async () => {
    const created = await createUserPairing('account-id')
    if (created.kind === 'empty' || created.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    relay.failNextReconcile(500)

    await expect(
      revokeUserPairing('account-id', created.version)
    ).resolves.toEqual({ kind: 'empty' })

    closeDb()
    relay.restart()
    await reconcilePairingsNow()
    await expect(getUserPairing('account-id')).resolves.toEqual({
      kind: 'empty'
    })
  })

  it('keeps a committed rotation when immediate reconciliation fails', async () => {
    const original = await createUserPairing('account-id')
    if (original.kind === 'empty' || original.kind === 'stale') {
      throw new Error('expected active pairing')
    }
    relay.failNextReconcile(500)

    const rotated = await rotateUserPairing('account-id', original.version)
    expect(rotated).toMatchObject({
      kind: 'ready',
      joinUrl: SECOND_JOIN_URL
    })

    closeDb()
    relay.restart()
    await reconcilePairingsNow()
    await expect(getUserPairing('account-id')).resolves.toMatchObject({
      kind: 'ready',
      version:
        rotated.kind === 'empty' || rotated.kind === 'stale'
          ? ''
          : rotated.version,
      joinUrl: SECOND_JOIN_URL
    })
  })

  it('binds every action to the current session account', async () => {
    let sessionUserId: string | null = 'account-id'
    const actions = createPairingActionService(async () => sessionUserId)

    const created = await actions.create()
    if (
      !created.ok ||
      created.pairing.kind === 'empty' ||
      created.pairing.kind === 'stale'
    ) {
      throw new Error('expected active pairing')
    }

    sessionUserId = 'other-account-id'
    await expect(actions.get()).resolves.toEqual({
      ok: true,
      pairing: { kind: 'empty' }
    })
    await expect(
      actions.revoke({ version: created.pairing.version })
    ).resolves.toEqual({
      ok: true,
      pairing: { kind: 'empty' }
    })

    sessionUserId = 'account-id'
    await expect(actions.get()).resolves.toMatchObject({
      ok: true,
      pairing: {
        kind: 'ready',
        version: created.pairing.version,
        joinUrl: created.pairing.joinUrl
      }
    })

    sessionUserId = null
    await expect(actions.create()).resolves.toEqual({
      ok: false,
      error: 'UNAUTHORIZED'
    })
  })

  it('rejects unsafe action input without changing the persisted URL', async () => {
    const actions = createPairingActionService(async () => 'account-id')
    const created = await actions.create()
    if (
      !created.ok ||
      created.pairing.kind === 'empty' ||
      created.pairing.kind === 'stale'
    ) {
      throw new Error('expected active pairing')
    }

    await expect(
      actions.rotate({
        version: created.pairing.version,
        userId: 'other-account-id'
      })
    ).resolves.toEqual({ ok: false, error: 'INVALID_REQUEST' })
    await expect(actions.get()).resolves.toMatchObject({
      ok: true,
      pairing: {
        kind: 'ready',
        version: created.pairing.version,
        joinUrl: created.pairing.joinUrl
      }
    })
  })

  it('returns a safe error when session resolution fails', async () => {
    const actions = createPairingActionService(async () => {
      throw new Error('database detail that must not reach the browser')
    })

    await expect(actions.create()).resolves.toEqual({
      ok: false,
      error: 'INTERNAL_ERROR'
    })
  })
})
