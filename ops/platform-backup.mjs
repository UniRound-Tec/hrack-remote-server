import { createHash, randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import {
  createReadStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultDeployDir = path.join(root, 'deploy')
const archiveImage =
  'alpine:3.22@sha256:14358309a308569c32bdc37e2e0e9694be33a9d99e68afb0f5ff33cc1f695dce'
const sqliteCheckImage =
  'python:3.13.5-alpine@sha256:37b14db89f587f9eaa890e4a442a3fe55db452b69cca1403cc730bd0fbdc8aaf'

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const capture = options.capture ?? false
    const child = spawn(command, args, {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      windowsHide: true
    })
    let stdout = ''
    let stderr = ''
    if (capture) {
      child.stdout.on('data', (chunk) => { stdout += chunk.toString() })
      child.stderr.on('data', (chunk) => { stderr += chunk.toString() })
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

export function projectNameFromEnv(text) {
  let projectName
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const match = /^COMPOSE_PROJECT_NAME\s*=\s*(.+)$/.exec(line)
    if (match) projectName = match[1].trim().replace(/^(['"])(.*)\1$/, '$2')
  }
  if (!projectName || !/^[a-z0-9][a-z0-9_-]*$/i.test(projectName)) {
    throw new Error('deploy/.env must contain a safe COMPOSE_PROJECT_NAME')
  }
  return projectName
}

function safeProjectName(value) {
  if (!value || !/^[a-z0-9][a-z0-9_-]*$/i.test(value)) {
    throw new Error('project name must contain only letters, numbers, underscore or hyphen')
  }
  return value
}

function composeArgs(projectName, ...args) {
  return ['compose', '--project-name', projectName, ...args]
}

function parseArgs(argv) {
  const command = argv[0]
  if (!['create', 'rehearse'].includes(command)) {
    throw new Error('usage: platform-backup.mjs create --output DIR | rehearse --manifest FILE')
  }
  const values = {}
  for (let index = 1; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || !value) throw new Error(`missing value for ${key ?? 'argument'}`)
    values[key.slice(2)] = value
  }
  return { command, values }
}

async function sha256(file) {
  const hash = createHash('sha256')
  await new Promise((resolve, reject) => {
    createReadStream(file)
      .on('data', (chunk) => hash.update(chunk))
      .once('error', reject)
      .once('end', resolve)
  })
  return hash.digest('hex')
}

async function sourceVolume(deployDir, projectName) {
  const output = await run('docker', [
    'volume',
    'ls',
    '--filter',
    `label=com.docker.compose.project=${projectName}`,
    '--filter',
    'label=com.docker.compose.volume=web-data',
    '--format',
    '{{.Name}}'
  ], { capture: true, cwd: deployDir })
  const volumes = output.split(/\r?\n/).filter(Boolean)
  if (volumes.length !== 1) throw new Error('expected exactly one Compose web-data volume')
  return volumes[0]
}

async function runningWriters(deployDir, projectName) {
  const output = await run('docker', composeArgs(
    projectName, 'ps', '--services', '--status', 'running'
  ), { capture: true, cwd: deployDir })
  const running = new Set(output.split(/\r?\n/).filter(Boolean))
  return ['web', 'pairing-reconciler'].filter((service) => running.has(service))
}

async function createBackup(values) {
  const deployDir = path.resolve(values['deploy-dir'] ?? defaultDeployDir)
  const envPath = path.join(deployDir, '.env')
  const projectName = values.project
    ? safeProjectName(values.project)
    : existsSync(envPath)
      ? projectNameFromEnv(readFileSync(envPath, 'utf8'))
      : (() => { throw new Error('deploy/.env or --project is required') })()
  const outputDir = path.resolve(values.output ?? path.join(
    deployDir,
    'backups',
    new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')
  ))
  if (existsSync(outputDir)) throw new Error('backup output directory already exists')
  mkdirSync(outputDir, { recursive: true, mode: 0o700 })
  const archivePath = path.join(outputDir, 'web-data.tar.gz')
  const manifestPath = path.join(outputDir, 'manifest.json')
  const volume = await sourceVolume(deployDir, projectName)
  const writers = await runningWriters(deployDir, projectName)

  try {
    if (writers.length > 0) {
      await run('docker', composeArgs(projectName, 'stop', ...writers), { cwd: deployDir })
    }
    await run('docker', [
      'run', '--rm',
      '--mount', `type=volume,src=${volume},dst=/data,readonly`,
      '--mount', `type=bind,src=${outputDir},dst=/backup`,
      archiveImage,
      'tar', '-czf', '/backup/web-data.tar.gz', '-C', '/data', '.'
    ], { cwd: deployDir })
  } finally {
    if (writers.length > 0) {
      await run('docker', composeArgs(projectName, 'start', ...writers), { cwd: deployDir })
    }
  }

  const digest = await sha256(archivePath)
  const gitCommit = await run('git', ['rev-parse', 'HEAD'], { capture: true, cwd: root })
  const imageOutput = await run('docker', composeArgs(projectName, 'images', '--format', 'json'), {
    capture: true,
    cwd: deployDir
  })
  let imageValues
  try {
    const parsed = JSON.parse(imageOutput || '[]')
    imageValues = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    imageValues = imageOutput.split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line))
  }
  const images = imageValues.map((value) => {
    return {
      service: value.Service,
      image: value.Repository && value.Tag ? `${value.Repository}:${value.Tag}` : value.ID
    }
  })
  const manifest = {
    format: 'hrack-web-data-backup-v1',
    createdAt: new Date().toISOString(),
    archive: path.basename(archivePath),
    sha256: digest,
    bytes: statSync(archivePath).size,
    sourceVolume: volume,
    composeProject: projectName,
    gitCommit,
    images,
    secretsIncluded: false
  }
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600
  })
  process.stdout.write(`${JSON.stringify({
    result: 'created',
    manifest: manifestPath,
    bytes: manifest.bytes,
    sha256: digest
  })}\n`)
}

