'use client'

import { useLang } from '@/i18n/lang-context'
import { Brand } from './Brand'
import { LanguageMenu } from './LanguageMenu'
import Github from '@lobehub/icons/es/Github/components/Mono'
import { usePathname } from 'next/navigation'

const REPO_URL = 'https://github.com/UniRound-Tec/HRack'

export function Nav() {
  const { strings } = useLang()
  const pathname = usePathname()

  const links = [
    { href: 'https://github.com/UniRound-Tec/HRack#readme', label: strings.nav.docs },
    { href: 'https://github.com/UniRound-Tec', label: strings.nav.about }
  ]
  const homeHref = pathname === '/' ? '#top' : '/'
  const onAuth = pathname === '/auth'

  return (
    <header className={`sticky top-0 z-50 ${onAuth ? 'nav-on-dark' : ''}`}>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 backdrop-blur-[8px]"
      />
      <nav className="mx-auto flex h-14 w-full max-w-6xl items-center px-5 sm:px-8">
        <div className="flex items-baseline">
          <a
            href={homeHref}
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
                  className="inline-block px-2.5 text-[13px] leading-none font-medium text-text-muted transition-colors duration-200 hover:text-text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="ml-auto flex h-8 items-center gap-1.5">
          <LanguageMenu compact />

          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="hrack-press hrack-press-chip inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-strong/70 hover:text-text-secondary"
          >
            <Github className="size-4" strokeWidth={1.75} />
          </a>

          <a
            href="/auth"
            aria-current={onAuth ? 'page' : undefined}
            className="hrack-press hrack-press-primary inline-flex h-8 items-center rounded-full bg-button-primary px-3.5 text-[12px] leading-none font-medium text-button-primary-fg hover:bg-button-primary-hover"
          >
            {strings.nav.login}
          </a>
        </div>
      </nav>
    </header>
  )
}
