import { APIError } from 'better-auth/api'
import { eq } from 'drizzle-orm'
import { getAuth } from '@/lib/auth'
import { getDb } from '@/lib/db'
import { user } from '@/lib/db/schema'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const MOCK_EMAIL = 'mock@hrack.local'
const MOCK_PASSWORD = 'hrack-local-mock-account'

function unavailable(): Response {
  return Response.json(
    { code: 'NOT_FOUND' },
    { status: 404, headers: { 'Cache-Control': 'no-store' } }
  )
}

function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  const host =
    request.headers.get('x-forwarded-host') ?? request.headers.get('host')
  if (!origin || !host) return false

  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.NODE_ENV !== 'development') return unavailable()
  if (!isSameOrigin(request)) {
    return Response.json(
      { code: 'FORBIDDEN' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const auth = getAuth()
  try {
    await auth.api.createUser({
      body: {
        email: MOCK_EMAIL,
        password: MOCK_PASSWORD,
        name: 'HRack Root Mock',
        role: 'admin',
        data: {
          emailVerified: true,
          banned: false,
          banReason: null,
          banExpires: null
        }
      }
    })
  } catch (error) {
    if (!(error instanceof APIError) || error.statusCode !== 400) {
      return Response.json(
        { code: 'MOCK_ACCOUNT_FAILED' },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      )
    }
  }

  getDb()
    .update(user)
    .set({
      name: 'HRack Root Mock',
      role: 'admin',
      emailVerified: true,
      banned: false,
      banReason: null,
      banExpires: null
    })
    .where(eq(user.email, MOCK_EMAIL))
    .run()

  const response = await auth.api.signInEmail({
    body: { email: MOCK_EMAIL, password: MOCK_PASSWORD },
    asResponse: true
  })
  if (!response.ok || !response.headers.get('set-cookie')) {
    return Response.json(
      { code: 'MOCK_SIGN_IN_FAILED' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
  return response
}
