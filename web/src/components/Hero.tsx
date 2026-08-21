'use client'

import ClickSpark from '@/effects/ClickSpark'
import { useLang } from '@/i18n/lang-context'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { Download, Smartphone } from 'lucide-react'
import { Brand } from './Brand'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'

export function Hero() {
  const { strings } = useLang()
  const reduce = useReducedMotion()

  return (
    <section className="relative mx-auto flex w-full flex-col items-center pt-12 pb-16 text-center lg:pt-16 lg:pb-20">
      <div className="flex w-full max-w-6xl min-w-0 flex-col items-center px-5 sm:px-8">
        <p className="flex items-center gap-2.5 font-maple text-[10px] font-medium tracking-[0.28em] text-text-faint uppercase">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-flame shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-accent-flame)_60%,transparent)]"
          />
          hrack — harness rack
        </p>

        <p aria-hidden="true" className="mt-4">
          <Brand className="text-[72px] sm:text-[92px] lg:text-[108px]" />
        </p>

        <h1 className="mt-5 max-w-2xl text-[20px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[24px] lg:text-[26px]">
          <Highlight
            text={strings.hero.title}
            keyword={strings.hero.keyword}
          />
        </h1>
        <p className="mt-3 max-w-xl text-[14px] leading-relaxed text-text-muted sm:text-[15px]">
          {strings.hero.sub}
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <ClickSpark
            className="relative inline-flex"
            sparkColor="var(--hrack-accent-flame)"
            sparkSize={8}
            sparkRadius={26}
            sparkCount={7}
          >
            <a
              href={RELEASES_URL}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 rounded-full bg-button-primary px-6 py-3 text-[14px] font-medium text-button-primary-fg transition-colors hover:bg-button-primary-hover"
            >
              <Download className="size-4" strokeWidth={2} />
              {strings.hero.download}
            </a>
          </ClickSpark>
          <a
            href="/login"
            className="flex items-center gap-2 rounded-full border border-border-default bg-content px-5 py-3 text-[14px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Smartphone className="size-4" strokeWidth={1.75} />
            {strings.hero.remote}
          </a>
        </div>

        <p className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-maple text-[10px] tracking-wide text-text-faint">
          <span>{strings.hero.platforms}</span>
          <span aria-hidden className="select-none">
            ·
          </span>
          <span>{strings.hero.license}</span>
        </p>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        className="relative mt-12 w-full min-w-0"
      >
        <div className="overflow-hidden rounded-2xl border border-border-default shadow-[0_28px_70px_-28px_var(--hrack-shadow-popover)]">
          <Image
            src="/demo-workspace-6.png"
            alt="HRack"
            width={2272}
            height={892}
            priority
            className="h-auto w-full"
          />
        </div>
      </motion.div>
    </section>
  )
}

function Highlight({ text, keyword }: { text: string; keyword: string }) {
  if (!keyword) return text
  const index = text.toLowerCase().indexOf(keyword.toLowerCase())
  if (index < 0) return text
  return (
    <>
      {text.slice(0, index)}
      <span className="whitespace-nowrap text-flame">
        {text.slice(index, index + keyword.length)}
      </span>
      {text.slice(index + keyword.length)}
    </>
  )
}
