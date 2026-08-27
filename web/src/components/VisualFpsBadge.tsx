'use client'

import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { useVisualPerformanceProfile } from '@/lib/use-visual-performance'
import {
  getVisualFpsServerSnapshot,
  getVisualFpsSnapshot,
  subscribeVisualFps
} from '@/lib/visual-fps'

export function VisualFpsBadge() {
  const pathname = usePathname()
  const visible =
    pathname === '/' || pathname === '/auth' || pathname.startsWith('/dashboard')

  return visible ? <ActiveVisualFpsBadge /> : null
}

function ActiveVisualFpsBadge() {
  const fps = useSyncExternalStore(
    subscribeVisualFps,
    getVisualFpsSnapshot,
    getVisualFpsServerSnapshot
  )
  const profile = useVisualPerformanceProfile()

  const target = Math.max(profile.backgroundFps, profile.glassFps, 1)
  const ratio = (fps ?? target) / target
  const dotClass =
    profile.reducedMotion || fps === 0
      ? 'bg-white/35'
      : ratio >= 0.84
        ? 'bg-emerald-400 shadow-[0_0_7px_rgb(52_211_153/70%)]'
        : ratio >= 0.62
          ? 'bg-amber-400 shadow-[0_0_7px_rgb(251_191_36/65%)]'
          : 'bg-red-400 shadow-[0_0_7px_rgb(248_113_113/65%)]'

  return (
    <output
      aria-label={`Visual render rate: ${fps ?? 'measuring'} FPS`}
      title={`Visual render rate · target ${profile.reducedMotion ? 'static' : `${target} FPS`}`}
      className="pointer-events-none fixed right-3 bottom-3 z-[100] inline-flex h-7 min-w-[4.75rem] items-center justify-center gap-2 rounded-full border border-white/12 bg-black/68 px-2.5 font-maple text-[10px] tracking-[0.06em] text-white/82 shadow-[0_8px_28px_rgb(0_0_0/22%)] backdrop-blur-md sm:right-4 sm:bottom-4"
    >
      <span aria-hidden className={`size-1.5 rounded-full ${dotClass}`} />
      <span className="tabular-nums">{fps ?? '—'} FPS</span>
    </output>
  )
}
