import { GITHUB_REPOSITORY_API } from '@/lib/github'

export const revalidate = 3600

type GitHubRepository = {
  stargazers_count?: unknown
}

export async function GET(): Promise<Response> {
  try {
    const token = process.env.GITHUB_TOKEN?.trim()
    const upstream = await fetch(GITHUB_REPOSITORY_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'hrack-web',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(8000)
    })

    if (!upstream.ok) {
      return Response.json(
        { error: 'upstream' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    const body = (await upstream.json()) as GitHubRepository
    if (typeof body.stargazers_count !== 'number') {
      return Response.json(
        { error: 'upstream' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      )
    }

    return Response.json(
      { stars: Math.max(0, Math.trunc(body.stargazers_count)) },
      {
        headers: {
          'Cache-Control':
            'public, s-maxage=3600, stale-while-revalidate=86400'
        }
      }
    )
  } catch {
    return Response.json(
      { error: 'upstream' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
