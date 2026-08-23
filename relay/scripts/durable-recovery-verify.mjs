import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'

import WebSocket from 'ws'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) throw new Error(`${name} is required`)
  return value
}

function containerName(name) {
  const value = required(name)
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error(`${name} is not a safe Docker container name`)
  }
  return value
}

function optionalContainerName(name) {
  const value = process.env[name]?.trim()
  if (!value) return null
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(value)) {
    throw new Error(`${name} is not a safe Docker container name`)
  }
  return value
}

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

const targetOrigin = new URL(required('TARGET_ORIGIN')).origin
const relayOrigin = new URL(required('RELAY_INTERNAL_ORIGIN')).origin
const serviceToken = required('RELAY_SERVICE_TOKEN')
assert(Buffer.byteLength(serviceToken) >= 32, 'RELAY_SERVICE_TOKEN is too short')
const relayContainer = containerName('RELAY_CONTAINER')
const webContainer = containerName('WEB_CONTAINER')
const reconcilerContainer = containerName('RECONCILER_CONTAINER')
const edgeContainer = optionalContainerName('EDGE_CONTAINER')
const recoveryTimeoutMs = Number(process.env.RECOVERY_TIMEOUT_MS ?? '15000')
assert(
  Number.isSafeInteger(recoveryTimeoutMs) && recoveryTimeoutMs >= 1_000,
  'RECOVERY_TIMEOUT_MS must be an integer of at least 1000'
)

const authorization = { authorization: `Bearer ${serviceToken}` }
const wsUrl = `${targetOrigin.replace(/^http/, 'ws')}/remote/v1/ws`

async function docker(args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > 1_000_000) child.kill()
    })
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > 1_000_000) child.kill()
    })
    child.once('error', reject)
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(stdout.trim())
      else reject(new Error(`docker ${args[0]} failed with exit ${code}`))
    })
    child.stdin.end(input)
  })
}

async function ensureContainersExist() {
  for (const name of [
    relayContainer,
    webContainer,
    reconcilerContainer,
    edgeContainer
  ].filter(Boolean)) {
    const resolved = await docker([
      'ps',
      '--filter',
      `name=^/${name}$`,
      '--format',
      '{{.Names}}'
    ])
    assert(resolved === name, `required running container is missing: ${name}`)
  }
}

async function dockerLogs(name) {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', ['logs', name], {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    })
    let output = ''
    const timer = setTimeout(() => child.kill(), 30_000)
    const append = (chunk) => {
      output += chunk.toString()
      if (output.length > 2_000_000) child.kill()
    }
    child.stdout.on('data', append)
    child.stderr.on('data', append)
    child.once('error', reject)
    child.once('close', (code) => {
      clearTimeout(timer)
      if (code === 0) resolve(output)
      else reject(new Error('docker logs failed'))
    })
  })
}

async function dbAction(action, payload = {}) {
  const input = { action, ...payload }
  const program = `
const { eq } = require('drizzle-orm')
const { getDb, closeDb } = require('/app/dist-reconciler/src/lib/db/index.js')
const {
  pairingProjectionState,
  pairings,
  user
} = require('/app/dist-reconciler/src/lib/db/schema.js')
const {
  sealPairingRevokeToken
} = require('/app/dist-reconciler/src/lib/pairing/token.js')
const input = ${JSON.stringify(input)}
const db = getDb()
function revision() {
  return db.select({ revision: pairingProjectionState.revision })
    .from(pairingProjectionState)
    .where(eq(pairingProjectionState.singleton, 1))
    .get().revision
}
let result
try {
  if (input.action === 'seed') {
    const now = new Date()
    db.transaction((tx) => {
      tx.insert(user).values({
        id: input.userId,
        name: 'P2 recovery gate',
        email: input.email,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        banned: false
      }).run()
      tx.insert(pairings).values({
        id: input.pairingId,
        userId: input.userId,
        roomId: input.roomId,
        joinUrl: input.joinUrl,
        revokeTokenEnc: sealPairingRevokeToken(input.revokeToken),
        status: 'active',
        createdAt: now.getTime()
      }).run()
    })
    result = { revision: revision() }
  } else if (input.action === 'ban' || input.action === 'unban') {
    const update = db.update(user)
      .set({ banned: input.action === 'ban', updatedAt: new Date() })
      .where(eq(user.id, input.userId))
      .run()
    if (update.changes !== 1) throw new Error('gate user is missing')
    result = { revision: revision() }
  } else if (input.action === 'delete') {
    db.delete(user).where(eq(user.id, input.userId)).run()
    result = { revision: revision() }
  } else if (input.action === 'query') {
    const row = db.select({
      joinUrl: pairings.joinUrl,
      revokeTokenEnc: pairings.revokeTokenEnc,
      roomId: pairings.roomId,
      status: pairings.status
    })
      .from(pairings)
      .where(eq(pairings.userId, input.userId))
      .get()
    result = { row: row ?? null, revision: revision() }
  } else {
    throw new Error('unsupported gate database action')
  }
} finally {
  closeDb()
}
process.stdout.write(JSON.stringify(result))
`
  const stdout = await docker(
    ['exec', '--interactive', reconcilerContainer, 'node', '-'],
    program
  )
  return JSON.parse(stdout)
}

