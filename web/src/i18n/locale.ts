import type { Locale } from './index'

/**
 * 按浏览器语言偏好选语言；未支持的语言统一回退英文。
 * 与主仓 src/app/i18n/locale.ts 同一解析规则。
 */
export function resolveLocale(languages: readonly string[]): Locale {
  for (const language of languages) {
    const normalized = language.toLowerCase()
    if (normalized.startsWith('zh')) {
      if (
        normalized.includes('hant') ||
        normalized.includes('-tw') ||
        normalized.includes('-hk') ||
        normalized.includes('-mo')
      ) {
        return 'zh-TW'
      }
      return 'zh-CN'
    }
    if (normalized.startsWith('ja')) return 'ja'
    if (normalized.startsWith('ko')) return 'ko'
    if (normalized.startsWith('en')) return 'en'
  }
  return 'en'
}

/** `Accept-Language: zh-CN,zh;q=0.9,en;q=0.8` → `['zh-CN', 'zh', 'en']` */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
  if (!header) return []
  return header
    .split(',')
    .map((part) => part.split(';')[0]?.trim() ?? '')
    .filter((tag) => tag.length > 0)
}

export function detectLocale(): Locale {
  if (typeof navigator === 'undefined') return 'en'
  const languages =
    navigator.languages.length > 0
      ? navigator.languages
      : [navigator.language]
  return resolveLocale(languages)
}

export function isLocale(value: string): value is Locale {
  return ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'].includes(value)
}
