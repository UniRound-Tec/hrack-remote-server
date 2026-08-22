'use client'

import { Brand } from '@/components/Brand'
import { authClient } from '@/lib/auth-client'
import { locales, localeLabels, type Locale } from '@/i18n'
import { useLang } from '@/i18n/lang-context'
import {
  ArrowUpRight,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Mail,
  Users
} from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, type ReactNode } from 'react'

const items = [
  { href: '/admin', key: 'overview', icon: LayoutDashboard },
  { href: '/admin/users', key: 'users', icon: Users },
  { href: '/admin/mail', key: 'mail', icon: Mail },
  { href: '/admin/oauth', key: 'oauth', icon: KeyRound }
] as const

export function AdminShell({
  children,
  email
}: {
  children: ReactNode
  email: string
}) {
  const pathname = usePathname()
  const { strings, lang, setLang } = useLang()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut(): Promise<void> {
    setSigningOut(true)
    try {
      await authClient.signOut()
      window.location.assign('/auth')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen bg-app">
      <header className="sticky top-0 z-40 border-b border-border-default bg-content/90 backdrop-blur-xl">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-4 px-5 sm:px-8">
          <Link href="/admin" className="flex shrink-0 items-baseline gap-3">
            <Brand className="text-[22px]" />
            <span className="font-maple text-[10px] tracking-[0.2em] text-text-faint uppercase">
              {strings.admin.eyebrow}
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden max-w-52 truncate font-maple text-[11px] text-text-muted lg:block">
              {email}
            </span>
            <select
              aria-label={strings.nav.language}
              value={lang}
              onChange={(event) => setLang(event.target.value as Locale)}
              className="h-8 rounded-md border border-border-default bg-surface px-2 text-[12px] text-text-secondary"
            >
              {locales.map((locale) => (
                <option key={locale} value={locale}>
                  {localeLabels[locale]}
                </option>
              ))}
            </select>
            <Link
              href="/dashboard"
              className="hrack-press hrack-press-chip hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] text-text-muted hover:bg-surface-strong sm:inline-flex"
            >
              {strings.admin.dashboard}
              <ArrowUpRight className="size-3.5" strokeWidth={1.75} />
            </Link>
            <button
              type="button"
              disabled={signingOut}
              onClick={() => void signOut()}
              className="hrack-press hrack-press-chip inline-flex size-8 items-center justify-center rounded-md text-text-muted hover:bg-surface-strong disabled:opacity-50"
              aria-label={strings.admin.signOut}
            >
              <LogOut className="size-4" strokeWidth={1.75} />
            </button>
          </div>
        </div>

        <nav
          aria-label={strings.admin.navigation}
          className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-5 pb-2 sm:px-8"
        >
          {items.map(({ href, key, icon: Icon }) => {
            const active =
              href === '/admin' ? pathname === href : pathname.startsWith(href)
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-md px-3 text-[12px] font-medium transition-colors ${
                  active
                    ? 'bg-control-active text-text-primary shadow-sm ring-1 ring-border-default'
                    : 'text-text-muted hover:bg-surface-strong hover:text-text-secondary'
                }`}
              >
                <Icon className="size-3.5" strokeWidth={1.75} />
                {strings.admin.nav[key]}
              </Link>
            )
          })}
        </nav>
      </header>

      <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8">
        {children}
      </main>
    </div>
  )
}