async function assertRehearsalVolume(volume) {
  const label = await run('docker', [
    'volume', 'inspect', '--format', '{{index .Labels "com.hrack.restore-rehearsal"}}', volume
  ], { capture: true })
  if (label !== 'true' || !volume.startsWith('hrack-restore-rehearsal-')) {
    throw new Error('refusing to use a volume that is not an HRack restore rehearsal target')
  }
}

async function rehearseBackup(values) {
  const manifestPath = path.resolve(values.manifest ?? '')
  if (!values.manifest || !existsSync(manifestPath)) throw new Error('--manifest must reference a backup manifest')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (manifest.format !== 'hrack-web-data-backup-v1') throw new Error('unsupported backup manifest')
  if (
    typeof manifest.archive !== 'string' ||
    path.basename(manifest.archive) !== manifest.archive ||
    !manifest.archive.endsWith('.tar.gz')
  ) {
    throw new Error('backup manifest contains an unsafe archive name')
  }
  const archivePath = path.join(path.dirname(manifestPath), manifest.archive)
  if (!existsSync(archivePath)) throw new Error('backup archive is missing')
  if (await sha256(archivePath) !== manifest.sha256) throw new Error('backup checksum mismatch')

  const volume = `hrack-restore-rehearsal-${process.pid}-${randomBytes(4).toString('hex')}`
  await run('docker', [
    'volume', 'create', '--label', 'com.hrack.restore-rehearsal=true', volume
  ], { capture: true })
  try {
    await assertRehearsalVolume(volume)
    await run('docker', [
      'run', '--rm',
      '--mount', `type=volume,src=${volume},dst=/data`,
      '--mount', `type=bind,src=${path.dirname(archivePath)},dst=/backup,readonly`,
      archiveImage,
      'tar', '-xzf', `/backup/${path.basename(archivePath)}`, '-C', '/data'
    ])
    const validation = await run('docker', [
      'run', '--rm',
      '--mount', `type=volume,src=${volume},dst=/data`,
      sqliteCheckImage,
      'python', '-c',
      [
        'import glob,json,sqlite3',
        "dbs=glob.glob('/data/**/*.db',recursive=True)",
        "assert len(dbs)==1, f'expected one SQLite database, got {len(dbs)}'",
        'db=sqlite3.connect(dbs[0])',
        "integrity=db.execute('PRAGMA integrity_check').fetchone()[0]",
        "tables=[r[0] for r in db.execute(\"SELECT name FROM sqlite_master WHERE type='table' ORDER BY name\")]",
        'db.close()',
        "assert integrity=='ok', integrity",
        "required={'user','pairings','admin_audit'}",
        "assert required.issubset(set(tables)), f'missing tables: {sorted(required-set(tables))}'",
        "print(json.dumps({'integrity':integrity,'tableCount':len(tables)}))"
      ].join(';')
    ], { capture: true })
    process.stdout.write(`${JSON.stringify({
      result: 'rehearsed',
      archiveSha256: manifest.sha256,
      validation: JSON.parse(validation)
    })}\n`)
  } finally {
    await assertRehearsalVolume(volume)
    await run('docker', ['volume', 'rm', volume], { capture: true })
  }
}

async function main() {
  const { command, values } = parseArgs(process.argv.slice(2))
  if (command === 'create') await createBackup(values)
  else await rehearseBackup(values)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  void main().catch((error) => {
    process.stderr.write(`${JSON.stringify({
      event: 'platform-backup-fatal',
      error: error instanceof Error ? error.message : 'UNKNOWN_ERROR'
    })}\n`)
    process.exitCode = 1
  })
}
