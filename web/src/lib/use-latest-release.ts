'use client'

import { useEffect, useState } from 'react'
import { detectPlatform, type DetectedPlatform, type PlatformId } from './platform'
import { RELEASES_PAGE, type LatestRelease } from './releases'

let inflight: Promise<LatestRelease | null> | null = null

function loadLatest(): Promise<LatestRelease | null> {
  if (!inflight) {
    inflight = fetch('/api/latest-release')
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null)
  }
  return inflight
}

export function useLatestRelease(): LatestRelease | null {
  const [release, setRelease] = useState<LatestRelease | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadLatest().then((data) => {
      if (!cancelled && data) setRelease(data)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return release
}

export function useDownloadTarget(): {
  platform: DetectedPlatform | null
  href: string
  urlFor: (id: PlatformId) => string
} {
  const release = useLatestRelease()
  const [platform, setPlatform] = useState<DetectedPlatform | null>(null)

  useEffect(() => {
    setPlatform(detectPlatform(navigator.userAgent))
  }, [])

  const urlFor = (id: PlatformId): string => release?.urls[id] ?? RELEASES_PAGE
  const href = platform ? urlFor(platform.id) : RELEASES_PAGE

  return { platform, href, urlFor }
}
