'use client'

import { useLang } from '@/i18n/lang-context'
import { deepHarnesses } from '@/lib/harnesses'
import { getAdapterIcon } from '@/lib/adapterIcons'
import type { LandingStrings } from '@/i18n'
import { motion, useReducedMotion } from 'motion/react'
import { Eyebrow, Reveal, fadeUpItem } from './Reveal'

function statusVocab(strings: LandingStrings, key: string): string {
  const group = strings.harnesses.statuses as Record<string, string>
  return group[key] ?? ''
}

export function Harnesses() {
  const { strings } = useLang()
  const reduce = useReducedMotion()

  return (
    <section
      id="harnesses"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <Eyebrow>harnesses</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[26px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[32px]">
          {strings.harnesses.heading}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-text-muted">
          {strings.harnesses.intro}
        </p>
      </Reveal>

      <motion.ul
          className="mt-10 overflow-hidden rounded-2xl border border-border-default bg-content"
          initial={reduce ? false : 'hidden'}
          whileInView="show"
          viewport={{ once: true, amount: 0.12 }}
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.05 } }
          }}
        >
          {deepHarnesses.map((harness) => {
            const Icon = getAdapterIcon(harness.id)
            const runtimes = harness.runtimes
              .map((r) =>
                r === 'host' ? strings.harnesses.host : strings.harnesses.wsl
              )
              .join(' · ')
            return (
              <motion.li
                key={harness.id}
                variants={fadeUpItem}
                className="flex flex-col gap-2 border-b border-border-faint px-5 py-4 last:border-b-0 transition-colors duration-200 sm:flex-row sm:items-center sm:gap-6 sm:hover:bg-surface-hover"
              >
                <div className="flex min-w-0 items-center gap-2.5 sm:w-52 sm:shrink-0">
                  <span className="inline-flex size-5 shrink-0 items-center justify-center">
                    <Icon size={18} />
                  </span>
                  <h3 className="truncate text-[15px] font-semibold tracking-tight text-text-primary">
                    {harness.name}
                  </h3>
                </div>
                <p className="font-maple text-[10px] tracking-[0.16em] text-text-faint uppercase sm:w-48 sm:shrink-0">
                  {harness.integration}
                </p>
                <p className="min-w-0 flex-1 text-[13px] leading-snug text-text-strong">
                  <span className="sr-only">{strings.harnesses.statusLabel}: </span>
                  {statusVocab(strings, harness.statusesKey)}
                </p>
                <span className="font-maple text-[10px] tracking-wide text-text-faint uppercase sm:shrink-0">
                  {runtimes}
                </span>
              </motion.li>
            )
          })}
        </motion.ul>

      <Reveal delay={0.1}>
        <p className="mt-6 max-w-3xl text-[13px] leading-relaxed text-text-faint">
          {strings.harnesses.footnote}
        </p>
      </Reveal>
    </section>
  )
}
