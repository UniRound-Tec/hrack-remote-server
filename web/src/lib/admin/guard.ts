import { getAuth } from '../auth'
import { loadRuntimeConfig } from '../settings/resolve'

export class AdminGuardError extends Error {
  constructor(readonly status: 401 | 403) {
    super(status === 401 ? 'Authentication required' : 'Admin access required')
    this.name = 'AdminGuardError'
  }
}

export function hasAdminRole(role: string | null | undefined): boolean {
  return (
    role
      ?.split(',')
      .map((value) => value.trim())
      .includes('admin') ?? false
  )
}

export async function requireUser(requestHeaders: Headers) {
  const session = await getAuth().api.getSession({ headers: requestHeaders })
  if (!session || session.user.banned) throw new AdminGuardError(401)
  return session
}

export async function requireAdmin(requestHeaders: Headers) {
  const session = await requireUser(requestHeaders)
  if (
    !hasAdminRole(session.user.role) ||
    (loadRuntimeConfig().emailVerificationRequired &&
      !session.user.emailVerified)
  ) {
    throw new AdminGuardError(403)
  }
  return session
}
