import { PairingDashboard } from '@/components/dashboard/PairingDashboard'
import { getAuth } from '@/lib/auth'
import { getUserPairing } from '@/lib/pairing/lifecycle'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export const metadata: Metadata = {
  title: 'Remote · HRack',
  robots: { index: false }
}

export default async function DashboardPage() {
  const session = await getAuth().api.getSession({ headers: await headers() })
  if (!session) redirect('/auth?next=/dashboard')

  const pairing = await getUserPairing(session.user.id)
  return (
    <PairingDashboard
      initialPairing={pairing}
      email={session.user.email}
      isAdmin={session.user.role === 'admin'}
    />
  )
}
