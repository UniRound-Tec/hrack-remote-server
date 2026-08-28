import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  REMOTE_PROTOCOL_VERSION,
  isRemoteDesktopToPhoneMessage,
  isRemotePhoneToDesktopMessage,
  parseRemoteFrame
} from '../src/protocol/remote-protocol.js'

const upstreamSha256 = '4733e22e08c468c6e8445885f92d8b5de5809503cc120f0ebf5be1b47586c2d7'
const protocolPath = fileURLToPath(
  new URL('../src/protocol/remote-protocol.ts', import.meta.url)
)

describe('vendored remote protocol contract', () => {
  it('matches the frozen upstream file byte-for-byte', async () => {
    const source = await readFile(protocolPath)
    expect(createHash('sha256').update(source).digest('hex')).toBe(upstreamSha256)
  })

  it.each(['hello', 'sessions-snapshot', 'drive-ok'])(
    'accepts the %s golden fixture',
    async (name) => {
      const fixture = await readFile(
        fileURLToPath(new URL(`../fixtures/remote/${name}.json`, import.meta.url)),
        'utf8'
      )
      expect(parseRemoteFrame(fixture).ok).toBe(true)
    }
  )

  it('keeps version and role directions frozen', () => {
    expect(REMOTE_PROTOCOL_VERSION).toBe(1)
    const desktop = parseRemoteFrame(
      JSON.stringify({ v: 1, type: 'sessions-snapshot', sessions: [] })
    )
    const phone = parseRemoteFrame(
      JSON.stringify({
        v: 1,
        type: 'drive',
        requestId: 'r1',
        sessionId: 's1',
        cols: 80,
        rows: 24
      })
    )
    expect(desktop.ok && isRemoteDesktopToPhoneMessage(desktop.value)).toBe(true)
    expect(phone.ok && isRemotePhoneToDesktopMessage(phone.value)).toBe(true)
    const focus = parseRemoteFrame(
      JSON.stringify({ v: 1, type: 'focus-session', sessionId: 's1' })
    )
    expect(focus.ok && isRemotePhoneToDesktopMessage(focus.value)).toBe(true)
    const cursorSync = parseRemoteFrame(
      JSON.stringify({
        v: 1,
        type: 'pty-cursor-sync',
        sessionId: 's1',
        row: 20,
        column: 7
      })
    )
    expect(
      cursorSync.ok && isRemoteDesktopToPhoneMessage(cursorSync.value)
    ).toBe(true)
  })

  it('forwards create dimensions and leaves blank workspace rejection to the desktop', () => {
    const create = parseRemoteFrame(
      JSON.stringify({
        v: 1,
        type: 'create',
        requestId: 'create-1',
        installationId: 'codex:fixture',
        workspace: '',
        cols: 52,
        rows: 20
      })
    )
    expect(create).toEqual({
      ok: true,
      value: {
        v: 1,
        type: 'create',
        requestId: 'create-1',
        installationId: 'codex:fixture',
        workspace: '',
        cols: 52,
        rows: 20
      }
    })
  })

  it('forwards remote computer directory requests and responses by role', () => {
    const request = parseRemoteFrame(
      JSON.stringify({
        v: 1,
        type: 'workspace-list',
        requestId: 'workspace-1',
        installationId: 'codex:host',
        path: 'C:\\Users',
        offset: 0
      })
    )
    expect(request.ok && isRemotePhoneToDesktopMessage(request.value)).toBe(true)

    const response = parseRemoteFrame(
      JSON.stringify({
        v: 1,
        type: 'workspace-list-ok',
        requestId: 'workspace-1',
        installationId: 'codex:host',
        path: 'C:\\Users',
        entries: [
          {
            name: 'Jesse',
            path: 'C:\\Users\\Jesse',
            kind: 'directory'
          }
        ]
      })
    )
    expect(response.ok && isRemoteDesktopToPhoneMessage(response.value)).toBe(true)
  })

  it('parses DSH ticket controls without forwarding the request to Desktop', () => {
    const request = parseRemoteFrame(JSON.stringify({
      v: 1,
      type: 'dsh-ticket-request',
      requestId: 'ticket-1'
    }))
    expect(request).toMatchObject({ ok: true })
    expect(request.ok && isRemotePhoneToDesktopMessage(request.value)).toBe(false)

    expect(parseRemoteFrame(JSON.stringify({
      v: 1,
      type: 'dsh-ticket-ok',
      requestId: 'ticket-1',
      url: 'https://dsh.example/_connect/opaque',
      expiresAt: 1_800_000_000_000
    }))).toMatchObject({ ok: true })
  })
})
