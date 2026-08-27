import { readSetting } from './store'
import type { SettingsSource, StoredOAuthProvider } from './types'

export type OAuthRuntimeConfig = {
  clientId: string
  clientSecret: string
}

export type RuntimeAuthConfig = {
  emailVerificationRequired: boolean
  github?: OAuthRuntimeConfig
  google?: OAuthRuntimeConfig
  'linux-do'?: OAuthRuntimeConfig
}

export function emptyToUndef(value: string | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function envPair(
  id: string | undefined,
  secret: string | undefined,
  stored?: StoredOAuthProvider
): OAuthRuntimeConfig | undefined {
  const clientId = emptyToUndef(id) ?? stored?.clientId
  const clientSecret = emptyToUndef(secret) ?? stored?.clientSecret
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

export function verificationSetting(): {
  value: boolean
  source: SettingsSource
  pinned: boolean
} {
  if (emptyToUndef(process.env.EMAIL_VERIFICATION_REQUIRED) !== undefined) {
    return {
      value: readEmailVerificationRequired(),
      source: 'env',
      pinned: true
    }
  }
  const stored = readSetting('emailVerificationRequired')
  return stored === undefined
    ? { value: false, source: 'default', pinned: false }
    : { value: stored, source: 'db', pinned: false }
}

export function loadRuntimeConfig(): RuntimeAuthConfig {
  const githubEnvId = emptyToUndef(process.env.GITHUB_CLIENT_ID)
  const githubEnvSecret = emptyToUndef(process.env.GITHUB_CLIENT_SECRET)
  const googleEnvId = emptyToUndef(process.env.GOOGLE_CLIENT_ID)
  const googleEnvSecret = emptyToUndef(process.env.GOOGLE_CLIENT_SECRET)
  const linuxDoEnvId = emptyToUndef(process.env.LINUX_DO_CLIENT_ID)
  const linuxDoEnvSecret = emptyToUndef(process.env.LINUX_DO_CLIENT_SECRET)
  return {
    emailVerificationRequired: verificationSetting().value,
    github: envPair(
      githubEnvId,
      githubEnvSecret,
      githubEnvId && githubEnvSecret ? undefined : readSetting('github')
    ),
    google: envPair(
      googleEnvId,
      googleEnvSecret,
      googleEnvId && googleEnvSecret ? undefined : readSetting('google')
    ),
    'linux-do': envPair(
      linuxDoEnvId,
      linuxDoEnvSecret,
      linuxDoEnvId && linuxDoEnvSecret
        ? undefined
        : readSetting('linux-do')
    )
  }
}
