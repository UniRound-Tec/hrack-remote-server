'use client'

import { useLang } from '@/i18n/lang-context'
import { locales, localeLabels, type Locale } from '@/i18n'
import { Brand } from './Brand'
import Github from '@lobehub/icons/es/Github/components/Mono'
import { ChevronDown, Download, Languages } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'
const REPO_URL = 'https://github.com/UniRound-Tec/HRack'

export function Nav() {
  const { strings, lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return
      }
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const links = [
    { href: 'https://github.com/UniRound-Tec/HRack#readme', label: strings.nav.docs },
    { href: 'https://github.com/UniRound-Tec', label: strings.nav.about }
  ]

  return (
    <header className="sticky top-0 z-50 border-b border-border-faint bg-[color-mix(in_srgb,var(--hrack-bg-app)_84%,transparent)] backdrop-blur-md">
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-5 sm:px-8">
        <a
          href="#top"
          aria-label="HRack"
          className="flex shrink-0 items-center py-1"
        >
          <Brand className="text-[22px]" />
        </a>

        <ul className="hidden items-center gap-1 md:flex">
          {links.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-2.5 py-1.5 text-[13px] font-medium text-text-muted transition-colors hover:text-text-primary"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="ml-auto flex items-center gap-2">
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={strings.nav.language}
              onClick={() => setOpen((value) => !value)}
              className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12px] font-medium text-text-muted transition-colors hover:bg-surface-strong hover:text-text-secondary"
            >
              <Languages className="size-3.5" strokeWidth={1.75} />
              <span className="hidden sm:inline">{localeLabels[lang]}</span>
              <ChevronDown
                className={`size-3 transition-transform ${open ? 'rotate-180' : ''}`}
                strokeWidth={1.75}
              />
            </button>
            {open && (
              <ul
                role="listbox"
                aria-label={strings.nav.language}
                className="absolute right-0 z-50 mt-1.5 w-40 overflow-hidden rounded-lg border border-border-default bg-content py-1 shadow-[0_16px_36px_-8px_var(--hrack-shadow-popover)]"
              >
                {locales.map((locale: Locale) => (
                  <li key={locale} role="option" aria-selected={locale === lang}>
                    <button
                      type="button"
                      onClick={() => {
                        setLang(locale)
                        setOpen(false)
                      }}
                      className={`w-full px-3 py-1.5 text-left text-[13px] transition-colors ${
                        locale === lang
                          ? 'bg-surface-strong font-medium text-text-primary'
                          : 'text-text-secondary hover:bg-surface-hover'
                      }`}
                    >
                      {localeLabels[locale]}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-strong hover:text-text-secondary"
          >
            <Github className="size-4" strokeWidth={1.75} />
          </a>

          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="hidden items-center gap-1.5 rounded-full bg-button-primary px-3.5 py-1.5 text-[12px] font-medium text-button-primary-fg transition-colors hover:bg-button-primary-hover sm:flex"
          >
            <Download className="size-3.5" strokeWidth={2} />
            {strings.nav.download}
          </a>

          <a
            href="/login"
            className="flex items-center rounded-full border border-border-default bg-content px-3.5 py-1.5 text-[12px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            {strings.nav.login}
          </a>
        </div>
      </nav>
    </header>
  )
}
