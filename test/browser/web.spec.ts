import { createServer as createNetServer } from 'node:net'

import { expect, test } from '@playwright/test'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'

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
