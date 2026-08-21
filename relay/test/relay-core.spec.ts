import { describe, expect, it } from 'vitest'

import { defaultRelayConfig } from '../src/relay/relay-config.js'
import { RelayCore } from '../src/relay/RelayCore.js'

describe('RelayCore', () => {
  it('creates an unguessable room and a one-time revoke token', () => {
    const values = [
      Uint8Array.from({ length: 16 }, (_, index) => index),
      Uint8Array.from({ length: 32 }, (_, index) => 255 - index)
    ]
    const core = new RelayCore(defaultRelayConfig(), {
      now: () => 1_000,
      randomBytes: (size) => {
        const value = values.shift()
        expect(value?.byteLength).toBe(size)
        return value ?? new Uint8Array(size)
      }
    })

    const result = core.createRoom({ ipKey: 'ip-a' })

    expect(result).toEqual({
      ok: true,
      roomId: 'AAECAwQFBgcICQoLDA0ODw',
      joinUrl: 'https://relay.example/AAECAwQFBgcICQoLDA0ODw',
      revokeToken: '__79_Pv6-fj39vX08_Lx8O_u7ezr6uno5-bl5OPi4eA'
    })
    expect(core.roomAvailability(result.ok ? result.roomId : '')).toBe('open')
  })

  it('seats one desktop and one phone then routes only the allowed direction', () => {
    const random = [new Uint8Array(16).fill(1), new Uint8Array(32).fill(2)]
    const core = new RelayCore(defaultRelayConfig(), {
      now: () => 1_000,
      randomBytes: (size) => random.shift() ?? new Uint8Array(size)
    })
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')

    expect(
      core.handleSocket({ type: 'open', connectionId: 'desktop', ipKey: 'd' })
    ).toEqual([])
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'desktop',
        text: JSON.stringify({
          v: 1,
          type: 'hello',
          role: 'desktop',
          roomId: created.roomId
        }),
        bufferedAmount: () => 0
      })
    ).toEqual([
      {
        kind: 'send',
        connectionId: 'desktop',
        message: {
          v: 1,
          type: 'hello-ok',
          peer: { desktop: true, phone: false }
        }
      }
    ])

    core.handleSocket({ type: 'open', connectionId: 'phone', ipKey: 'p' })
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'phone',
        text: JSON.stringify({
          v: 1,
          type: 'hello',
          role: 'phone',
          roomId: created.roomId
        }),
        bufferedAmount: () => 0
      })
    ).toEqual([
      {
        kind: 'send',
        connectionId: 'phone',
        message: {
          v: 1,
          type: 'hello-ok',
          peer: { desktop: true, phone: true }
        }
      },
      {
        kind: 'send',
        connectionId: 'desktop',
        message: { v: 1, type: 'peer-join', role: 'phone' }
      }
    ])

    const snapshot = { v: 1, type: 'sessions-snapshot', sessions: [] }
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'desktop',
        text: JSON.stringify(snapshot),
        bufferedAmount: () => 0
      })
    ).toEqual([
      { kind: 'send', connectionId: 'phone', message: snapshot }
    ])
  })

  it('authenticates HTTP revoke and schedules revoked before close', () => {
    const random = [new Uint8Array(16).fill(3), new Uint8Array(32).fill(4)]
    const core = new RelayCore(defaultRelayConfig({ revokeDrainMs: 125 }), {
      now: () => 1_000,
      randomBytes: (size) => random.shift() ?? new Uint8Array(size)
    })
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')
    for (const [connectionId, role] of [
      ['desktop', 'desktop'],
      ['phone', 'phone']
    ] as const) {
      core.handleSocket({ type: 'open', connectionId, ipKey: connectionId })
      core.handleSocket({
        type: 'text',
        connectionId,
        text: JSON.stringify({ v: 1, type: 'hello', role, roomId: created.roomId }),
        bufferedAmount: () => 0
      })
    }

    expect(
      core.revokeRoom({ roomId: created.roomId, token: 'wrong-token' })
    ).toEqual({ status: 'not-found', effects: [] })
    expect(
      core.revokeRoom({ roomId: created.roomId, token: created.revokeToken })
    ).toEqual({
      status: 'revoked',
      effects: [
        {
          kind: 'close-after-send',
          connectionId: 'desktop',
          message: { v: 1, type: 'revoked' },
          code: 1000,
          reason: 'revoked',
          deadlineMs: 125
        },
        {
          kind: 'close-after-send',
          connectionId: 'phone',
          message: { v: 1, type: 'revoked' },
          code: 1000,
          reason: 'revoked',
          deadlineMs: 125
        }
      ]
    })
    expect(core.roomAvailability(created.roomId)).toBe('unavailable')
    expect(
      core.revokeRoom({ roomId: created.roomId, token: created.revokeToken })
    ).toEqual({ status: 'revoked', effects: [] })
  })

  it('enforces room creation rate and capacity limits', () => {
    let now = 0
    let byte = 0
    const core = new RelayCore(
      defaultRelayConfig({
        maxRooms: 2,
        createRate: { burst: 1, perMinute: 10 }
      }),
      {
        now: () => now,
        randomBytes: (size) => new Uint8Array(size).fill(byte++)
      }
    )

    expect(core.createRoom({ ipKey: 'same-ip' }).ok).toBe(true)
    expect(core.createRoom({ ipKey: 'same-ip' })).toEqual({
      ok: false,
      reason: 'rate-limited'
    })
    now = 6_000
    expect(core.createRoom({ ipKey: 'same-ip' }).ok).toBe(true)
    now = 12_000
    expect(core.createRoom({ ipKey: 'same-ip' })).toEqual({
      ok: false,
      reason: 'capacity'
    })
  })

  it('bounds rate-limit key memory and admits a new key after stale eviction', () => {
    let now = 0
    let byte = 20
    const core = new RelayCore(
      defaultRelayConfig({
        maxRateLimitKeys: 1,
        createRate: { burst: 1, perMinute: 60 }
      }),
      {
        now: () => now,
        randomBytes: (size) => new Uint8Array(size).fill(byte++)
      }
    )

    expect(core.createRoom({ ipKey: 'first' }).ok).toBe(true)
    expect(core.createRoom({ ipKey: 'second' })).toEqual({
      ok: false,
      reason: 'rate-limited'
    })
    now = 60_000
    expect(core.createRoom({ ipKey: 'second' }).ok).toBe(true)
  })

  it('rate-limits hello attempts by anonymized IP key', () => {
    const random = [new Uint8Array(16).fill(5), new Uint8Array(32).fill(6)]
    const core = new RelayCore(
      defaultRelayConfig({ helloRate: { burst: 1, perMinute: 1 } }),
      {
        now: () => 0,
        randomBytes: (size) => random.shift() ?? new Uint8Array(size)
      }
    )
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')
    for (const connectionId of ['one', 'two']) {
      core.handleSocket({ type: 'open', connectionId, ipKey: 'shared-ip' })
    }
    core.handleSocket({
      type: 'text',
      connectionId: 'one',
      text: JSON.stringify({
        v: 1,
        type: 'hello',
        role: 'desktop',
        roomId: created.roomId
      }),
      bufferedAmount: () => 0
    })

    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'two',
        text: JSON.stringify({
          v: 1,
          type: 'hello',
          role: 'phone',
          roomId: created.roomId
        }),
        bufferedAmount: () => 0
      })
    ).toEqual([
      {
        kind: 'close',
        connectionId: 'two',
        code: 1008,
        reason: 'hello-rate-limit'
      }
    ])
  })

  it('prevents seat stealing and closes a repeated direction violator', () => {
    const random = [new Uint8Array(16).fill(7), new Uint8Array(32).fill(8)]
    const core = new RelayCore(defaultRelayConfig(), {
      now: () => 0,
      randomBytes: (size) => random.shift() ?? new Uint8Array(size)
    })
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')

    for (const [connectionId, role] of [
      ['desktop', 'desktop'],
      ['phone', 'phone']
    ] as const) {
      core.handleSocket({ type: 'open', connectionId, ipKey: connectionId })
      core.handleSocket({
        type: 'text',
        connectionId,
        text: JSON.stringify({ v: 1, type: 'hello', role, roomId: created.roomId }),
        bufferedAmount: () => 0
      })
    }

    core.handleSocket({ type: 'open', connectionId: 'intruder', ipKey: 'i' })
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'intruder',
        text: JSON.stringify({
          v: 1,
          type: 'hello',
          role: 'desktop',
          roomId: created.roomId
        }),
        bufferedAmount: () => 0
      })
    ).toEqual([
      {
        kind: 'send',
        connectionId: 'intruder',
        message: { v: 1, type: 'occupied' }
      }
    ])

    const forged = JSON.stringify({ v: 1, type: 'revoked' })
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'phone',
        text: forged,
        bufferedAmount: () => 0
      })
    ).toEqual([])
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'phone',
        text: forged,
        bufferedAmount: () => 0
      })
    ).toEqual([])
    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'phone',
        text: forged,
        bufferedAmount: () => 0
      })
    ).toEqual([
      {
        kind: 'close',
        connectionId: 'phone',
        code: 1008,
        reason: 'policy-violation'
      }
    ])
    expect(core.handleSocket({ type: 'close', connectionId: 'phone' })).toEqual([
      {
        kind: 'send',
        connectionId: 'desktop',
        message: { v: 1, type: 'peer-leave', role: 'phone' }
      }
    ])
  })

  it('enforces hello deadline and ping/pong liveness with an injected clock', () => {
    let now = 0
    const random = [new Uint8Array(16).fill(9), new Uint8Array(32).fill(10)]
    const core = new RelayCore(
      defaultRelayConfig({
        helloDeadlineMs: 40,
        pingIntervalMs: 100,
        pongTimeoutMs: 50
      }),
      {
        now: () => now,
        randomBytes: (size) => random.shift() ?? new Uint8Array(size)
      }
    )
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')
    core.handleSocket({ type: 'open', connectionId: 'slow', ipKey: 'slow' })
    core.handleSocket({ type: 'open', connectionId: 'desktop', ipKey: 'desktop' })
    core.handleSocket({
      type: 'text',
      connectionId: 'desktop',
      text: JSON.stringify({
        v: 1,
        type: 'hello',
        role: 'desktop',
        roomId: created.roomId
      }),
      bufferedAmount: () => 0
    })

    now = 40
    expect(core.handleSocket({ type: 'tick' })).toEqual([
      {
        kind: 'close',
        connectionId: 'slow',
        code: 1008,
        reason: 'hello-timeout'
      }
    ])
    now = 100
    expect(core.handleSocket({ type: 'tick' })).toEqual([
      { kind: 'ping', connectionId: 'desktop' }
    ])
    now = 150
    expect(core.handleSocket({ type: 'tick' })).toEqual([
      {
        kind: 'close',
        connectionId: 'desktop',
        code: 1001,
        reason: 'pong-timeout'
      }
    ])
  })

  it('closes both seats when room transport buffering exceeds its bound', () => {
    const random = [new Uint8Array(16).fill(11), new Uint8Array(32).fill(12)]
    const core = new RelayCore(
      defaultRelayConfig({ maxRoomBufferedBytes: 100 }),
      {
        now: () => 0,
        randomBytes: (size) => random.shift() ?? new Uint8Array(size)
      }
    )
    const created = core.createRoom({ ipKey: 'creator' })
    if (!created.ok) throw new Error('room creation failed')
    for (const [connectionId, role] of [
      ['desktop', 'desktop'],
      ['phone', 'phone']
    ] as const) {
      core.handleSocket({ type: 'open', connectionId, ipKey: connectionId })
      core.handleSocket({
        type: 'text',
        connectionId,
        text: JSON.stringify({ v: 1, type: 'hello', role, roomId: created.roomId }),
        bufferedAmount: () => 0
      })
    }

    expect(
      core.handleSocket({
        type: 'text',
        connectionId: 'desktop',
        text: JSON.stringify({ v: 1, type: 'sessions-snapshot', sessions: [] }),
        bufferedAmount: (connectionId) => (connectionId === 'phone' ? 101 : 0)
      })
    ).toEqual([
      {
        kind: 'close',
        connectionId: 'desktop',
        code: 1013,
        reason: 'backpressure'
      },
      {
        kind: 'close',
        connectionId: 'phone',
        code: 1013,
        reason: 'backpressure'
      }
    ])
    expect(core.roomAvailability(created.roomId)).toBe('unavailable')
  })
})
