import { loadAuthMethods } from '@/lib/auth-methods'

export function GET(): Response {
  return Response.json(loadAuthMethods(), {
    headers: { 'cache-control': 'no-store' }
  })
}
