import { getAuth } from '@/lib/auth'
import { satisfiesVerificationPolicy } from '@/lib/auth-access'
import { loadRuntimeConfig } from '@/lib/settings/resolve'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

export const dynamic = 'force-dynamic'

export default async function DashboardLayout({
  children
}: {
  children: ReactNode
}) {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) redirect('/auth?next=/dashboard')
  if (
    !satisfiesVerificationPolicy(
      session.user,
      loadRuntimeConfig().emailVerificationRequired
    )
  ) {
    redirect('/auth?tab=login&error=email_not_verified')
  }
  return children
}
