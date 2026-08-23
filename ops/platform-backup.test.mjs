import assert from 'node:assert/strict'
import test from 'node:test'
import { projectNameFromEnv } from './platform-backup.mjs'

test('reads only a safe Compose project name from deployment env text', () => {
  assert.equal(projectNameFromEnv('# deployment\nCOMPOSE_PROJECT_NAME=hrack-prod\nSECRET=x'), 'hrack-prod')
  assert.equal(projectNameFromEnv('COMPOSE_PROJECT_NAME="hrack_restore"'), 'hrack_restore')
  assert.throws(() => projectNameFromEnv('COMPOSE_PROJECT_NAME=../production'))
  assert.throws(() => projectNameFromEnv('PUBLIC_ORIGIN=https://example.com'))
})
