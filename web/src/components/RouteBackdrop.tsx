'use client'

import { usePathname } from 'next/navigation'
import { LandingBeams } from './LandingBeams'

export function RouteBackdrop() {
  const pathname = usePathname()
  return pathname === '/auth' ? (
    <div className="route-landing-backdrop">
      <LandingBeams />
    </div>
  ) : null
}
