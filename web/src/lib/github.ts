export const GITHUB_REPOSITORY = 'UniRound-Tec/HRack'
export const GITHUB_REPOSITORY_URL = `https://github.com/${GITHUB_REPOSITORY}`
export const GITHUB_REPOSITORY_API = `https://api.github.com/repos/${GITHUB_REPOSITORY}`

export function formatGitHubStars(stars: number | null): string {
  if (stars === null) return '—'
  if (stars < 1000) return String(stars)
  return `${(stars / 1000).toFixed(stars < 10_000 ? 1 : 0)}k`
}
