import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'

const config = fs
  .readFileSync(new URL('./nginx.hrack.conf.example', import.meta.url), 'utf8')
  .replace(/^\s*#.*$/gm, '')
const compose = fs.readFileSync(
  new URL('./docker-compose.yml', import.meta.url),
  'utf8'
)

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function locationBody(modifier, path) {
  const prefix = modifier ? `${escapeRegExp(modifier)}\\s+` : ''
  const match = config.match(
    new RegExp(`location\\s+${prefix}${escapeRegExp(path)}\\s*\\{([^{}]*)\\}`)
  )
  assert.ok(match, `missing location ${modifier} ${path}`.trim())
  return match[1]
}

test('keeps the platform root separate from public pairing routes', () => {
  assert.match(config, /absolute_redirect\s+off;/)
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

test('does not apply the Web server healthcheck to the reconciler process', () => {
  const service = compose.match(
    /^  pairing-reconciler:\s*$([\s\S]*?)(?=^  [a-z][\w-]*:\s*$)/m
  )
  assert.ok(service, 'missing pairing-reconciler service')
  assert.match(service[1], /^    healthcheck:\s*\r?\n      disable: true\s*$/m)
})
