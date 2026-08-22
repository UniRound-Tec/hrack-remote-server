import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'

const SETUP = '/admin/setup'

function withNext(request: NextRequest, pathname: string): NextResponse {
  const url = new URL('/auth', request.url)
  url.searchParams.set('next', pathname)
  return NextResponse.redirect(url)
}

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl
  if (pathname === SETUP || pathname.startsWith(`${SETUP}/`)) {
    return NextResponse.next()
  }

  const needsAuth =
    pathname === '/dashboard' ||
    pathname.startsWith('/dashboard/') ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/')
  if (needsAuth && !getSessionCookie(request)) {
    return withNext(request, pathname)
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/admin', '/admin/:path*']
}
