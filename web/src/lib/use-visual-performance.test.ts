import { describe, expect, it } from 'vitest'
import { selectVisualPerformanceProfile } from './use-visual-performance'

describe('visual performance profile', () => {
  it('caps normal rendering below display refresh rate', () => {
    const profile = selectVisualPerformanceProfile({
      deviceMemory: 16,
      devicePixelRatio: 1,
      hardwareConcurrency: 12,
      pixelCount: 1920 * 1080,
      reducedMotion: false
    })
    expect(profile).toMatchObject({
      backgroundDpr: 1,
      backgroundFps: 30,
      constrained: false,
      glassFps: 30,
      transmissionSamples: 4
    })
  })

  it('reduces resolution and render cadence on constrained devices', () => {
    const profile = selectVisualPerformanceProfile({
      deviceMemory: 4,
      devicePixelRatio: 2,
      hardwareConcurrency: 4,
      pixelCount: 1440 * 900,
      reducedMotion: false
    })
    expect(profile).toMatchObject({
      backgroundDpr: 0.75,
      backgroundFps: 24,
      constrained: true,
      fboScale: 0.55,
      glassDpr: 1,
      transmissionSamples: 3
    })
  })

  it('renders a static frame when reduced motion is requested', () => {
    const profile = selectVisualPerformanceProfile({
      devicePixelRatio: 1,
      pixelCount: 1920 * 1080,
      reducedMotion: true
    })
    expect(profile.backgroundFps).toBe(0)
    expect(profile.glassFps).toBe(0)
    expect(profile.reducedMotion).toBe(true)
  })
})
