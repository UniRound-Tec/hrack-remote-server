import type { GenericOAuthUserInfo } from 'better-auth/plugins'

export const LINUX_DO_PROVIDER_ID = 'linux-do' as const
export const LINUX_DO_ACCOUNT_ISSUER = 'https://connect.linux.do'
export const LINUX_DO_AUTHORIZATION_URL =
  'https://connect.linux.do/oauth2/authorize'
export const LINUX_DO_TOKEN_URL = 'https://connect.linux.do/oauth2/token'
export const LINUX_DO_USER_INFO_URL = 'https://connect.linux.do/api/user'

function text(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

export function linuxDoAccountSubject(profile: GenericOAuthUserInfo): string {
  const id =
    typeof profile.id === 'number' && Number.isSafeInteger(profile.id)
      ? String(profile.id)
      : text(profile.id)
  if (!id || !/^\d+$/.test(id)) {
    throw new Error('Linux.do profile is missing a stable numeric id')
  }
  return id
}

function linuxDoAvatar(value: unknown): string | undefined {
  const raw = text(value)?.replace('{size}', '288')
  if (!raw) return undefined
  try {
    const url = new URL(raw.startsWith('//') ? `https:${raw}` : raw)
    return url.protocol === 'https:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}

export function mapLinuxDoProfile(profile: GenericOAuthUserInfo) {
  let subject: string | undefined
  try {
    subject = linuxDoAccountSubject(profile)
  } catch {
    // The callback's account-subject validation will reject malformed profiles.
  }

  return {
    email: subject ? `linuxdo-${subject}@oauth.invalid` : null,
    emailVerified: false,
    name:
      text(profile.name) ??
      text(profile.username) ??
      (subject ? `Linux.do ${subject}` : 'Linux.do user'),
    image: linuxDoAvatar(profile.avatar_template)
  }
}
