import { adminErrorResponse, requireAdminRequest } from '@/lib/admin/http'
import {
  AdminUserError,
  listUsers,
  mutateUser,
  type UserAction
} from '@/lib/admin/mutate'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown): Response {
  if (error instanceof AdminUserError) {
    return Response.json({ code: error.code }, { status: error.status })
  }
  return adminErrorResponse(error)
}

function action(value: unknown): UserAction {
  if (!value || typeof value !== 'object') {
    throw new AdminUserError(400, 'INVALID_REQUEST')
  }
  const body = value as Record<string, unknown>
  if (typeof body.userId !== 'string') {
    throw new AdminUserError(400, 'INVALID_REQUEST')
  }
  if (
    body.action === 'ban' ||
    body.action === 'unban' ||
    body.action === 'verify' ||
    body.action === 'resetPassword' ||
    body.action === 'revokeSessions'
  ) {
    return { action: body.action, userId: body.userId }
  }
  if (
    body.action === 'role' &&
    (body.role === 'user' || body.role === 'admin')
  ) {
    return { action: body.action, userId: body.userId, role: body.role }
  }
  if (body.action === 'delete' && typeof body.confirmEmail === 'string') {
    return {
      action: body.action,
      userId: body.userId,
      confirmEmail: body.confirmEmail
    }
  }
  throw new AdminUserError(400, 'INVALID_REQUEST')
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminRequest(request, false)
    const url = new URL(request.url)
    const search = (url.searchParams.get('search') ?? '').trim().slice(0, 200)
    const parsedOffset = Number(url.searchParams.get('offset') ?? 0)
    const offset =
      Number.isInteger(parsedOffset) && parsedOffset >= 0 ? parsedOffset : 0
    return Response.json(await listUsers(request.headers, search, offset), {
      headers: { 'cache-control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    const input = action(await request.json().catch(() => undefined))
    return Response.json(
      await mutateUser(input, session.user.id, request.headers),
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (error) {
    return errorResponse(error)
  }
}
