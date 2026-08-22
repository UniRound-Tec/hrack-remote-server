import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { SetupForm } from '@/components/admin/SetupForm'
import { countActiveAdmins } from '@/lib/admin/last-admin'
import { hasConfiguredSetupToken } from '@/lib/admin/setup-token'

export const metadata: Metadata = {
  title: 'Operator setup · HRack',
  robots: { index: false }
}

export const dynamic = 'force-dynamic'

export default async function AdminSetupPage() {
  if (!hasConfiguredSetupToken() || (await countActiveAdmins()) > 0) {
    notFound()
  }
  return <SetupForm />
}
