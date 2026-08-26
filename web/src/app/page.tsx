import { LandingHero } from '@/components/LandingHero'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'HRack — The modern terminal for coding agents',
  description:
    'Run multiple coding agents in parallel, follow their progress, and manage every task from one focused workspace.'
}

export default function LandingPage() {
  return (
    <main id="main" className="min-h-[100svh] bg-black">
      <LandingHero />
    </main>
  )
}
