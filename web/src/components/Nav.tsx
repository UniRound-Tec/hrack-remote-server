'use client'

import { useLang } from '@/i18n/lang-context'
import { locales, localeLabels, type Locale } from '@/i18n'
import { Brand } from './Brand'
import Github from '@lobehub/icons/es/Github/components/Mono'
import { ChevronDown, Languages } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const REPO_URL = 'https://github.com/UniRound-Tec/HRack'

const MENU_WIDTH = 160
const MENU_MARGIN = 8

export function Nav() {
  const { strings, lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(
    null
  )
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

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

  useLayoutEffect(() => {
    if (!open) {
      setMenuPos(null)
      return
    }
    const place = (): void => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const vw = document.documentElement.clientWidth
      const maxLeft = vw - MENU_MARGIN - MENU_WIDTH
      const left = Math.min(Math.max(MENU_MARGIN, rect.right - MENU_WIDTH), maxLeft)
      setMenuPos({ top: rect.bottom + 6, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  const links = [
    { href: 'https://github.com/UniRound-Tec/HRack#readme', label: strings.nav.docs },
    { href: 'https://github.com/UniRound-Tec', label: strings.nav.about }
  ]

  return (
    <header className="sticky top-0 z-50">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[8px]"
      />
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center px-5 sm:px-8">
        <div className="flex items-baseline">
          <a
            href="#top"
            aria-label="HRack"
            className="flex shrink-0 items-baseline pr-4"
          >
            {/* Ammonite 字身贴顶、下方空出 descent，下移半个空余量与 13px 链接对齐 */}
            <Brand className="translate-y-[0.05em] text-[22px]" />
          </a>
          <ul className="hidden items-baseline md:flex">
            {links.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block px-2.5 text-[13px] leading-none font-medium text-text-muted transition-colors hover:text-text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="ml-auto flex h-8 items-center gap-1.5">
          <div className="relative flex h-8 items-center" ref={menuRef}>
            <button
              ref={buttonRef}
              type="button"
              aria-haspopup="listbox"
              aria-expanded={open}
              aria-label={strings.nav.language}
              onClick={() => setOpen((value) => !value)}
              className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[12px] leading-none font-medium text-text-muted transition-colors hover:bg-surface-strong/70 hover:text-text-secondary"
            >
              <Languages className="size-3.5 shrink-0" strokeWidth={1.75} />
              <span className="hidden sm:inline">{localeLabels[lang]}</span>
              <ChevronDown
                className={`size-3 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
                strokeWidth={1.75}
              />
            </button>
            {open && menuPos && (
              <ul
                role="listbox"
                aria-label={strings.nav.language}
                style={{ top: menuPos.top, left: menuPos.left, width: MENU_WIDTH }}
                className="fixed z-[70] overflow-hidden rounded-lg border border-border-default bg-content py-1 shadow-[0_16px_36px_-8px_var(--hrack-shadow-popover)]"
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
            className="inline-flex size-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-strong/70 hover:text-text-secondary"
          >
            <Github className="size-4" strokeWidth={1.75} />
          </a>

          <a
            href="/login"
            className="inline-flex h-8 items-center rounded-full bg-button-primary px-3.5 text-[12px] leading-none font-medium text-button-primary-fg transition-colors hover:bg-button-primary-hover"
          >
            {strings.nav.login}
          </a>
        </div>
      </nav>
    </header>
  )
}
