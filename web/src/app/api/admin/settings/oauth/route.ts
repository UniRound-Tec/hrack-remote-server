import { adminErrorResponse, requireAdminRequest } from '@/lib/admin/http'
import {
  clearOAuthSettings,
  getOAuthSettingsView,
  saveOAuthSettings,
  SettingsMutationError,
  type OAuthProviderId,
  type OAuthSettingsInput
} from '@/lib/settings/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown): Response {
  if (error instanceof SettingsMutationError) {
    return Response.json({ code: error.code }, { status: error.status })
  }
  return adminErrorResponse(error)
}

function provider(value: unknown): OAuthProviderId | undefined {
  return value === 'github' || value === 'google' || value === 'linux-do'
    ? value
    : undefined
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminRequest(request, false)
    return Response.json(getOAuthSettingsView(), {
      headers: { 'cache-control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    const body = (await request.json().catch(() => undefined)) as
      | OAuthSettingsInput
      | undefined
    if (
      !body ||
      (body.clientId !== undefined && typeof body.clientId !== 'string') ||
      (body.clientSecret !== undefined &&
        typeof body.clientSecret !== 'string')
    ) {
      throw new SettingsMutationError(400, 'INVALID_REQUEST')
    }
    const id = provider(body.provider)
    if (!id || typeof body.enabled !== 'boolean') {
      throw new SettingsMutationError(400, 'INVALID_REQUEST')
    }
    return Response.json(
      await saveOAuthSettings({ ...body, provider: id }, session.user.id)
    )
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    const body = (await request.json().catch(() => undefined)) as
      | { provider?: unknown }
      | undefined
    const id = provider(body?.provider)
    if (!id) throw new SettingsMutationError(400, 'INVALID_REQUEST')
    return Response.json(await clearOAuthSettings(id, session.user.id))
  } catch (error) {
    return errorResponse(error)
  }
}
