import { describe, expect, it } from 'vitest'
import {
  PAIRING_REVOKE_AAD,
  SecretboxError,
  decodeKey,
  loadSettingsKey,
  open,
  seal,
  settingsAad
} from './secretbox'

const KEY_B64 = Buffer.alloc(32, 0x11).toString('base64')
const KEY = decodeKey(KEY_B64)
const NONCE = Buffer.alloc(12, 0x22)
const PLAIN = Buffer.from('hrack-settings-v1', 'utf8')
const AAD = settingsAad('smtp.password')

// Frozen AES-256-GCM vector (AUTH-ADMIN-SPEC): key 0x11*32, nonce 0x22*12.
const VECTOR_CIPHER = Buffer.from(
  '7f85662aabe2ec3a914bb7522fd5c4a32e48897813395e4a8b92e3b12e9f94cb68',
  'hex'
)

describe('secretbox', () => {
  it('roundtrips with settings AAD', () => {
    const sealed = seal(PLAIN, AAD, KEY)
    expect(sealed.nonce.length).toBe(12)
    expect(sealed.ciphertext.length).toBeGreaterThanOrEqual(16)
    expect(open(sealed.ciphertext, sealed.nonce, AAD, KEY).equals(PLAIN)).toBe(
      true
    )
  })

  it('fails with the wrong AAD', () => {
    const sealed = seal(PLAIN, AAD, KEY, NONCE)
    expect(() =>
      open(sealed.ciphertext, sealed.nonce, settingsAad('oauth.github'), KEY)
    ).toThrow(SecretboxError)
  })

  it('pairing AAD cannot open settings ciphertext', () => {
    const sealed = seal(PLAIN, AAD, KEY, NONCE)
    expect(() =>
      open(sealed.ciphertext, sealed.nonce, PAIRING_REVOKE_AAD, KEY)
    ).toThrow(SecretboxError)
  })

  it('matches the frozen test vector', () => {
    const sealed = seal(PLAIN, AAD, KEY, NONCE)
    expect(sealed.nonce.equals(NONCE)).toBe(true)
    expect(sealed.ciphertext.equals(VECTOR_CIPHER)).toBe(true)
    expect(open(VECTOR_CIPHER, NONCE, AAD, KEY).equals(PLAIN)).toBe(true)
  })

  it('decodeKey rejects the wrong length', () => {
    expect(() => decodeKey(Buffer.alloc(16).toString('base64'))).toThrow(
      SecretboxError
    )
  })

  it('loadSettingsKey prefers SETTINGS_ENC_KEY and treats empty as unset', () => {
    const prevS = process.env.SETTINGS_ENC_KEY
    const prevP = process.env.PAIRING_ENC_KEY
    try {
      process.env.SETTINGS_ENC_KEY = ''
      process.env.PAIRING_ENC_KEY = KEY_B64
      expect(loadSettingsKey().equals(KEY)).toBe(true)
      process.env.SETTINGS_ENC_KEY = KEY_B64
      process.env.PAIRING_ENC_KEY = Buffer.alloc(32, 9).toString('base64')
      expect(loadSettingsKey().equals(KEY)).toBe(true)
    } finally {
      process.env.SETTINGS_ENC_KEY = prevS
      process.env.PAIRING_ENC_KEY = prevP
    }
  })
})
