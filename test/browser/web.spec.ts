import { createServer as createNetServer } from 'node:net'

import { expect, test } from '@playwright/test'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import WebSocket from 'ws'

import { defaultRelayConfig } from '../../src/relay/relay-config.js'
import {
  createRelayServer,
  type RunningRelayServer
} from '../../src/transport/http-server.js'

const decodeQr = jsQR as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number
) => { data: string } | null

async function unusedPort(): Promise<number> {
  const socket = createNetServer()
  await new Promise<void>((resolve, reject) => {
    socket.once('error', reject)
    socket.listen(0, '127.0.0.1', resolve)
  })
  const address = socket.address()
  if (!address || typeof address === 'string') throw new Error('missing port')
  await new Promise<void>((resolve, reject) =>
    socket.close((error) => (error ? reject(error) : resolve()))
  )
  return address.port
}

let server: RunningRelayServer
let origin: string

test.beforeAll(async () => {
  const port = await unusedPort()
  origin = `http://127.0.0.1:${port}`
  server = createRelayServer({
    config: defaultRelayConfig({
      publicOrigin: origin,
      basePath: '/remote',
      allowInsecureLoopback: true
    })
  })
  await server.listen(port, '127.0.0.1')
})

test.afterAll(async () => {
  await server.close()
})

test('creates, decodes, copies, opens, and revokes a room in a real browser', async ({
  page,
  context
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], {
    origin
  })
  const response = await page.goto(`${origin}/remote/`)
  expect(response?.headers()['content-security-policy']).toContain("default-src 'none'")
  await page.getByTestId('create-room').click()

  const joinUrl = await page.getByTestId('join-url').textContent()
  expect(joinUrl).toMatch(new RegExp(`^${origin}/remote/[A-Za-z0-9_-]{22}$`))
  await expect(page.getByTestId('join-qr')).toHaveAttribute('data-qr-url', joinUrl ?? '')

  const screenshot = await page.getByTestId('join-qr').screenshot()
  const image = PNG.sync.read(screenshot)
  const decoded = decodeQr(
    Uint8ClampedArray.from(image.data),
    image.width,
    image.height
  )
  expect(decoded?.data).toBe(joinUrl)

  await page.getByTestId('copy-url').click()
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(joinUrl)

  const joinPage = await context.newPage()
  await joinPage.goto(joinUrl ?? '')
  await expect(joinPage.getByRole('heading', { name: 'Pair this room in HRack' })).toBeVisible()
  await expect(joinPage.getByTestId('join-qr')).toHaveAttribute(
    'data-qr-url',
    joinUrl ?? ''
  )
  await expect(joinPage.locator('textarea, [role="terminal"], .xterm')).toHaveCount(0)

  await page.getByTestId('revoke-room').click()
  await expect(page.getByTestId('status')).toHaveText('Room revoked.')
  await joinPage.reload()
  await expect(joinPage.getByRole('heading', { name: 'Room unavailable' })).toBeVisible()
})

