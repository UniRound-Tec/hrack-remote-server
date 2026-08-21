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
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <div className="overflow-hidden rounded-2xl border border-border-default bg-content px-6 py-8 sm:px-10 sm:py-10">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-md">
              <Eyebrow>download</Eyebrow>
              <h2 className="mt-3 text-[26px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[32px]">
                {strings.download.heading}
              </h2>
              <p className="mt-3 text-[14px] leading-relaxed text-text-muted">
                {strings.download.intro}
              </p>
              <p className="mt-3 text-[12px] leading-relaxed text-text-faint">
                {strings.download.note}
              </p>
            </div>

            <ul className="flex w-full max-w-sm flex-col">
              {platforms.map((platform) => (
                <li
                  key={platform.name}
                  className="border-t border-border-faint first:border-t-0"
                >
                  <a
                    href={RELEASES_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="group flex items-baseline justify-between gap-4 py-3"
                  >
                    <span className="text-[15px] font-semibold tracking-tight text-text-primary">
                      {platform.name}
                    </span>
                    <span className="flex items-center gap-1.5 font-maple text-[10px] tracking-wide text-text-faint">
                      {platform.hint}
                      <ArrowUpRight
                        className="size-3.5 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-text-secondary"
                        strokeWidth={1.75}
                      />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  )
}
