import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { AuthPanel } from '@/components/AuthPanel'
import { getAuth } from '@/lib/auth'
import { allowNext } from '@/lib/auth-navigation'

export const metadata: Metadata = {
  title: '登录 · HRack',
  robots: { index: false }
}

export const dynamic = 'force-dynamic'

type AuthSearchParams = Promise<
  Record<string, string | string[] | undefined>
>

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AuthPage({
  searchParams
}: {
  searchParams: AuthSearchParams
}) {
  const params = await searchParams
  const next = allowNext(first(params.next))
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (session) redirect(next ?? '/dashboard')

  const tab = first(params.tab)
  const error = first(params.error)
  return (
    <AuthPanel
      initialMode={tab === 'register' ? 'register' : 'login'}
      nextPath={next}
      initialError={
        error === 'email_not_verified' ||
        error === 'email_not_found' ||
        error === 'oauth'
          ? error
          : undefined
      }
    />
  )
}
