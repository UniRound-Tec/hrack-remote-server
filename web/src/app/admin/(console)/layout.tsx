import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import type { ReactNode } from 'react'
import { AdminShell } from '@/components/admin/AdminShell'
import { AdminGuardError, requireAdmin } from '@/lib/admin/guard'

export const metadata: Metadata = {
  title: 'Operator · HRack',
  robots: { index: false }
}

export const dynamic = 'force-dynamic'

export default async function AdminConsoleLayout({
  children
}: {
  children: ReactNode
}) {
  let session
  try {
    session = await requireAdmin(await headers())
  } catch (error) {
    if (error instanceof AdminGuardError && error.status === 401) {
      redirect('/auth?next=/admin')
    }
    notFound()
  }
  return <AdminShell email={session.user.email}>{children}</AdminShell>
}
