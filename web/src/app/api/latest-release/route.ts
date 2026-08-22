import { GITHUB_LATEST_API, mapReleaseAssets } from '@/lib/releases'

export const revalidate = 600

type GithubRelease = {
  tag_name?: string
  assets?: { name: string; browser_download_url: string }[]
}

export async function GET(): Promise<Response> {
  try {
    const upstream = await fetch(GITHUB_LATEST_API, {
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'hrack-web'
      },
      next: { revalidate: 600 },
      signal: AbortSignal.timeout(8000)
    })
    if (!upstream.ok) {
      return Response.json(
        { error: 'upstream' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const body = (await upstream.json()) as GithubRelease
    const release = mapReleaseAssets(body.tag_name ?? '', body.assets ?? [])
    return Response.json(release, {
      headers: { 'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=3600' }
    })
  } catch {
    return Response.json(
      { error: 'upstream' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}
