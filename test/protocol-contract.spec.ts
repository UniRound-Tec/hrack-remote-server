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

const upstreamSha256 = '295c157edd02c7cf6feaa969456822c0a6fe1ec775c99ff1b639f44b3db5f030'
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
  })
})
