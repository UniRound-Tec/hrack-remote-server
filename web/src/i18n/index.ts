import { zhCN, type LandingStrings } from './zh-CN'
import { zhTW } from './zh-TW'
import { en } from './en'
import { ja } from './ja'
import { ko } from './ko'

export const locales = ['zh-CN', 'zh-TW', 'en', 'ja', 'ko'] as const
export type Locale = (typeof locales)[number]

export type { LandingStrings }

const dictionaries: Record<Locale, LandingStrings> = {
  'zh-CN': zhCN,
  'zh-TW': zhTW,
  en,
  ja,
  ko
}

export function getStrings(locale: Locale): LandingStrings {
  return dictionaries[locale] ?? zhCN
}

export const localeLabels: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  en: 'English',
  ja: '日本語',
  ko: '한국어'
}