async function waitFor(label, probe, timeoutMs = recoveryTimeoutMs) {
  const deadline = Date.now() + timeoutMs
  let lastError
  while (Date.now() < deadline) {
    try {
      const result = await probe()
      if (result) return result
    } catch (error) {
      lastError = error
    }
    await delay(100)
  }
  throw new Error(`${label} did not converge before timeout`, {
    cause: lastError
  })
}

async function relayState() {
  const response = await fetch(`${relayOrigin}/remote/v1/system/state`, {
    headers: authorization,
    signal: AbortSignal.timeout(2_000)
  })
  assert(response.ok, `Relay state returned ${response.status}`)
  return response.json()
}

async function waitForAppliedRevision(revision) {
  return waitFor(`Relay revision ${revision}`, async () => {
    const state = await relayState()
    return state.synchronized && state.appliedRevision >= revision ? state : null
  })
}

async function roomStatus(roomId) {
  const response = await fetch(
    `${relayOrigin}/remote/v1/rooms/${encodeURIComponent(roomId)}`,
    { headers: authorization, signal: AbortSignal.timeout(2_000) }
  )
  assert(
    response.status === 200 || response.status === 404,
    `room availability returned ${response.status}`
  )
  return response.status
}

async function waitForRoom(roomId, available) {
  const expected = available ? 200 : 404
  return waitFor(
    available ? 'room restoration' : 'room removal',
    async () => ((await roomStatus(roomId)) === expected ? true : null)
  )
}

async function waitForPublicHealth() {
  return waitFor('public Relay health', async () => {
    const response = await fetch(`${targetOrigin}/remote/healthz`, {
      signal: AbortSignal.timeout(2_000)
    })
    return response.ok ? Date.now() : null
  })
}

class Client {
  queue = []
  waiters = []

  constructor(socket) {
    this.socket = socket
    socket.on('message', (data) => {
      const message = JSON.parse(data.toString())
      const waiter = this.waiters.shift()
      if (waiter) waiter.resolve(message)
      else this.queue.push(message)
    })
    socket.on('close', () => {
      for (const waiter of this.waiters.splice(0)) {
        waiter.reject(new Error('WebSocket closed before expected message'))
      }
    })
  }

  static async connect() {
    const socket = new WebSocket(wsUrl)
    await new Promise((resolve, reject) => {
      socket.once('open', resolve)
      socket.once('error', reject)
    })
    return new Client(socket)
  }

  send(message) {
    this.socket.send(JSON.stringify(message))
  }

  next(label) {
    const queued = this.queue.shift()
    if (queued !== undefined) return Promise.resolve(queued)
    return new Promise((resolve, reject) => {
      const waiter = { resolve, reject }
      this.waiters.push(waiter)
      const timer = setTimeout(() => {
        const index = this.waiters.indexOf(waiter)
        if (index >= 0) this.waiters.splice(index, 1)
        reject(new Error(`WebSocket timeout: ${label}`))
      }, 5_000)
      waiter.resolve = (message) => {
        clearTimeout(timer)
        resolve(message)
      }
      waiter.reject = (error) => {
        clearTimeout(timer)
        reject(error)
      }
    })
  }

  close() {
    if (this.socket.readyState === WebSocket.OPEN) this.socket.close()
  }
}

