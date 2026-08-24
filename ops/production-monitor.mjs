import tls from 'node:tls'
import { setTimeout as wait } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'

const DEFAULT_TIMEOUT_MS = 5_000

function asOrigin(value, label) {
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol) || url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`${label} must contain only scheme and authority`)
  }
  return url
}

function positiveInteger(value, fallback, label) {
  const parsed = Number(value ?? fallback)
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`${label} must be a positive integer`)
  }
  return parsed
}

async function timedCheck(name, check, now = Date.now) {
  const startedAt = now()
  try {
    const detail = await check()
    return {
      name,
      ok: true,
      elapsedMs: Math.max(0, now() - startedAt),
      ...(detail === undefined ? {} : { detail })
    }
  } catch (error) {
    return {
      name,
      ok: false,
      elapsedMs: Math.max(0, now() - startedAt),
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    }
  }
}

async function expectResponse(fetcher, url, init, expectedStatus, headers = []) {
  const response = await fetcher(url, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
  })
  if (response.status !== expectedStatus) {
    throw new Error(`HTTP_${response.status}`)
  }
  for (const header of headers) {
    if (!response.headers.get(header)) throw new Error(`MISSING_${header.toUpperCase()}`)
  }
}

async function inspectTls(origin, minimumDays, connect = tls.connect) {
  const port = Number(origin.port || '443')
  return new Promise((resolve, reject) => {
    const socket = connect({
      host: origin.hostname,
      port,
      servername: origin.hostname,
      rejectUnauthorized: true
    })
    const timer = setTimeout(() => socket.destroy(new Error('TLS_TIMEOUT')), DEFAULT_TIMEOUT_MS)
    socket.once('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    socket.once('secureConnect', () => {
      clearTimeout(timer)
      const certificate = socket.getPeerCertificate()
      const validTo = Date.parse(certificate.valid_to)
      socket.end()
      if (!Number.isFinite(validTo)) {
        reject(new Error('TLS_EXPIRY_MISSING'))
        return
      }
      const daysRemaining = Math.floor((validTo - Date.now()) / 86_400_000)
      if (daysRemaining < minimumDays) {
        reject(new Error('TLS_EXPIRING_SOON'))
        return
      }
      resolve({ daysRemaining })
    })
  })
}

export async function checkProductionHealth(options) {
  const origin = asOrigin(options.origin, 'origin')
  const fetcher = options.fetcher ?? fetch
  const now = options.now ?? Date.now
  const minimumTlsDays = positiveInteger(options.minimumTlsDays, 14, 'minimumTlsDays')
  const checks = []

  if (origin.protocol === 'https:') {
    checks.push(await timedCheck('public-tls', () => inspectTls(origin, minimumTlsDays, options.tlsConnect), now))
    checks.push(await timedCheck('http-to-https', async () => {
      const httpUrl = new URL(origin)
      httpUrl.protocol = 'http:'
      httpUrl.port = ''
      const response = await fetcher(httpUrl, {
        redirect: 'manual',
        signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
      })
      if (![301, 302, 307, 308].includes(response.status)) throw new Error(`HTTP_${response.status}`)
      const location = response.headers.get('location')
      if (!location || new URL(location, httpUrl).origin !== origin.origin) {
        throw new Error('INVALID_HTTPS_REDIRECT')
      }
    }, now))
  }

  checks.push(await timedCheck('public-web', () =>
    expectResponse(
      fetcher,
      new URL('/', origin),
      {},
      200,
      origin.protocol === 'https:'
        ? ['content-security-policy', 'strict-transport-security']
        : ['content-security-policy']
    ), now))
  checks.push(await timedCheck('public-relay-health', () =>
    expectResponse(fetcher, new URL('/remote/healthz', origin), {}, 200), now))
  checks.push(await timedCheck('anonymous-create-blocked', () =>
    expectResponse(fetcher, new URL('/remote/v1/rooms', origin), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}'
    }, 401), now))
  checks.push(await timedCheck('system-interface-hidden', () =>
    expectResponse(fetcher, new URL('/remote/v1/system/state', origin), {}, 404), now))
  checks.push(await timedCheck('demo-hidden', () =>
    expectResponse(fetcher, new URL('/remote/demo/', origin), {}, 404), now))

  if (options.dshPublicOrigin) {
    const dshOrigin = asOrigin(options.dshPublicOrigin, 'dshPublicOrigin')
    if (dshOrigin.protocol === 'https:') {
      checks.push(await timedCheck('public-dsh-tls', () =>
        inspectTls(dshOrigin, minimumTlsDays, options.tlsConnect), now))
    }
    checks.push(await timedCheck('public-dsh-health', () =>
      expectResponse(
        fetcher,
        new URL('/_healthz', dshOrigin),
        {},
        200,
        dshOrigin.protocol === 'https:' ? ['strict-transport-security'] : []
      ), now))
  }

  if (options.webInternalOrigin) {
    const webOrigin = asOrigin(options.webInternalOrigin, 'webInternalOrigin')
    checks.push(await timedCheck('internal-web', () =>
      expectResponse(fetcher, new URL('/', webOrigin), {}, 200), now))
  }
  if (options.relayInternalOrigin) {
    const relayOrigin = asOrigin(options.relayInternalOrigin, 'relayInternalOrigin')
    checks.push(await timedCheck('internal-relay', () =>
      expectResponse(fetcher, new URL('/remote/healthz', relayOrigin), {}, 200), now))
  }
  if (options.reconcilerHealthUrl) {
    checks.push(await timedCheck('pairing-reconciler', () =>
      expectResponse(fetcher, new URL(options.reconcilerHealthUrl), {}, 200), now))
  }

  return {
    ok: checks.every((check) => check.ok),
    checkedAt: new Date(now()).toISOString(),
    checks
  }
}

