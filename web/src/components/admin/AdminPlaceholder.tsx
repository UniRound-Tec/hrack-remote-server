'use client'

import { useLang } from '@/i18n/lang-context'

export function AdminPlaceholder({
  section
}: {
  section: 'users' | 'mail' | 'oauth'
}) {
  const { strings } = useLang()
  const content = strings.admin.sections[section]
  return (
    <section className="max-w-3xl">
      <p className="font-maple text-[11px] tracking-[0.18em] text-flame uppercase">
        {strings.admin.eyebrow}
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.035em] text-text-primary">
        {content.title}
      </h1>
      <p className="mt-3 text-[14px] leading-7 text-text-muted">
        {content.description}
      </p>
      <div className="mt-8 rounded-xl border border-dashed border-border-strong bg-content/60 p-6 font-maple text-[12px] text-text-faint">
        {strings.admin.comingSoon}
      </div>
    </section>
  )
}
