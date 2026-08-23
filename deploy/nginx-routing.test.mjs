import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const edgeConfig = fs
  .readFileSync(new URL('./nginx.hrack.conf.example', import.meta.url), 'utf8')
  .replace(/^\s*#.*$/gm, '')
const verifyConfig = fs
  .readFileSync(new URL('./nginx.verify.conf', import.meta.url), 'utf8')
  .replace(/^\s*#.*$/gm, '')
const routes = fs
  .readFileSync(new URL('./nginx.routes.conf', import.meta.url), 'utf8')
  .replace(/^\s*#.*$/gm, '')
const compose = fs.readFileSync(
  new URL('./docker-compose.yml', import.meta.url),
  'utf8'
)
const verifyCompose = fs.readFileSync(
  new URL('./docker-compose.verify.yml', import.meta.url),
  'utf8'
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function locationBody(modifier, path) {
  const prefix = modifier ? `${escapeRegExp(modifier)}\\s+` : ''
  const match = routes.match(
    new RegExp(`location\\s+${prefix}${escapeRegExp(path)}\\s*\\{([^{}]*)\\}`)
  )
  assert.ok(match, `missing location ${modifier} ${path}`.trim())
  return match[1]
}

test('keeps the platform root separate from public pairing routes', () => {
  assert.match(edgeConfig, /absolute_redirect\s+off;/)
  assert.match(
    edgeConfig,
    /include\s+\/etc\/nginx\/hrack\.routes\.conf;/
  )
  assert.match(
    verifyConfig,
    /include\s+\/etc\/nginx\/hrack\.routes\.conf;/
  )
  for (const [modifier, path] of [
    ['=', '/remote'],
    ['=', '/remote/'],
    ['=', '/remote/v1/system'],
    ['^~', '/remote/v1/system/'],
    ['=', '/remote/demo'],
    ['^~', '/remote/demo/'],
    ['', '/remote/']
  ]) {
    assert.match(locationBody(modifier, path), /access_log\s+off;/)
  }

  assert.match(locationBody('=', '/remote'), /return\s+307\s+\/dashboard;/)
  assert.match(locationBody('=', '/remote/'), /return\s+307\s+\/dashboard;/)

  assert.match(locationBody('=', '/remote/v1/system'), /return\s+404;/)
  assert.match(locationBody('^~', '/remote/v1/system/'), /return\s+404;/)
  assert.match(locationBody('=', '/remote/demo'), /return\s+404;/)
  assert.match(locationBody('^~', '/remote/demo/'), /return\s+404;/)

  const relay = locationBody('', '/remote/')
  assert.match(relay, /proxy_pass\s+http:\/\/relay:3000;/)
  assert.match(relay, /proxy_set_header\s+Upgrade\s+\$http_upgrade;/)
  assert.match(relay, /proxy_set_header\s+Connection\s+\$connection_upgrade;/)
})

test('preserves the complete browser authority for Next Server Actions', () => {
  for (const [modifier, path] of [
    ['', '/'],
    ['^~', '/api/auth/'],
    ['=', '/dashboard'],
    ['^~', '/dashboard/']
  ]) {
    const web = locationBody(modifier, path)
    assert.match(web, /proxy_set_header\s+Host\s+\$http_host;/)
    assert.match(web, /proxy_set_header\s+X-Forwarded-Host\s+\$http_host;/)
  }
})

test('does not apply the Web server healthcheck to the reconciler process', () => {
  const service = compose.match(
    /^  pairing-reconciler:\s*$([\s\S]*?)(?=^  [a-z][\w-]*:\s*$)/m
  )
  assert.ok(service, 'missing pairing-reconciler service')
  assert.match(service[1], /^    healthcheck:\s*\r?\n      disable: true\s*$/m)
  assert.match(
    service[1],
    /^      BETTER_AUTH_URL: \$\{PUBLIC_ORIGIN:\?set in \.env\}\s*$/m
  )
})

test('mounts one shared route policy in production and the local P4 gate', () => {
  assert.match(
    compose,
    /^      - \.\/nginx\.routes\.conf:\/etc\/nginx\/hrack\.routes\.conf:ro\s*$/m
  )
  assert.match(
    verifyCompose,
    /^      ALLOW_INSECURE_LOOPBACK: "1"\s*$/m
  )
  assert.match(
    verifyCompose,
    /127\.0\.0\.1:\$\{VERIFY_RELAY_PORT:\?set by P4 gate\}:3000/
  )
  assert.match(
    verifyCompose,
    /127\.0\.0\.1:\$\{VERIFY_EDGE_PORT:\?set by P4 gate\}:80/
  )
  assert.match(
    verifyCompose,
    /^      - \.\/nginx\.routes\.conf:\/etc\/nginx\/hrack\.routes\.conf:ro\s*$/m
  )
})