export function alertMessage(report, recovered = false) {
  const failingChecks = report.checks.filter((check) => !check.ok).map((check) => check.name)
  return {
    event: recovered ? 'hrack-production-recovered' : 'hrack-production-unhealthy',
    checkedAt: report.checkedAt,
    failingChecks
  }
}

export function productionConfigChecks(env, origin) {
  const expectedMailDomain = env.P5_MAIL_DOMAIN ?? 'modplex.app'
  const from = env.SMTP_FROM ?? ''
  const fromMatch = /(?:^|<)[^<>\s]+@([^<>\s]+)>?$/.exec(from.trim())
  const fromDomain = fromMatch?.[1]?.toLowerCase()
  const checks = [
    {
      name: 'production-https-configured',
      ok: new URL(origin).protocol === 'https:'
    },
    {
      name: 'email-verification-required',
      ok: ['1', 'true'].includes((env.EMAIL_VERIFICATION_REQUIRED ?? '').toLowerCase())
    },
    {
      name: 'resend-verified-domain-configured',
      ok:
        env.MAIL_PROVIDER === 'resend' &&
        Boolean(env.RESEND_API_KEY) &&
        fromDomain === expectedMailDomain.toLowerCase()
    },
    {
      name: 'alert-sink-configured',
      ok: Boolean(
        env.MONITOR_ALERT_WEBHOOK_URL ||
        (env.MONITOR_ALERT_EMAIL_TO && env.RESEND_API_KEY && env.SMTP_FROM)
      )
    },
    {
      name: 'bootstrap-token-removed',
      ok: !env.ADMIN_SETUP_TOKEN
    },
    {
      name: 'anonymous-debug-create-disabled',
      ok: !env.ENABLE_DEV_CREATE
    },
    {
      name: 'dsh-public-origin-configured',
      ok: (() => {
        try {
          return asOrigin(env.DSH_PUBLIC_ORIGIN ?? '', 'DSH_PUBLIC_ORIGIN').protocol === 'https:'
        } catch {
          return false
        }
      })()
    }
  ]
  return checks.map((check) => ({
    ...check,
    elapsedMs: 0,
    ...(check.ok ? {} : { error: 'PRODUCTION_CONFIG_MISSING' })
  }))
}

async function deliverAlert(message, env = process.env, fetcher = fetch) {
  const deliveries = []
  if (env.MONITOR_ALERT_WEBHOOK_URL) {
    deliveries.push(fetcher(env.MONITOR_ALERT_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(message),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    }))
  }
  if (env.MONITOR_ALERT_EMAIL_TO && env.RESEND_API_KEY && env.SMTP_FROM) {
    deliveries.push(fetcher('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.RESEND_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        from: env.SMTP_FROM,
        to: [env.MONITOR_ALERT_EMAIL_TO],
        subject: message.event === 'hrack-production-recovered'
          ? '[HRack] production recovered'
          : '[HRack] production alert',
        text: `${message.event}\ncheckedAt=${message.checkedAt}\nfailingChecks=${message.failingChecks.join(',') || 'none'}`
      }),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)
    }))
  }
  if (deliveries.length === 0) return false
  const responses = await Promise.all(deliveries)
  if (responses.some((response) => !response.ok)) throw new Error('ALERT_DELIVERY_FAILED')
  return true
}

function optionsFromEnv(env) {
  return {
    origin: env.PUBLIC_ORIGIN,
    dshPublicOrigin: env.DSH_PUBLIC_ORIGIN,
    webInternalOrigin: env.WEB_INTERNAL_ORIGIN,
    relayInternalOrigin: env.RELAY_INTERNAL_ORIGIN,
    reconcilerHealthUrl: env.RECONCILER_HEALTH_URL,
    minimumTlsDays: positiveInteger(env.MONITOR_TLS_MIN_DAYS, 14, 'MONITOR_TLS_MIN_DAYS')
  }
}

async function main() {
  const originFlagIndex = process.argv.indexOf('--origin')
  const originFlag = originFlagIndex === -1 ? undefined : process.argv[originFlagIndex + 1]
  const origin = originFlag ?? process.env.PUBLIC_ORIGIN
  if (!origin) throw new Error('PUBLIC_ORIGIN or --origin is required')
  const once = process.argv.includes('--once')
  const intervalMs = positiveInteger(process.env.MONITOR_INTERVAL_MS, 30_000, 'MONITOR_INTERVAL_MS')
  const failureThreshold = positiveInteger(
    process.env.MONITOR_FAILURE_THRESHOLD,
    3,
    'MONITOR_FAILURE_THRESHOLD'
  )
  let consecutiveFailures = 0
  let incidentOpen = false

  do {
    const report = await checkProductionHealth({
      ...optionsFromEnv(process.env),
      origin
    })
    if (process.env.P5_REQUIRE_PRODUCTION_CONFIG === '1') {
      report.checks.push(...productionConfigChecks(process.env, origin))
      report.ok = report.checks.every((check) => check.ok)
    }
    process.stdout.write(`${JSON.stringify({ event: 'production-health', ...report })}\n`)
    if (report.ok) {
      consecutiveFailures = 0
      if (incidentOpen) {
        const delivered = await deliverAlert(alertMessage(report, true))
        if (delivered) incidentOpen = false
      }
    } else {
      consecutiveFailures += 1
      if (!incidentOpen && consecutiveFailures >= failureThreshold) {
        const delivered = await deliverAlert(alertMessage(report))
        if (delivered) incidentOpen = true
      }
    }
    if (once) {
      if (!report.ok) process.exitCode = 1
      break
    }
    await wait(intervalMs)
  } while (true)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      event: 'production-monitor-fatal',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    })}\n`)
    process.exitCode = 1
  })
}
