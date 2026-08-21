'use client'

import ClickSpark from '@/effects/ClickSpark'
import TextType from '@/effects/TextType'
import { useLang } from '@/i18n/lang-context'
import { useRack } from '@/lib/use-rack'
import { motion, useReducedMotion } from 'motion/react'
import Github from '@lobehub/icons/es/Github/components/Mono'
import { Download, Smartphone } from 'lucide-react'
import { Rack } from './Rack'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'
const REPO_URL = 'https://github.com/UniRound-Tec/HRack'

export function Hero() {
  const { strings } = useLang()
  const states = useRack()
  const reduce = useReducedMotion()

  const needsYou = states.filter((s) => s.status === 'needs-you').length
  const errors = states.filter((s) => s.status === 'error').length
  const working = states.filter((s) => s.status === 'working').length

  return (
    <section className="relative mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-8 lg:pt-24 lg:pb-28">
      {/* 标语：居中展开 */}
      <div className="flex min-w-0 flex-col items-center">
        <p className="flex items-center gap-2.5 font-maple text-[10px] font-medium tracking-[0.28em] text-text-faint uppercase">
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-flame shadow-[0_0_10px_color-mix(in_srgb,var(--hrack-accent-flame)_60%,transparent)]"
          />
          hrack — harness rack
        </p>

        <TextType
          as="h1"
          text={strings.hero.title}
          keywords={[strings.hero.keyword]}
          keywordColor="var(--hrack-accent-flame)"
          typingSpeed={26}
          initialDelay={200}
          loop={false}
          showCursor
          cursorCharacter="|"
          cursorClassName="text-text-faint"
          className="mt-5 max-w-4xl text-[32px] leading-[1.2] font-semibold tracking-wide text-text-primary sm:text-[42px] lg:text-[52px]"
        />

        <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-text-muted">
          {strings.hero.sub}
        </p>

        {/* 终端回显：rack 的实时注意力统计 */}
        <div
          className="mt-7 rounded-xl border border-border-default bg-content px-4 py-3 text-left font-maple text-[12px] leading-relaxed"
          aria-live="off"
        >
          <p className="text-text-faint">
            <span className="select-none">$</span>{' '}
            <span className="text-text-secondary">hrack watch</span>
          </p>
          <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {needsYou > 0 && (
              <span className="flex items-center gap-1.5 text-status-needs-you">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-status-needs-you-dot"
                />
                {strings.hero.promptNeedsYou(needsYou)}
              </span>
            )}
            {errors > 0 && (
              <span className="flex items-center gap-1.5 text-status-error">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-status-error-dot"
                />
                {strings.hero.promptErrors(errors)}
              </span>
            )}
            {needsYou === 0 && errors === 0 && (
              <span className="flex items-center gap-1.5 text-status-done">
                <span
                  aria-hidden
                  className="size-1.5 rounded-full bg-status-done-dot"
                />
                {strings.hero.promptQuiet}
              </span>
            )}
            <span className="flex items-center gap-1.5 text-status-working">
              <span
                aria-hidden
                className="size-1.5 rounded-full bg-status-working-dot dot-breathe"
              />
              {strings.hero.promptWorking(working)}
            </span>
          </p>
        </div>

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
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-border-default bg-content px-5 py-3 text-[14px] font-medium text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <Github className="size-4" strokeWidth={1.75} />
            {strings.hero.github}
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

      {/* 活的 rack：标语之下 */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-16 w-full max-w-2xl min-w-0"
      >
        <Rack states={states} />
      </motion.div>
    </section>
  )
}
