'use client'

import { useEffect, useState } from 'react'

export type VisualPerformanceProfile = {
  backgroundDpr: number
  backgroundFps: number
  constrained: boolean
  fboScale: number
  glassDpr: number
  glassFps: number
  glassHoverFps: number
  reducedMotion: boolean
  transmissionSamples: number
}

type VisualCapabilities = {
  deviceMemory?: number
  devicePixelRatio: number
  hardwareConcurrency?: number
  pixelCount: number
  reducedMotion: boolean
  saveData?: boolean
}

const BALANCED_PROFILE: VisualPerformanceProfile = {
  backgroundDpr: 1,
  backgroundFps: 30,
  constrained: false,
  fboScale: 0.75,
  glassDpr: 1.25,
  glassFps: 30,
  glassHoverFps: 40,
  reducedMotion: false,
  transmissionSamples: 4
}

export function selectVisualPerformanceProfile(
  capabilities: VisualCapabilities
): VisualPerformanceProfile {
  const constrained = Boolean(
    capabilities.saveData ||
      (capabilities.hardwareConcurrency !== undefined &&
        capabilities.hardwareConcurrency <= 4) ||
      (capabilities.deviceMemory !== undefined &&
        capabilities.deviceMemory <= 4) ||
      capabilities.pixelCount * capabilities.devicePixelRatio ** 2 >= 5_000_000
  )

  if (capabilities.reducedMotion) {
    return {
      backgroundDpr: 0.75,
      backgroundFps: 0,
      constrained: true,
      fboScale: 0.5,
      glassDpr: 1,
      glassFps: 0,
      glassHoverFps: 0,
      reducedMotion: true,
      transmissionSamples: 2
    }
  }

  return constrained
    ? {
        backgroundDpr: 0.75,
        backgroundFps: 24,
        constrained: true,
        fboScale: 0.55,
        glassDpr: 1,
        glassFps: 24,
        glassHoverFps: 30,
        reducedMotion: false,
        transmissionSamples: 3
      }
    : BALANCED_PROFILE
}

function readCapabilities(reducedMotion: boolean): VisualCapabilities {
  const connection = (
    navigator as Navigator & { connection?: { saveData?: boolean } }
  ).connection
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number })
    .deviceMemory

  return {
    deviceMemory,
    devicePixelRatio: window.devicePixelRatio || 1,
    hardwareConcurrency: navigator.hardwareConcurrency,
    pixelCount: window.screen.width * window.screen.height,
    reducedMotion,
    saveData: connection?.saveData
  }
}

export function useVisualPerformanceProfile(): VisualPerformanceProfile {
  const [profile, setProfile] = useState(BALANCED_PROFILE)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const update = () =>
      setProfile(selectVisualPerformanceProfile(readCapabilities(media.matches)))
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return profile
}
