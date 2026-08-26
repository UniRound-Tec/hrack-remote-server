import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import {
  alertMessage,
  checkProductionHealth,
  productionConfigChecks
} from './production-monitor.mjs'

async function fixture() {
  const server = createServer((request, response) => {
    response.setHeader('content-security-policy', "default-src 'self'")
    if (
      request.url === '/remote/healthz' ||
      request.url === '/reconciler/healthz' ||
      request.url === '/_healthz'
    ) {
      response.writeHead(200).end('{"ok":true}')
      return
    }
    if (request.url === '/remote/v1/rooms' && request.method === 'POST') {
      response.writeHead(401).end()
      return
    }
    if (request.url === '/remote/v1/system/state' || request.url === '/remote/demo/') {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200).end('ok')
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('missing fixture address')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve()))
  }
}

test('checks the real HTTP interfaces without exposing response bodies', async () => {
  const server = await fixture()
  try {
    const report = await checkProductionHealth({
      origin: server.origin,
      dshPublicOrigin: server.origin,
      webInternalOrigin: server.origin,
      relayInternalOrigin: server.origin,
      reconcilerHealthUrl: `${server.origin}/reconciler/healthz`
    })
    assert.equal(report.ok, true)
    assert.deepEqual(report.checks.map((check) => check.name), [
      'public-web',
      'public-relay-health',
      'anonymous-create-blocked',
      'system-interface-hidden',
      'demo-hidden',
      'public-dsh-health',
      'internal-web',
      'internal-relay',
      'pairing-reconciler'
    ])
  } finally {
    await server.close()
  }
})

test('alert messages contain only check names and timestamps', () => {
  const message = alertMessage({
    checkedAt: '2026-08-23T00:00:00.000Z',
    checks: [
      { name: 'pairing-reconciler', ok: false, error: 'secret-like-detail' },
      { name: 'public-web', ok: true }
    ]
  })
  assert.deepEqual(message, {
    event: 'hrack-production-unhealthy',
    checkedAt: '2026-08-23T00:00:00.000Z',
    failingChecks: ['pairing-reconciler']
  })
  assert.equal(JSON.stringify(message).includes('secret-like-detail'), false)
})

test('strict release config reports only presence checks', () => {
  const checks = productionConfigChecks({
    EMAIL_VERIFICATION_REQUIRED: '1',
    MAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 'not-returned',
    SMTP_FROM: 'HRack <noreply@modplex.app>',
    MONITOR_ALERT_EMAIL_TO: 'ops@example.test',
    DSH_PUBLIC_ORIGIN: 'https://dsh.example.test'
  }, 'https://hrack.dev')
  assert.equal(checks.every((check) => check.ok), true)
  assert.equal(JSON.stringify(checks).includes('not-returned'), false)
  assert.equal(JSON.stringify(checks).includes('ops@example.test'), false)
})
