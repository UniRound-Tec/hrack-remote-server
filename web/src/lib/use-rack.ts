'use client'

import { useEffect, useState } from 'react'
import {
  RACK_FROZEN_AT,
  rackStateAt,
  type RackRuntimeState
} from './rack-script'

/**
 * Rack 实时快照：绝对时间驱动（见 rack-script.ts）。
 * SSR 与首次客户端渲染都从 RACK_FROZEN_AT 出发 —— 确定性一致；
 * 挂载后时钟从同一时刻继续走，reduced-motion 下永久停在该帧。
 */
export function useRack(): RackRuntimeState[] {
  const [t, setT] = useState(RACK_FROZEN_AT)
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(query.matches)
    const listener = (event: MediaQueryListEvent): void =>
      setReduced(event.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (reduced) return
    const start = performance.now() - RACK_FROZEN_AT
    const id = window.setInterval(() => {
      setT(performance.now() - start)
    }, 250)
    return () => window.clearInterval(id)
  }, [reduced])

  return rackStateAt(t)
}
