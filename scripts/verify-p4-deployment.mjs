import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import net from 'node:net'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const deployDir = path.join(root, 'deploy')
const durableVerifier = path.join(
  root,
  'relay',
  'scripts',
  'durable-recovery-verify.mjs'
)
const project = `hrack-p4-gate-${process.pid}-${randomBytes(4).toString('hex')}`

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function run(command, args, options = {}) {
  const { capture = false, env = process.env } = options
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    if (capture) {
      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString()
      })
      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString()
      })
    }
    child.once('error', reject)
    child.once('close', (code) => {
      if (code === 0) resolve(stdout.trim())
      else {
        if (capture && stderr.trim()) process.stderr.write(stderr)
        reject(new Error(`${command} ${args[0] ?? ''} exited with ${code}`))
      }
    })
  })
}

async function unusedLoopbackPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer()
    server.unref()
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address ? address.port : null
      server.close((error) => {
        if (error) reject(error)
        else if (port) resolve(port)
        else reject(new Error('failed to allocate a loopback port'))
      })
    })
  })
}

function composeArgs(...args) {
  return [
    'compose',
    '--project-name',
    project,
    '--file',
    'docker-compose.yml',
    '--file',
    'docker-compose.verify.yml',
    '--profile',
    'verify',
    ...args
  ]
}

async function serviceContainer(service, env) {
  const id = await run('docker', composeArgs('ps', '--quiet', service), {
    cwd: deployDir,
    capture: true,
    env
  })
  assert(id && !id.includes('\n'), `expected one ${service} container`)
  const name = await run(
    'docker',
    ['inspect', '--format', '{{.Name}}', id],
    { capture: true, env }
  )
  return name.replace(/^\//, '')
}

async function assertVolumeBoundary(relayContainer, env) {
  const relayMounts = JSON.parse(
    await run(
      'docker',
      ['inspect', '--format', '{{json .Mounts}}', relayContainer],
      { capture: true, env }
    )
  )
  assert(
    relayMounts.every((mount) => mount.Type !== 'volume'),
    'Relay unexpectedly owns a persistent volume'
  )
  const volumes = await run(
    'docker',
    [
      'volume',
      'ls',
      '--filter',
      `label=com.docker.compose.project=${project}`,
      '--filter',
      'label=com.docker.compose.volume=web-data',
      '--format',
      '{{.Name}}'
    ],
    { capture: true, env }
  )
  assert(volumes && !volumes.includes('\n'), 'expected one isolated web-data volume')
}

async function verifyProductionNginxConfig(env) {
  const edgeConfig = path.join(deployDir, 'nginx.hrack.conf.example')
  const routes = path.join(deployDir, 'nginx.routes.conf')
  await run(
    'docker',
    [
      'run',
      '--rm',
      '--add-host',
      'web:127.0.0.1',
      '--add-host',
      'relay:127.0.0.1',
      '--volume',
      `${edgeConfig}:/etc/nginx/conf.d/default.conf:ro`,
      '--volume',
      `${routes}:/etc/nginx/hrack.routes.conf:ro`,
      '--entrypoint',
      '/bin/sh',
      'nginx:1.27-bookworm',
      '-ec',
      "mkdir -p /etc/nginx/certs; openssl req -x509 -newkey rsa:2048 -nodes -days 1 -subj /CN=hrack.example -keyout /etc/nginx/certs/privkey.pem -out /etc/nginx/certs/fullchain.pem >/dev/null 2>&1; nginx -t"
    ],
    { env }
  )
}

const edgePort = await unusedLoopbackPort()
let relayPort = await unusedLoopbackPort()
while (relayPort === edgePort) relayPort = await unusedLoopbackPort()

const env = {
  ...process.env,
  PUBLIC_ORIGIN: `http://127.0.0.1:${edgePort}`,
  RELAY_SERVICE_TOKEN: randomBytes(32).toString('hex'),
  BETTER_AUTH_SECRET: randomBytes(32).toString('hex'),
  PAIRING_ENC_KEY: randomBytes(32).toString('base64'),
  SETTINGS_ENC_KEY: randomBytes(32).toString('base64'),
  EMAIL_VERIFICATION_REQUIRED: '0',
  VERIFY_EDGE_PORT: String(edgePort),
  VERIFY_RELAY_PORT: String(relayPort)
}

const startedAt = Date.now()
let upAttempted = false
try {
  await run('docker', ['version'], { capture: true, env })
  await verifyProductionNginxConfig(env)
  upAttempted = true
  await run(
    'docker',
    composeArgs('up', '--detach', '--build', '--wait', '--wait-timeout', '300'),
    { cwd: deployDir, env }
  )

  const relayContainer = await serviceContainer('relay', env)
  const webContainer = await serviceContainer('web', env)
  const reconcilerContainer = await serviceContainer('pairing-reconciler', env)
  const edgeContainer = await serviceContainer('nginx-verify', env)
  await assertVolumeBoundary(relayContainer, env)

  await run(process.execPath, [durableVerifier], {
    env: {
      ...env,
      TARGET_ORIGIN: env.PUBLIC_ORIGIN,
      RELAY_INTERNAL_ORIGIN: `http://127.0.0.1:${relayPort}`,
      RELAY_CONTAINER: relayContainer,
      WEB_CONTAINER: webContainer,
      RECONCILER_CONTAINER: reconcilerContainer,
      EDGE_CONTAINER: edgeContainer,
      RECOVERY_TIMEOUT_MS: '15000'
    }
  })

  process.stdout.write(
    `${JSON.stringify({
      result: 'passed',
      interface: 'isolated from-zero Docker Compose deployment',
      checks: [
        'production-nginx-config',
        'fresh-images-and-services',
        'isolated-sqlite-volume',
        'stateless-relay-volume-boundary',
        'nginx-public-boundary',
        'same-url-after-relay-and-stack-restart'
      ],
      elapsedMs: Date.now() - startedAt
    })}\n`
  )
} finally {
  if (upAttempted) {
    await run(
      'docker',
      composeArgs(
        'down',
        '--volumes',
        '--rmi',
        'local',
        '--remove-orphans',
        '--timeout',
        '10'
      ),
      { cwd: deployDir, env }
    )
  }
}
