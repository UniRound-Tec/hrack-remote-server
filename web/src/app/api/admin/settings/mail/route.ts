import { adminErrorResponse, requireAdminRequest } from '@/lib/admin/http'
import {
  clearMailSettings,
  getMailSettingsView,
  saveMailSettings,
  SettingsMutationError,
  type MailSettingsInput
} from '@/lib/settings/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function errorResponse(error: unknown): Response {
  if (error instanceof SettingsMutationError) {
    return Response.json({ code: error.code }, { status: error.status })
  }
  return adminErrorResponse(error)
}

function mailInput(value: unknown): MailSettingsInput {
  if (!value || typeof value !== 'object') {
    throw new SettingsMutationError(400, 'INVALID_REQUEST')
  }
  const body = value as Record<string, unknown>
  if (
    body.emailVerificationRequired !== undefined &&
    typeof body.emailVerificationRequired !== 'boolean'
  ) {
    throw new SettingsMutationError(400, 'INVALID_REQUEST')
  }
  let smtp: MailSettingsInput['smtp']
  if (body.smtp !== undefined) {
    if (!body.smtp || typeof body.smtp !== 'object') {
      throw new SettingsMutationError(400, 'INVALID_REQUEST')
    }
    const candidate = body.smtp as Record<string, unknown>
    if (
      typeof candidate.host !== 'string' ||
      typeof candidate.port !== 'number' ||
      (candidate.security !== 'tls' &&
        candidate.security !== 'starttls' &&
        candidate.security !== 'none') ||
      (candidate.username !== undefined &&
        typeof candidate.username !== 'string') ||
      (candidate.password !== undefined &&
        typeof candidate.password !== 'string') ||
      typeof candidate.from !== 'string'
    ) {
      throw new SettingsMutationError(400, 'INVALID_REQUEST')
    }
    smtp = {
      host: candidate.host,
      port: candidate.port,
      security: candidate.security,
      username: candidate.username,
      password: candidate.password,
      from: candidate.from
    }
  }
  return {
    smtp,
    emailVerificationRequired: body.emailVerificationRequired as
      | boolean
      | undefined
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminRequest(request, false)
    return Response.json(getMailSettingsView(), {
      headers: { 'cache-control': 'no-store' }
    })
  } catch (error) {
    return errorResponse(error)
  }
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    const body = mailInput(await request.json().catch(() => undefined))
    return Response.json(await saveMailSettings(body, session.user.id))
  } catch (error) {
    return errorResponse(error)
  }
}

export async function DELETE(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    return Response.json(await clearMailSettings(session.user.id))
  } catch (error) {
    return errorResponse(error)
  }
}
