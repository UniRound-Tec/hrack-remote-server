import { closeDb } from '../src/lib/db'
import {
  loadPairingReconcilerConfig,
  runPairingReconciler
} from '../src/lib/pairing/reconciler'

async function main(): Promise<void> {
  const config = loadPairingReconcilerConfig()
  const controller = new AbortController()
  const stop = (): void => controller.abort()
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)

  try {
    await runPairingReconciler({
      ...config,
      signal: controller.signal,
      logger: (record) => process.stdout.write(`${JSON.stringify(record)}\n`)
    })
  } finally {
    process.removeListener('SIGINT', stop)
    process.removeListener('SIGTERM', stop)
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
