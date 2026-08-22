import { nextCookies } from 'better-auth/next-js'
import { warnIfAdminRecoveryUnavailable } from './admin/recovery-warning'
import { createAuth } from './auth-options'

let current: ReturnType<typeof createAuth> | undefined
let reloadChain: Promise<void> = Promise.resolve()

export function getAuth(): ReturnType<typeof createAuth> {
  if (!current) {
    current = createAuth(undefined, [nextCookies()])
    void warnIfAdminRecoveryUnavailable().catch(() => {
      console.error(
        JSON.stringify({
          event: 'admin.recovery_check_failed',
          level: 'error'
        })
      )
    })
  }
  return current
}

export function reloadAuth(): Promise<void> {
  reloadChain = reloadChain
    .catch(() => undefined)
    .then(() => {
      current = createAuth(undefined, [nextCookies()])
    })
  return reloadChain
}
