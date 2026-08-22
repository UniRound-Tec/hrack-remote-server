'use client'

import { usePathname } from 'next/navigation'
import { TerminalBackdrop } from './TerminalBackdrop'

export function RouteBackdrop() {
  const pathname = usePathname()
  return pathname === '/' || pathname === '/auth' ? <TerminalBackdrop /> : null
}
