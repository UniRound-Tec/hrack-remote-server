'use client'

import { useLang } from '@/i18n/lang-context'
import { deepHarnesses } from '@/lib/harnesses'
import { getAdapterIcon } from '@/lib/adapterIcons'
import type { LandingStrings } from '@/i18n'
import { Eyebrow, Reveal } from './Reveal'

function statusVocab(
  strings: LandingStrings,
  key: string
): string {
  const group = strings.harnesses.statuses as Record<string, string>
  return group[key] ?? ''
}

export function Harnesses() {
  const { strings } = useLang()

  return (
    <section
      id="harnesses"
      className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <Eyebrow>harnesses</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[24px] leading-snug font-semibold tracking-wide text-text-primary sm:text-[28px]">
          {strings.harnesses.heading}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-text-muted">
          {strings.harnesses.intro}
        </p>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {deepHarnesses.map((harness, index) => {
          const Icon = getAdapterIcon(harness.id)
          return (
            <Reveal key={harness.id} delay={0.05 + (index % 3) * 0.07}>
              <div className="flex h-full flex-col rounded-xl border border-border-subtle bg-content p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_14px_34px_-18px_var(--hrack-shadow-popover)]">
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center">
                    <Icon size={18} />
                  </span>
                  <h3 className="text-[15px] font-semibold text-text-primary">
                    {harness.name}
                  </h3>
                  <span className="ml-auto font-maple text-[10px] tracking-wide text-text-faint uppercase">
                    {harness.runtimes
                      .map((r) => (r === 'host' ? strings.harnesses.host : strings.harnesses.wsl))
                      .join(' · ')}
                  </span>
                </div>
                <p className="mt-3 font-maple text-[10px] tracking-[0.16em] text-text-faint uppercase">
                  {harness.integration}
                </p>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-text-strong">
                  <span className="sr-only">{strings.harnesses.statusLabel}: </span>
                  {statusVocab(strings, harness.statusesKey)}
                </p>
              </div>
            </Reveal>
          )
        })}
      </div>

      <Reveal delay={0.1}>
        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-text-faint">
          {strings.harnesses.footnote}
        </p>
      </Reveal>
    </section>
  )
}
