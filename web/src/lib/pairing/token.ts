import { decodeKey, open, PAIRING_REVOKE_AAD, seal } from '../crypto/secretbox'

const PREFIX = 'v1'

export class PairingTokenFormatError extends Error {
  override readonly name = 'PairingTokenFormatError'
}

function key(): Buffer {
  const value = process.env.PAIRING_ENC_KEY
  if (!value) throw new Error('PAIRING_ENC_KEY is required')
  return decodeKey(value)
}

export function sealPairingRevokeToken(token: string): string {
  const encrypted = seal(
    Buffer.from(token, 'utf8'),
    PAIRING_REVOKE_AAD,
    key()
  )
  return [
    PREFIX,
    encrypted.nonce.toString('base64url'),
    encrypted.ciphertext.toString('base64url')
  ].join('.')
}

export function openPairingRevokeToken(value: string): string {
  const [version, nonce, ciphertext, extra] = value.split('.')
  if (version !== PREFIX || !nonce || !ciphertext || extra !== undefined) {
    throw new PairingTokenFormatError('Unsupported pairing token format')
  }
  return open(
    Buffer.from(ciphertext, 'base64url'),
    Buffer.from(nonce, 'base64url'),
    PAIRING_REVOKE_AAD,
    key()
  ).toString('utf8')
}