async function verifyBidirectionalRelay(roomId) {
  const desktop = await Client.connect()
  const phone = await Client.connect()
  try {
    desktop.send({ v: 1, type: 'hello', role: 'desktop', roomId })
    assert((await desktop.next('desktop hello')).type === 'hello-ok', 'desktop join failed')
    phone.send({ v: 1, type: 'hello', role: 'phone', roomId })
    assert((await phone.next('phone hello')).type === 'hello-ok', 'phone join failed')
    assert((await desktop.next('peer join')).type === 'peer-join', 'peer join missing')

    const phoneMarker = `phone-${Date.now()}`
    phone.send({ v: 1, type: 'pty-in', sessionId: 'p2-gate', data: phoneMarker })
    const atDesktop = await desktop.next('phone to desktop')
    assert(
      atDesktop.type === 'pty-in' && atDesktop.data === phoneMarker,
      'phone-to-desktop relay failed'
    )

    const desktopMarker = `desktop-${Date.now()}`
    desktop.send({
      v: 1,
      type: 'pty-out',
      sessionId: 'p2-gate',
      data: Buffer.from(desktopMarker).toString('base64'),
      byteLength: Buffer.byteLength(desktopMarker)
    })
    const atPhone = await phone.next('desktop to phone')
    assert(
      atPhone.type === 'pty-out' &&
        Buffer.from(atPhone.data, 'base64').toString('utf8') === desktopMarker,
      'desktop-to-phone relay failed'
    )
  } finally {
    desktop.close()
    phone.close()
  }
}

async function verifyUnavailable(roomId) {
  const client = await Client.connect()
  try {
    client.send({ v: 1, type: 'hello', role: 'desktop', roomId })
    assert((await client.next('bad key')).type === 'bad-key', 'room unexpectedly joined')
  } finally {
    client.close()
  }
}

