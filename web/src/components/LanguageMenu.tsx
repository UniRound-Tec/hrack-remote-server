'use client'

import { localeLabels, locales, type Locale } from '@/i18n'
import { useLang } from '@/i18n/lang-context'
import { Check, ChevronDown, Languages } from 'lucide-react'
import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent
} from 'react'

export function LanguageMenu({ compact = false }: { compact?: boolean }) {
  const { strings, lang, setLang } = useLang()
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(() => locales.indexOf(lang))
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([])
  const listboxId = useId()

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent): void => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    window.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() =>
      optionRefs.current[activeIndex]?.focus()
    )
    return () => cancelAnimationFrame(frame)
  }, [open])

  function openFromKeyboard(direction: 1 | -1): void {
    const current = Math.max(0, locales.indexOf(lang))
    setActiveIndex(
      direction === 1 ? current : (current - 1 + locales.length) % locales.length
    )
    setOpen(true)
  }

  function move(next: number): void {
    const normalized = (next + locales.length) % locales.length
    setActiveIndex(normalized)
    optionRefs.current[normalized]?.focus()
  }

  function onOptionKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      move(activeIndex + 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      move(activeIndex - 1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      move(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      move(locales.length - 1)
    } else if (event.key === 'Tab') {
      setOpen(false)
    }
  }

  function select(locale: Locale): void {
    setActiveIndex(locales.indexOf(locale))
    setLang(locale)
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-label={strings.nav.language}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            openFromKeyboard(event.key === 'ArrowDown' ? 1 : -1)
          }
        }}
        className={`hrack-press hrack-press-chip inline-flex items-center gap-1.5 text-[12px] leading-none font-medium transition-colors ${
          compact
            ? 'h-8 rounded-md px-2 text-text-muted hover:bg-surface-strong/70 hover:text-text-secondary'
            : 'h-8 rounded-full border border-border-default bg-content/85 px-3 text-text-secondary shadow-sm hover:border-border-strong hover:bg-content'
        }`}
      >
        <Languages className="size-3.5 shrink-0" strokeWidth={1.75} />
        <span className="hidden sm:inline">{localeLabels[lang]}</span>
        <ChevronDown
          className={`size-3 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div
          id={listboxId}
          role="listbox"
          aria-label={strings.nav.language}
          className="language-menu-surface absolute top-full right-0 z-[80] mt-2 w-44 overflow-hidden rounded-xl border border-border-default bg-content/95 p-1.5 shadow-[0_18px_48px_-12px_var(--hrack-shadow-popover)] backdrop-blur-xl"
        >
          {locales.map((locale, index) => (
            <button
              key={locale}
              ref={(node) => {
                optionRefs.current[index] = node
              }}
              type="button"
              role="option"
              aria-selected={locale === lang}
              tabIndex={index === activeIndex ? 0 : -1}
              onPointerMove={() => setActiveIndex(index)}
              onKeyDown={onOptionKeyDown}
              onClick={() => select(locale)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
                locale === lang
                  ? 'bg-surface-strong font-medium text-text-primary'
                  : 'text-text-secondary hover:bg-surface-hover'
              }`}
            >
              <span className="flex-1">{localeLabels[locale]}</span>
              {locale === lang ? (
                <Check className="size-3.5 text-status-done" strokeWidth={2} />
              ) : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
