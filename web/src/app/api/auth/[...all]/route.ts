import { getAuth } from '@/lib/auth'

function handle(request: Request): Promise<Response> {
  return getAuth().handler(request)
}

export const GET = handle
export const POST = handle
export const PATCH = handle
export const PUT = handle
export const DELETE = handle
