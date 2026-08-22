import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { proxy } from './proxy'

function request(pathname: string, cookie?: string): NextRequest {
  return new NextRequest(`https://hrack.example${pathname}`, {
    headers: cookie ? { cookie } : undefined
  })
}

describe('protected route proxy', () => {
  it.each(['/admin/setup', '/admin/setup/'])(
    'allows anonymous setup at %s',
    (path) => {
      const response = proxy(request(path))
      expect(response.headers.get('x-middleware-next')).toBe('1')
    }
  )

  it.each(['/admin', '/admin/users', '/dashboard', '/dashboard/pair'])(
    'redirects anonymous requests for %s to auth',
    (path) => {
      const response = proxy(request(path))
      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe(
        `https://hrack.example/auth?next=${encodeURIComponent(path)}`
      )
    }
  )

  it('optimistically allows an admin request with a session cookie', () => {
    const response = proxy(
      request(
        '/admin',
        'better-auth.session_token=untrusted-proxy-presence-only'
      )
    )
    expect(response.headers.get('x-middleware-next')).toBe('1')
  })
})
