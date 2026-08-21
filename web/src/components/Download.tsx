'use client'

import { useLang } from '@/i18n/lang-context'
import { ArrowUpRight } from 'lucide-react'
import { Eyebrow, Reveal } from './Reveal'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'

export function Download() {
  const { strings } = useLang()
  const platforms = [
    strings.download.platforms.windows,
    strings.download.platforms.macos,
    strings.download.platforms.linux
  ]

  return (
    <section
      id="download"
      className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>download</Eyebrow>
          <h2 className="mt-3 text-[24px] leading-snug font-semibold tracking-wide text-text-primary sm:text-[28px]">
            {strings.download.heading}
          </h2>
          <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
            {strings.download.intro}
          </p>
        </div>
      </Reveal>

      <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
        {platforms.map((platform, index) => (
          <Reveal key={platform.name} delay={0.05 + index * 0.07}>
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="group flex h-full flex-col rounded-xl border border-border-subtle bg-content p-5 transition-all duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:shadow-[0_14px_34px_-18px_var(--hrack-shadow-popover)]"
            >
              <span className="flex items-center justify-between">
                <span className="text-[15px] font-semibold text-text-primary">
                  {platform.name}
                </span>
                <ArrowUpRight
                  className="size-4 text-text-faint transition-colors group-hover:text-text-secondary"
                  strokeWidth={1.75}
                />
              </span>
              <span className="mt-1.5 font-maple text-[10px] tracking-wide text-text-faint">
                {platform.hint}
              </span>
            </a>
          </Reveal>
        ))}
      </div>

      <Reveal delay={0.15}>
        <div className="mt-10 text-center">
          <a
            href={RELEASES_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-button-primary px-7 py-3 text-[14px] font-medium text-button-primary-fg transition-colors hover:bg-button-primary-hover"
          >
            {strings.download.go}
            <ArrowUpRight className="size-4" strokeWidth={2} />
          </a>
          <p className="mx-auto mt-4 max-w-md text-[12px] leading-relaxed text-text-faint">
            {strings.download.note}
          </p>
        </div>
      </Reveal>
    </section>
  )
}
