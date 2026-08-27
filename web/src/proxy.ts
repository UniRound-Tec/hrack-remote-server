import { getSessionCookie } from 'better-auth/cookies'
import { type NextRequest, NextResponse } from 'next/server'
import { publicRelayNodes } from '@/lib/pairing/nodes'
import { contentSecurityPolicy } from '@/lib/security/csp'

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
  const response = NextResponse.next()
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) {
    const relayOrigins = publicRelayNodes().map(
      (node) => new URL(node.healthUrl).origin
    )
    response.headers.set(
      'Content-Security-Policy',
      contentSecurityPolicy({
        isDevelopment: process.env.NODE_ENV === 'development',
        connectSources: relayOrigins
      })
    )
  }
  return response
}

export const config = {
  matcher: ['/dashboard', '/dashboard/:path*', '/admin', '/admin/:path*']
}
