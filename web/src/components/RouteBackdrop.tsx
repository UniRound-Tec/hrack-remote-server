'use client'

import { usePathname } from 'next/navigation'
import { LandingBeams } from './LandingBeams'

export function RouteBackdrop() {
  const pathname = usePathname()
  const visible = pathname === '/auth' || pathname.startsWith('/dashboard')
  return visible ? (
    <div className="route-landing-backdrop">
      <LandingBeams />
    </div>
  ) : null
}