test('browser demo drives a real protocol session with terminal input and output', async ({
  page,
  request
}) => {
  const created = await request.post(`${origin}/remote/v1/rooms`, { data: {} })
  expect(created.ok()).toBe(true)
  const room = (await created.json()) as {
    roomId: string
    joinUrl: string
    revokeToken: string
  }
  const desktopMessages: Array<Record<string, unknown>> = []
  const desktop = new WebSocket(
    `${origin.replace(/^http/, 'ws')}/remote/v1/ws`
  )
  desktop.on('message', (data) => {
    desktopMessages.push(JSON.parse(data.toString()) as Record<string, unknown>)
  })
  await new Promise<void>((resolve, reject) => {
    desktop.once('open', () => resolve())
    desktop.once('error', reject)
  })

  try {
    desktop.send(
      JSON.stringify({
        v: 1,
        type: 'hello',
        role: 'desktop',
        roomId: room.roomId
      })
    )
    await expect
      .poll(() => desktopMessages.some((message) => message.type === 'hello-ok'))
      .toBe(true)

    await page.goto(
      `${origin}/remote/demo/${encodeURIComponent(room.roomId)}`
    )
    await expect(page.getByTestId('demo-page')).toBeVisible()
    await page.getByTestId('demo-connect').click()
    await expect(page.getByTestId('demo-status')).toHaveAttribute(
      'data-phase',
      'peer-online'
    )

    desktop.send(
      JSON.stringify({
        v: 1,
        type: 'sessions-snapshot',
        sessions: [
          {
            sessionId: 'session-1',
            name: 'Browser demo fixture',
            adapterId: 'codex',
            status: 'idle',
            statusConfidence: 'high',
            pendingAttentionCount: 0,
            activeToolCount: 0,
            lastActivityAt: Date.now(),
            workspace: 'C:/fixture'
          }
        ]
      })
    )
    await expect(page.getByTestId('demo-session')).toContainText(
      'Browser demo fixture'
    )
    await page.getByTestId('demo-session').click()
    const drive = await expect
      .poll(() => desktopMessages.find((message) => message.type === 'drive'))
      .toBeTruthy()
    void drive
    const driveRequest = desktopMessages.find(
      (message) => message.type === 'drive'
    )
    if (!driveRequest || typeof driveRequest.requestId !== 'string') {
      throw new Error('demo did not send a correlated drive request')
    }
    desktop.send(
      JSON.stringify({
        v: 1,
        type: 'drive-ok',
        requestId: driveRequest.requestId,
        sessionId: 'session-1',
        cols: driveRequest.cols,
        rows: driveRequest.rows,
        history: {
          complete: true,
          retainedOutputBytes: 6,
          droppedOutputBytes: 0,
          droppedEvents: 0,
          events: [
            {
              sequence: 1,
              kind: 'output',
              data: 'ready>',
              byteLength: 6
            }
          ]
        }
      })
    )
    await expect(page.getByTestId('demo-terminal-view')).toBeVisible()
    await expect(page.locator('.xterm')).toBeVisible()
    await expect
      .poll(() =>
        page.evaluate(() =>
          [...document.fonts].some(
            (font) => font.family === 'Maple Mono' && font.status === 'loaded'
          )
        )
      )
      .toBe(true)
    await expect(page.locator('.terminal-host')).toHaveAttribute(
      'data-renderer-attempted',
      '1'
    )
    await expect
      .poll(() =>
        page
          .locator('.terminal-host')
          .evaluate((element) => getComputedStyle(element).backgroundColor)
      )
      .toBe('rgb(31, 31, 31)')

    const marker = 'BROWSER_DEMO_INPUT'
    await page.locator('.xterm-helper-textarea').focus()
    await page.keyboard.type(marker)
    await page.keyboard.press('Enter')
    await expect
      .poll(() =>
        desktopMessages
          .filter((message) => message.type === 'pty-in')
          .map((message) => String(message.data ?? ''))
          .join('')
      )
      .toContain(`${marker}\r`)

    const output = new TextEncoder().encode('BROWSER_DEMO_OUTPUT\r\n')
    desktop.send(
      JSON.stringify({
        v: 1,
        type: 'pty-out',
        sessionId: 'session-1',
        data: Buffer.from(output).toString('base64'),
        byteLength: output.byteLength
      })
    )
    await expect
      .poll(() =>
        desktopMessages.find(
          (message) =>
            message.type === 'pty-ack' && message.bytes === output.byteLength
        )
      )
      .toBeTruthy()
    await expect(page.locator('.terminal-host')).toHaveAttribute(
      'data-rendered-pty-bytes',
      String(output.byteLength)
    )

    await page.getByTestId('demo-return').click()
    await expect
      .poll(() => desktopMessages.find((message) => message.type === 'undrive'))
      .toMatchObject({ type: 'undrive', sessionId: 'session-1' })
    desktop.send(
      JSON.stringify({
        v: 1,
        type: 'undriven',
        sessionId: 'session-1',
        reason: 'left'
      })
    )
    await expect(page.getByTestId('demo-session-list')).toBeVisible()
  } finally {
    desktop.close()
    await request.delete(
      `${origin}/remote/v1/rooms/${encodeURIComponent(room.roomId)}`,
      { headers: { authorization: `Bearer ${room.revokeToken}` } }
    )
  }
})
