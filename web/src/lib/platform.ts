export type PlatformId = 'windows' | 'macos' | 'linux'

export type DetectedPlatform = {
  id: PlatformId
  label: 'Windows' | 'macOS' | 'Linux'
}

/**
 * 从 UA 判断桌面平台。移动端 / 无法识别时返回 null，下载走 Releases 页。
 */
export function detectPlatform(userAgent: string): DetectedPlatform | null {
  const ua = userAgent.toLowerCase()
  if (/windows|win32|win64/.test(ua)) {
    return { id: 'windows', label: 'Windows' }
  }
  if (/mac os x|macintosh/.test(ua) && !/iphone|ipad|ipod/.test(ua)) {
    return { id: 'macos', label: 'macOS' }
  }
  if (/linux/.test(ua) && !/android/.test(ua)) {
    return { id: 'linux', label: 'Linux' }
  }
  return null
}
