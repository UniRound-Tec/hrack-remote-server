import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALG = 'aes-256-gcm' as const
const NONCE_BYTES = 12
const TAG_BYTES = 16
const KEY_BYTES = 32

export const SETTINGS_AAD_PREFIX = 'hrack:v1:settings:'
export const PAIRING_REVOKE_AAD = 'hrack:v1:pairing:revoke'

export class SecretboxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SecretboxError'
  }
}

export function settingsAad(settingKey: string): string {
  return `${SETTINGS_AAD_PREFIX}${settingKey}`
}

/** Decode a 32-byte key from standard base64. */
export function decodeKey(b64: string): Buffer {
  const key = Buffer.from(b64, 'base64')
  if (key.length !== KEY_BYTES) {
    throw new SecretboxError('encryption key must decode to 32 bytes')
  }
  return key
}

/**
 * SETTINGS_ENC_KEY if set, otherwise PAIRING_ENC_KEY.
 * Empty string is treated as unset (compose overlay).
 */
export function loadSettingsKey(): Buffer {
  const raw =
    emptyToUndef(process.env.SETTINGS_ENC_KEY) ??
    emptyToUndef(process.env.PAIRING_ENC_KEY)
  if (!raw) {
    throw new SecretboxError('SETTINGS_ENC_KEY or PAIRING_ENC_KEY is required')
  }
  return decodeKey(raw)
}

export type Sealed = {
  nonce: Buffer
  ciphertext: Buffer
}

export function seal(
  plaintext: Uint8Array,
  aad: string,
  key: Uint8Array,
  nonce: Uint8Array = randomBytes(NONCE_BYTES)
): Sealed {
  if (nonce.length !== NONCE_BYTES) {
    throw new SecretboxError('nonce must be 12 bytes')
  }
  if (key.length !== KEY_BYTES) {
    throw new SecretboxError('key must be 32 bytes')
  }
  const cipher = createCipheriv(ALG, key, nonce)
  cipher.setAAD(Buffer.from(aad, 'utf8'))
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    nonce: Buffer.from(nonce),
    ciphertext: Buffer.concat([encrypted, tag])
  }
}

export function open(
  ciphertext: Uint8Array,
  nonce: Uint8Array,
  aad: string,
  key: Uint8Array
): Buffer {
  if (nonce.length !== NONCE_BYTES) {
    throw new SecretboxError('nonce must be 12 bytes')
  }
  if (key.length !== KEY_BYTES) {
    throw new SecretboxError('key must be 32 bytes')
  }
  if (ciphertext.length < TAG_BYTES) {
    throw new SecretboxError('ciphertext too short')
  }
  const data = ciphertext.subarray(0, ciphertext.length - TAG_BYTES)
  const tag = ciphertext.subarray(ciphertext.length - TAG_BYTES)
  const decipher = createDecipheriv(ALG, key, nonce)
  decipher.setAAD(Buffer.from(aad, 'utf8'))
  decipher.setAuthTag(tag)
  try {
    return Buffer.concat([decipher.update(data), decipher.final()])
  } catch {
    throw new SecretboxError('decryption failed')
  }
}

function emptyToUndef(value: string | undefined): string | undefined {
  if (value === undefined || value === '') return undefined
  return value
}
