import { countActiveAdmins } from './last-admin'
import { hasConfiguredSetupToken } from './setup-token'

let checked = false

export async function warnIfAdminRecoveryUnavailable(): Promise<void> {
  if (checked) return
  checked = true
  if ((await countActiveAdmins()) > 0 || hasConfiguredSetupToken()) return
  console.error(
    JSON.stringify({
      event: 'admin.recovery_unavailable',
      level: 'error',
      outcome:
        'configure ADMIN_SETUP_TOKEN for /admin/setup or use web-tools create-admin'
    })
  )
}
