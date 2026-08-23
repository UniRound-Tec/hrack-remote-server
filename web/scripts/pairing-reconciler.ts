import { createServer } from 'node:http'
import { closeDb } from '../src/lib/db'
import {
  loadPairingReconcilerConfig,
  runPairingReconciler,
  type PairingReconcilerHealth
} from '../src/lib/pairing/reconciler'

function healthPort(): number {
  const value = Number(process.env.RECONCILER_HEALTH_PORT ?? '3001')
  if (!Number.isSafeInteger(value) || value < 1 || value > 65_535) {
    throw new Error('RECONCILER_HEALTH_PORT must be a valid port')
  }
  return value
}

async function main(): Promise<void> {
  const config = loadPairingReconcilerConfig()
  const staleAfterMs = Math.max(30_000, config.intervalMs * 3)
  let health: PairingReconcilerHealth = {
    checkedAt: Date.now(),
    lastSuccessAt: null,
    consecutiveFailures: 0
  }
  const healthServer = createServer((request, response) => {
    if (request.method !== 'GET' || request.url !== '/healthz') {
      response.writeHead(404).end()
      return
    }
    const healthy =
      health.lastSuccessAt !== null &&
      Date.now() - health.lastSuccessAt <= staleAfterMs
    response.writeHead(healthy ? 200 : 503, {
      'cache-control': 'no-store',
      'content-type': 'application/json'
    })
    response.end(
      JSON.stringify({
        ok: healthy,
        checkedAt: health.checkedAt,
        lastSuccessAt: health.lastSuccessAt,
        consecutiveFailures: health.consecutiveFailures,
        ...(health.error === undefined ? {} : { error: health.error })
      })
    )
  })
  await new Promise<void>((resolve, reject) => {
    healthServer.once('error', reject)
    healthServer.listen(healthPort(), '0.0.0.0', resolve)
  })
  const controller = new AbortController()
  const stop = (): void => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  try {
    await runPairingReconciler({
      ...config,
      signal: controller.signal,
      healthReporter: (nextHealth) => {
        health = nextHealth
      },
      logger: (record) => process.stdout.write(`${JSON.stringify(record)}\n`)
    })
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
    await new Promise<void>((resolve, reject) => {
      healthServer.close((error) => (error ? reject(error) : resolve()))
    })
    closeDb()
  }
}

void main().catch(() => {
  process.stderr.write(
    `${JSON.stringify({
      event: 'pairing-reconciler-fatal',
      result: 'failed',
      error: 'STARTUP_ERROR'
    })}\n`
  )
  process.exitCode = 1
})
