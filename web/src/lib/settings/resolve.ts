export type OAuthRuntimeConfig = {
  clientId: string
  clientSecret: string
}

export type RuntimeAuthConfig = {
  emailVerificationRequired: boolean
  github?: OAuthRuntimeConfig
  google?: OAuthRuntimeConfig
}

export function emptyToUndef(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function envPair(
  id: string | undefined,
  secret: string | undefined
): OAuthRuntimeConfig | undefined {
  const clientId = emptyToUndef(id)
  const clientSecret = emptyToUndef(secret)
  return clientId && clientSecret ? { clientId, clientSecret } : undefined
}

export function readEmailVerificationRequired(
  value = process.env.EMAIL_VERIFICATION_REQUIRED
): boolean {
  const raw = emptyToUndef(value)?.toLowerCase()
  if (raw === undefined) return false
  if (raw === 'true' || raw === '1') return true
  if (raw === 'false' || raw === '0') return false
  throw new Error('EMAIL_VERIFICATION_REQUIRED must be true, false, 1, or 0')
}

/** PR2 reads the env overlay. PR5 extends this resolver with encrypted DB values. */
export function loadRuntimeConfig(): RuntimeAuthConfig {
  return {
    emailVerificationRequired: readEmailVerificationRequired(),
    github: envPair(
      process.env.GITHUB_CLIENT_ID,
      process.env.GITHUB_CLIENT_SECRET
    ),
    google: envPair(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    )
  }
}
