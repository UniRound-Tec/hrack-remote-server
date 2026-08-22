import { adminErrorResponse, requireAdminRequest } from '@/lib/admin/http'
import { listAudit } from '@/lib/admin/audit'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(request: Request): Promise<Response> {
  try {
    await requireAdminRequest(request, false)
    const parsed = Number(new URL(request.url).searchParams.get('offset') ?? 0)
    const offset = Number.isInteger(parsed) && parsed >= 0 ? parsed : 0
    return Response.json(
      { entries: listAudit(offset), limit: 50, offset },
      { headers: { 'cache-control': 'no-store' } }
    )
  } catch (error) {
    return adminErrorResponse(error)
  }
}
