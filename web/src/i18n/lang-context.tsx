'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react'
import { detectLocale, isLocale } from './locale'
import { getStrings, type LandingStrings, type Locale } from '.'

const STORAGE_KEY = 'hrack-lang'

interface LangContextValue {
  lang: Locale
  strings: LandingStrings
  setLang: (locale: Locale) => void
}

const LangContext = createContext<LangContextValue | null>(null)

export function LangProvider({ children }: { children: ReactNode }) {
  // SSR 与首次客户端渲染用基准语言，挂载后立即解析实际语言。
  // 根节点带 suppressHydrationWarning，避免文本补丁告警（next-themes 同款策略）。
  const [lang, setLangState] = useState<Locale>('zh-CN')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isLocale(stored)) {
      setLangState(stored)
      return
    }
    setLangState(detectLocale())
  }, [])

  const setLang = useCallback((locale: Locale) => {
    setLangState(locale)
    window.localStorage.setItem(STORAGE_KEY, locale)
    document.documentElement.lang = locale
  }, [])

  const value = useMemo<LangContextValue>(
    () => ({ lang, strings: getStrings(lang), setLang }),
    [lang, setLang]
  )

  // 语言切换后同步文档标题（metadata 以 zh-CN 为基准输出）
  useEffect(() => {
    document.title = getStrings(lang).meta.title
  }, [lang])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) throw new Error('useLang must be used within LangProvider')
  return context
}
