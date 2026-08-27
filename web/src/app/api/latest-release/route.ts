import {
  ANDROID_GITHUB_LATEST_API,
  GITHUB_LATEST_API,
  mapAndroidReleaseAsset,
  mapReleaseAssets
} from '@/lib/releases'

export const revalidate = 600

type GithubRelease = {
  tag_name?: string
  assets?: { name: string; browser_download_url: string }[]
}

export async function GET(): Promise<Response> {
  try {
    const request = (url: string) =>
      fetch(url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'hrack-web'
        },
        next: { revalidate: 600 },
        signal: AbortSignal.timeout(8000)
      })
    const [desktopUpstream, androidUpstream] = await Promise.all([
      request(GITHUB_LATEST_API),
      request(ANDROID_GITHUB_LATEST_API)
    ])
    if (!desktopUpstream.ok) {
      return Response.json(
        { error: 'upstream' },
        { status: 502, headers: { 'Cache-Control': 'no-store' } }
      )
    }
    const body = (await desktopUpstream.json()) as GithubRelease
    const release = mapReleaseAssets(body.tag_name ?? '', body.assets ?? [])
    if (androidUpstream.ok) {
      const android = (await androidUpstream.json()) as GithubRelease
      release.urls.android = mapAndroidReleaseAsset(android.assets ?? [])
    }
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