async function verifyPublicBoundary() {
  for (const path of ['/remote', '/remote/']) {
    const response = await fetch(`${targetOrigin}${path}`, { redirect: 'manual' })
    assert(response.status === 307, `${path} did not return 307`)
    assert(response.headers.get('location') === '/dashboard', `${path} leaked an absolute redirect`)
  }
  const system = await fetch(`${targetOrigin}/remote/v1/system/state`, {
    headers: authorization
  })
  assert(system.status === 404, 'public system API was not blocked by Nginx')
  assert((await fetch(`${targetOrigin}/remote/demo`)).status === 404, 'public demo was not blocked')
  const anonymousCreate = await fetch(`${targetOrigin}/remote/v1/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}'
  })
  assert(anonymousCreate.status === 401, 'anonymous room creation was not rejected')
}

function assertStoredIdentity(row, expected) {
  assert(row !== null, 'stored pairing disappeared')
  assert(row.joinUrl === expected.joinUrl, 'stored URL changed')
  assert(row.roomId === expected.roomId, 'stored roomId changed')
  assert(
    row.revokeTokenEnc === expected.revokeTokenEnc,
    'stored revoke credential changed'
  )
  assert(row.status === 'active', 'stored pairing is not active')
}

async function verifySecretFreeLogs(markers) {
  const containers = [
    relayContainer,
    webContainer,
    reconcilerContainer,
    edgeContainer
  ].filter(Boolean)
  for (const container of containers) {
    const logs = await dockerLogs(container)
    for (const marker of markers.filter(Boolean)) {
      assert(!logs.includes(marker), `sensitive marker appeared in ${container} logs`)
    }
  }
}

async function restartAndRecover(roomId, containers) {
  const before = await relayState()
  await docker(['restart', ...containers])
  const healthAt = await waitForPublicHealth()
  await waitFor('Web health after restart', async () => {
    const response = await fetch(`${targetOrigin}/`, {
      signal: AbortSignal.timeout(2_000)
    })
    return response.ok ? true : null
  })
  await waitForRoom(roomId, true)
  const recoveredAt = Date.now()
  const after = await relayState()
  assert(before.instanceId !== after.instanceId, 'Relay instanceId did not change')
  assert(after.synchronized === true, 'Relay did not become synchronized')
  assert(
    recoveredAt - healthAt <= recoveryTimeoutMs,
    'room recovery exceeded the health-relative SLO'
  )
  return recoveredAt - healthAt
}

const startedAt = Date.now()
const userId = `p2-gate-${randomBytes(8).toString('hex')}`
const pairingId = `pairing-${randomBytes(8).toString('hex')}`
let room
let storedIdentity
let seeded = false
let deleted = false

try {
  await ensureContainersExist()
  await verifyPublicBoundary()
  await waitFor('initial Relay synchronization', async () => {
    const state = await relayState()
    return state.synchronized ? state : null
  })

  const create = await fetch(`${relayOrigin}/remote/v1/rooms`, {
    method: 'POST',
    headers: {
      ...authorization,
      'content-type': 'application/json',
      origin: targetOrigin
    },
    body: '{}'
  })
  assert(create.status === 201, `service room creation returned ${create.status}`)
  room = await create.json()
  assert(
    room.joinUrl === `${targetOrigin}/remote/${room.roomId}`,
    'Relay returned a non-canonical pairing URL'
  )

  const seededState = await dbAction('seed', {
    userId,
    pairingId,
    email: `${userId}@example.test`,
    roomId: room.roomId,
    joinUrl: room.joinUrl,
    revokeToken: room.revokeToken
  })
  seeded = true
  await waitForAppliedRevision(seededState.revision)
  await waitForRoom(room.roomId, true)
  assert((await fetch(room.joinUrl)).status === 200, 'public pairing page was not available')
  storedIdentity = (await dbAction('query', { userId })).row
  assert(storedIdentity?.joinUrl === room.joinUrl, 'stored URL changed')
  assert(storedIdentity?.roomId === room.roomId, 'stored roomId changed')
  await verifyBidirectionalRelay(room.roomId)

  const relayRecoveryMs = await restartAndRecover(room.roomId, [relayContainer])
  assertStoredIdentity((await dbAction('query', { userId })).row, storedIdentity)
  await verifyBidirectionalRelay(room.roomId)

  const bannedState = await dbAction('ban', { userId })
  await waitForAppliedRevision(bannedState.revision)
  await waitForRoom(room.roomId, false)
  await verifyUnavailable(room.roomId)

  const unbannedState = await dbAction('unban', { userId })
  await waitForAppliedRevision(unbannedState.revision)
  await waitForRoom(room.roomId, true)
  assertStoredIdentity((await dbAction('query', { userId })).row, storedIdentity)
  await verifyBidirectionalRelay(room.roomId)

  const stackRecoveryMs = await restartAndRecover(room.roomId, [
    relayContainer,
    webContainer,
    reconcilerContainer
  ])
  assertStoredIdentity((await dbAction('query', { userId })).row, storedIdentity)
  await verifyBidirectionalRelay(room.roomId)

  const deletedState = await dbAction('delete', { userId })
  deleted = true
  await waitForAppliedRevision(deletedState.revision)
  await waitForRoom(room.roomId, false)
  await docker(['restart', relayContainer])
  await waitForPublicHealth()
  await waitFor('post-delete Relay synchronization', async () => {
    const state = await relayState()
    return state.synchronized && state.appliedRevision >= deletedState.revision
      ? state
      : null
  })
  assert((await roomStatus(room.roomId)) === 404, 'deleted account room was restored')
  await verifyUnavailable(room.roomId)

  await verifySecretFreeLogs([
    serviceToken,
    userId,
    pairingId,
    `${userId}@example.test`,
    room.roomId,
    room.joinUrl,
    room.revokeToken,
    storedIdentity.revokeTokenEnc
  ])

  process.stdout.write(
    `${JSON.stringify({
      result: 'passed',
      interface: 'real Docker restart + SQLite projection + HTTP/WebSocket',
      recoverySloMs: recoveryTimeoutMs,
      relayRecoveryMs,
      stackRecoveryMs,
      checks: [
        'public-root-dashboard-boundary',
        'public-system-and-demo-blocked',
        'anonymous-create-rejected',
        'account-persisted-url',
        'relay-restart-same-url',
        'stack-restart-same-url',
        'bidirectional-websocket-after-restart',
        'ban-removes-room',
        'unban-restores-same-url',
        'account-delete-does-not-resurrect',
        'secret-free-container-logs'
      ],
      elapsedMs: Date.now() - startedAt
    })}\n`
  )
} finally {
  if (seeded && !deleted) {
    await dbAction('delete', { userId }).catch(() => {})
  } else if (room && !seeded) {
    await fetch(`${relayOrigin}/remote/v1/rooms/${room.roomId}`, {
      method: 'DELETE',
      headers: { authorization: `Bearer ${room.revokeToken}` }
    }).catch(() => {})
  }
}
