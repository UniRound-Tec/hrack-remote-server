'use client'

import ClickSpark from '@/effects/ClickSpark'
import TextType from '@/effects/TextType'
import { useLang } from '@/i18n/lang-context'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import { Download, Smartphone } from 'lucide-react'
import { Brand } from './Brand'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'

const EASE = [0.22, 1, 0.36, 1] as const

export function Hero() {
  const { strings } = useLang()
  const reduce = useReducedMotion()

  const fadeUp = (delay: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.6, delay, ease: EASE }
  })

  return (
    <section className="relative mx-auto flex w-full flex-col items-center pt-12 pb-16 text-center lg:pt-16 lg:pb-20">
      <div className="flex w-full max-w-6xl min-w-0 flex-col items-center px-5 sm:px-8">
        <motion.div {...fadeUp(0)} className="flex flex-col items-center">
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
        </motion.div>

        <h1 className="mt-6 max-w-2xl text-[22px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[26px] lg:text-[28px]">
          <span className="sr-only">{strings.hero.title}</span>
          {/* 打字机逐字呈现；隐形副本占位，避免打字过程中的布局抖动 */}
          <span aria-hidden className="grid justify-items-center">
            <span className="invisible col-start-1 row-start-1 whitespace-pre-wrap">
              {strings.hero.title}
            </span>
            <TextType
              as="span"
              className="col-start-1 row-start-1"
              text={strings.hero.title}
              typingSpeed={55}
              initialDelay={350}
              loop={false}
              cursorClassName="text-flame"
              keywords={[strings.hero.keyword]}
              keywordColor="var(--hrack-accent-flame)"
              keywordClassName="whitespace-nowrap"
            />
          </span>
        </h1>

        <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-text-muted sm:text-[15px]">
          {strings.hero.sub.map((line, index) => (
            <motion.span
              key={line}
              initial={
                reduce ? false : { opacity: 0, y: 10, filter: 'blur(6px)' }
              }
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{
                duration: 0.6,
                delay: 0.55 + index * 0.18,
                ease: EASE
              }}
              className="text-pretty sm:block"
            >
              {line}{' '}
            </motion.span>
          ))}
        </p>

        <motion.div
          {...fadeUp(0.9)}
          className="mt-8 flex flex-wrap items-center justify-center gap-3"
        >
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
              className="flex items-center gap-2 rounded-full bg-button-primary px-6 py-3 text-[14px] font-medium text-button-primary-fg shadow-[0_10px_24px_-12px_rgb(0_0_0/45%)] transition-[background-color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-button-primary-hover hover:shadow-[0_14px_28px_-12px_rgb(0_0_0/50%)] active:translate-y-0 active:scale-[0.98]"
            >
              <Download className="size-4" strokeWidth={2} />
              {strings.hero.download}
            </a>
          </ClickSpark>
          <a
            href="/login"
            className="flex items-center gap-2 rounded-full border border-border-default bg-content px-5 py-3 text-[14px] font-medium text-text-secondary transition-[color,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-border-strong hover:text-text-primary active:translate-y-0 active:scale-[0.98]"
          >
            <Smartphone className="size-4" strokeWidth={1.75} />
            {strings.hero.remote}
          </a>
        </motion.div>

        <motion.p
          {...fadeUp(1.05)}
          className="mt-5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-maple text-[10px] tracking-wide text-text-faint"
        >
          <span>{strings.hero.platforms}</span>
          <span aria-hidden className="select-none">
            ·
          </span>
          <span>{strings.hero.license}</span>
        </motion.p>
      </div>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.12, ease: EASE }}
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
