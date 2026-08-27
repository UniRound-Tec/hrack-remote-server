import { afterEach, describe, expect, it, vi } from 'vitest'
import { GITHUB_REPOSITORY_API } from '@/lib/github'
import { GET } from './route'

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('GET /api/github-stars', () => {
  it('returns and caches the repository star count', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ stargazers_count: 1284 })
    )
    vi.stubGlobal('fetch', fetchMock)

    const response = await GET()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ stars: 1284 })
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=86400'
    )
    expect(fetchMock).toHaveBeenCalledWith(
      GITHUB_REPOSITORY_API,
      expect.objectContaining({ next: { revalidate: 3600 } })
    )
  })

  it('does not cache an invalid upstream response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ stargazers_count: null }))
    )

    const response = await GET()

    expect(response.status).toBe(502)
    expect(response.headers.get('cache-control')).toBe('no-store')
  })
})
