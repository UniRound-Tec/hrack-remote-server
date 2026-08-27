'use client'

import { useEffect, useState } from 'react'

type GitHubStarsResponse = {
  stars?: unknown
}

let inflight: Promise<number | null> | null = null

function loadGitHubStars(): Promise<number | null> {
  if (!inflight) {
    inflight = fetch('/api/github-stars')
      .then(async response => {
        if (!response.ok) return null
        const body = (await response.json()) as GitHubStarsResponse
        return typeof body.stars === 'number' ? body.stars : null
      })
      .catch(() => null)
  }
  return inflight
}

export function useGitHubStars(): number | null {
  const [stars, setStars] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    void loadGitHubStars().then(value => {
      if (!cancelled && value !== null) setStars(value)
    })
    return () => {
      cancelled = true
    }
  }, [])

  return stars
}
