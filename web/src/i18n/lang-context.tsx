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
import { usePathname } from 'next/navigation'
import { isLocale } from './locale'
import { getStrings, type LandingStrings, type Locale } from '.'

const STORAGE_KEY = 'hrack-lang'

interface LangContextValue {
  lang: Locale
  strings: LandingStrings
  setLang: (locale: Locale) => void
}

const LangContext = createContext<LangContextValue | null>(null)

function persistLocale(locale: Locale): void {
  window.localStorage.setItem(STORAGE_KEY, locale)
  document.cookie = `${STORAGE_KEY}=${locale}; path=/; max-age=31536000; SameSite=Lax`
  document.documentElement.lang = locale
}

export function LangProvider({
  children,
  initialLang
}: {
  children: ReactNode
  initialLang: Locale
}) {
  const [lang, setLangState] = useState<Locale>(initialLang)
  const pathname = usePathname()

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored && isLocale(stored) && stored !== initialLang) {
      setLangState(stored)
    }
  }, [initialLang])

  useEffect(() => {
    document.documentElement.lang = lang
    if (pathname === '/') {
      document.title = getStrings(lang).meta.title
    }
  }, [lang, pathname])

  const setLang = useCallback((locale: Locale) => {
    setLangState(locale)
    persistLocale(locale)
  }, [])

  const value = useMemo<LangContextValue>(
    () => ({ lang, strings: getStrings(lang), setLang }),
    [lang, setLang]
  )

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const context = useContext(LangContext)
  if (!context) throw new Error('useLang must be used within LangProvider')
  return context
}
