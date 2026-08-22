import type { PlatformId } from './platform'

export const RELEASES_PAGE = 'https://github.com/UniRound-Tec/HRack/releases'
export const GITHUB_LATEST_API =
  'https://api.github.com/repos/UniRound-Tec/HRack/releases/latest'

export type ReleaseUrls = Partial<Record<PlatformId, string>>

type GithubAsset = { name: string; browser_download_url: string }

export type LatestRelease = {
  tag: string
  urls: ReleaseUrls
}

function isSidecar(name: string): boolean {
  const n = name.toLowerCase()
  return (
    n.endsWith('.sha256') ||
    n.endsWith('.blockmap') ||
    n.endsWith('.yml') ||
    n.endsWith('.zip')
  )
}

function pick(
  assets: GithubAsset[],
  test: (name: string) => boolean
): string | undefined {
  return assets.find((asset) => !isSidecar(asset.name) && test(asset.name))
    ?.browser_download_url
}

export function mapReleaseAssets(
  tag: string,
  assets: GithubAsset[]
): LatestRelease {
  return {
    tag,
    urls: {
      windows: pick(assets, (name) => /setup.*\.exe$/i.test(name)),
      macos: pick(
        assets,
        (name) => /macos-arm64\.dmg$/i.test(name) || /macos.*\.dmg$/i.test(name)
      ),
      linux:
        pick(assets, (name) => /\.appimage$/i.test(name)) ??
        pick(assets, (name) => /\.deb$/i.test(name))
    }
  }
}
