export type VisualFrameSource = 'background' | 'glass'

const frameCounts: Record<VisualFrameSource, number> = {
  background: 0,
  glass: 0
}
const listeners = new Set<() => void>()
let snapshot: number | null = null
let lastSample = 0
let timer: number | null = null

function sample(): void {
  const now = performance.now()
  const elapsed = Math.max(now - lastSample, 1)
  const next = Math.round(
    (Math.max(frameCounts.background, frameCounts.glass) * 1000) / elapsed
  )
  frameCounts.background = 0
  frameCounts.glass = 0
  lastSample = now

  if (next === snapshot) return
  snapshot = next
  listeners.forEach(listener => listener())
}

function start(): void {
  if (timer || typeof window === 'undefined') return
  frameCounts.background = 0
  frameCounts.glass = 0
  lastSample = performance.now()
  timer = window.setInterval(sample, 1000)
}

function stop(): void {
  if (!timer) return
  clearInterval(timer)
  timer = null
  snapshot = null
}

export function markVisualFrame(source: VisualFrameSource): void {
  if (listeners.size > 0) frameCounts[source] += 1
}

export function subscribeVisualFps(listener: () => void): () => void {
  listeners.add(listener)
  start()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) stop()
  }
}

export function getVisualFpsSnapshot(): number | null {
  return snapshot
}

export function getVisualFpsServerSnapshot(): null {
  return null
}
