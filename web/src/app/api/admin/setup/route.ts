import { AdminSetupError, createFirstAdmin } from '@/lib/admin/bootstrap'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type SetupBody = {
  token?: unknown
  email?: unknown
  password?: unknown
}

export async function POST(request: Request): Promise<Response> {
  let body: SetupBody
  try {
    body = (await request.json()) as SetupBody
  } catch {
    return Response.json({ code: 'INVALID_REQUEST' }, { status: 400 })
  }
  if (
    typeof body.token !== 'string' ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string'
  ) {
    return Response.json({ code: 'INVALID_REQUEST' }, { status: 400 })
  }

  try {
    return await createFirstAdmin({
      token: body.token,
      email: body.email,
      password: body.password
    })
  } catch (error) {
    if (error instanceof AdminSetupError) {
      return Response.json({ code: error.code }, { status: error.status })
    }
    return Response.json({ code: 'SETUP_FAILED' }, { status: 500 })
  }
}
