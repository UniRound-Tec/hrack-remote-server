import { monitorEventLoopDelay, performance } from 'node:perf_hooks'

import { loadRelayConfig } from './relay/relay-config.js'
import { createRelayServer } from './transport/http-server.js'

function integerEnvironment(name: string, fallback: number): number {
  const text = process.env[name]
  if (text === undefined) return fallback
  const value = Number(text)
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`)
  }
  return value
}

if (!process.env.PUBLIC_ORIGIN) {
  throw new Error('PUBLIC_ORIGIN is required')
}

const config = loadRelayConfig()
const port = integerEnvironment('PORT', 3000)
const host = process.env.HOST ?? '127.0.0.1'
const metricsIntervalMs = integerEnvironment('METRICS_INTERVAL_MS', 10_000)
const eventLoopDelay = monitorEventLoopDelay({ resolution: 20 })
eventLoopDelay.enable()
let previousUtilization = performance.eventLoopUtilization()

const writeLog = (record: object): void => {
  process.stdout.write(`${JSON.stringify(record)}\n`)
}

const server = createRelayServer({
  config,
  logger: writeLog,
  lifecycleLogs: process.env.LOG_LIFECYCLE_EVENTS === '1'
})

await server.listen(port, host)
writeLog({
  event: 'server-ready',
  host,
  port,
  basePath: config.basePath,
  at: new Date().toISOString()
})

const metrics = setInterval(() => {
  const memory = process.memoryUsage()
  const utilization = performance.eventLoopUtilization(previousUtilization)
  previousUtilization = performance.eventLoopUtilization()
  writeLog({
    event: 'runtime-metrics',
    rssMiB: Number((memory.rss / 1_048_576).toFixed(1)),
    heapUsedMiB: Number((memory.heapUsed / 1_048_576).toFixed(1)),
    eventLoopDelayP99Ms: Number((eventLoopDelay.percentile(99) / 1_000_000).toFixed(2)),
    eventLoopUtilization: Number(utilization.utilization.toFixed(4)),
    ...server.metrics(),
    at: new Date().toISOString()
  })
  eventLoopDelay.reset()
}, metricsIntervalMs)
metrics.unref()

let shuttingDown = false
const shutdown = async (signal: string): Promise<void> => {
  if (shuttingDown) return
  shuttingDown = true
  clearInterval(metrics)
  eventLoopDelay.disable()
  writeLog({ event: 'server-stopping', signal, at: new Date().toISOString() })
  await server.close()
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void shutdown(signal).then(() => process.exit(0))
  })
}
