import { adminErrorResponse, requireAdminRequest } from '@/lib/admin/http'
import { sendMailTest, SettingsMutationError } from '@/lib/settings/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function POST(request: Request): Promise<Response> {
  try {
    const session = await requireAdminRequest(request)
    await sendMailTest(session.user.email)
    return Response.json({ ok: true })
  } catch (error) {
    if (error instanceof SettingsMutationError) {
      return Response.json({ code: error.code }, { status: error.status })
    }
    return adminErrorResponse(error)
  }
}
