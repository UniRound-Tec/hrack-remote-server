import { requireAdmin } from './guard'
import { loadTrustedOrigins } from '../settings/trusted-origins'
import { reserveAdminWrite } from './write-limit'

export class AdminHttpError extends Error {
  constructor(
    readonly status: 401 | 403 | 429,
    readonly code: string
  ) {
    super(code)
    this.name = 'AdminHttpError'
  }
}

function requestOrigin(request: Request): string | undefined {
  const raw = request.headers.get('origin') ?? request.headers.get('referer')
  if (!raw) return undefined
  try {
    return new URL(raw).origin
  } catch {
    return undefined
  }
}

export async function requireAdminRequest(
  request: Request,
  write = request.method !== 'GET' && request.method !== 'HEAD'
) {
  let session
  try {
    session = await requireAdmin(request.headers)
  } catch (error) {
    const status =
      typeof error === 'object' && error && 'status' in error
        ? Number(error.status)
        : 401
    throw new AdminHttpError(status === 403 ? 403 : 401, 'UNAUTHORIZED')
  }
  if (write) {
    const origin = requestOrigin(request)
    if (!origin || !loadTrustedOrigins().includes(origin)) {
      throw new AdminHttpError(403, 'INVALID_ORIGIN')
    }
    if (!reserveAdminWrite(session.session.id)) {
      throw new AdminHttpError(429, 'RATE_LIMITED')
    }
  }
  return session
}

export function adminErrorResponse(error: unknown): Response {
  if (error instanceof AdminHttpError) {
    return Response.json({ code: error.code }, { status: error.status })
  }
  return Response.json({ code: 'INTERNAL_ERROR' }, { status: 500 })
}
