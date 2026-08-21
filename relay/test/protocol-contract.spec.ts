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

// f356bdc（create 帧补 cols/rows）更新了 vendored 协议文件但漏了这里的冻结哈希；
// 7d6059… 为该提交后文件的真实 sha256，随单仓重组一并修正。
const upstreamSha256 = '7d60591056e366e763f92922472c5818a09aabebf956530b9b732266ff618d6f'
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
})
