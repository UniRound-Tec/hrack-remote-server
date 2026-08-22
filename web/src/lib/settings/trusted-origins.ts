import { emptyToUndef } from './resolve'

export function loadTrustedOrigins(): string[] {
  const values = [
    emptyToUndef(process.env.BETTER_AUTH_URL),
    ...(process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? '')
      .split(',')
      .map(emptyToUndef)
  ]
  const origins = values.flatMap((value) => {
    if (!value) return []
    try {
      return [new URL(value).origin]
    } catch {
      return []
    }
  })
  return [...new Set(origins)]
}
