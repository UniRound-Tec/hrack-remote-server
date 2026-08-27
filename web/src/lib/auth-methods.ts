import { loadRuntimeConfig } from './settings/resolve'

export type AuthMethods = {
  github: boolean
  google: boolean
  'linux-do': boolean
  emailVerificationRequired: boolean
}

export function loadAuthMethods(): AuthMethods {
  const runtime = loadRuntimeConfig()
  return {
    github: Boolean(runtime.github),
    google: Boolean(runtime.google),
    'linux-do': Boolean(runtime['linux-do']),
    emailVerificationRequired: runtime.emailVerificationRequired
  }
}
