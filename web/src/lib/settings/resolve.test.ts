import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { closeDb } from '../db'
import {
  emptyToUndef,
  loadRuntimeConfig,
  readEmailVerificationRequired
} from './resolve'

let dataDir: string

beforeEach(() => {
  closeDb()
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'hrack-settings-resolve-'))
  vi.stubEnv('HRACK_WEB_DATA', dataDir)
})

afterEach(() => {
  closeDb()
  vi.unstubAllEnvs()
  fs.rmSync(dataDir, { recursive: true, force: true })
})

describe('runtime auth config', () => {
  it('treats compose empty strings as unset', () => {
    expect(emptyToUndef(undefined)).toBeUndefined()
    expect(emptyToUndef('')).toBeUndefined()
    expect(emptyToUndef('   ')).toBeUndefined()
    expect(emptyToUndef(' value ')).toBe('value')
  })

  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['0', false],
    ['true', true],
    ['1', true]
  ])('parses EMAIL_VERIFICATION_REQUIRED=%s', (input, expected) => {
    expect(readEmailVerificationRequired(input)).toBe(expected)
  })

  it('requires both OAuth env values', () => {
    vi.stubEnv('GITHUB_CLIENT_ID', 'id')
    vi.stubEnv('GITHUB_CLIENT_SECRET', '')
    vi.stubEnv('GOOGLE_CLIENT_ID', 'google-id')
    vi.stubEnv('GOOGLE_CLIENT_SECRET', 'google-secret')
    vi.stubEnv('LINUX_DO_CLIENT_ID', 'linux-do-id')
    vi.stubEnv('LINUX_DO_CLIENT_SECRET', 'linux-do-secret')
    const config = loadRuntimeConfig()
    expect(config.github).toBeUndefined()
    expect(config.google).toEqual({
      clientId: 'google-id',
      clientSecret: 'google-secret'
    })
    expect(config['linux-do']).toEqual({
      clientId: 'linux-do-id',
      clientSecret: 'linux-do-secret'
    })
    expect(config.emailVerificationRequired).toBe(false)
  })
})
