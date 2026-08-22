'use client'

import { useLang } from '@/i18n/lang-context'
import { KeyRound, Mail, Users } from 'lucide-react'
import Link from 'next/link'

export function AdminOverview() {
  const { strings } = useLang()
  const cards = [
    { href: '/admin/users', key: 'users', icon: Users },
    { href: '/admin/mail', key: 'mail', icon: Mail },
    { href: '/admin/oauth', key: 'oauth', icon: KeyRound }
  ] as const

  return (
    <section>
      <p className="font-maple text-[11px] tracking-[0.18em] text-flame uppercase">
        {strings.admin.eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text-primary sm:text-4xl">
        {strings.admin.overview.title}
      </h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-7 text-text-muted">
        {strings.admin.overview.lead}
      </p>

      <div className="mt-9 grid gap-4 md:grid-cols-3">
        {cards.map(({ href, key, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="hrack-press rounded-xl border border-border-default bg-content p-5 shadow-[0_14px_40px_-30px_var(--hrack-shadow-window)] hover:border-border-strong"
          >
            <Icon className="size-5 text-text-muted" strokeWidth={1.6} />
            <h2 className="mt-6 text-[15px] font-semibold text-text-primary">
              {strings.admin.sections[key].title}
            </h2>
            <p className="mt-2 text-[13px] leading-6 text-text-muted">
              {strings.admin.sections[key].description}
            </p>
          </Link>
        ))}
      </div>
    </section>
  )
}
