'use client'

import ClickSpark from '@/effects/ClickSpark'
import TextType from '@/effects/TextType'
import { useLang } from '@/i18n/lang-context'
import { motion, useReducedMotion } from 'motion/react'
import Image from 'next/image'
import Github from '@lobehub/icons/es/Github/components/Mono'
import { Download, Smartphone } from 'lucide-react'
import { Brand } from './Brand'
import { FloatingRack } from './FloatingRack'

const RELEASES_URL = 'https://github.com/UniRound-Tec/HRack/releases'
const REPO_URL = 'https://github.com/UniRound-Tec/HRack'

export function Hero() {
  const { strings } = useLang()
  const reduce = useReducedMotion()

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

        {/* 大标题：品牌字标特效（与 header 左侧 hrack 一致，放大版） */}
        <h1 className="mt-5">
          <Brand className="text-[96px] sm:text-[120px] lg:text-[144px]" />
        </h1>

        {/* 小文字：标语打字效果 */}
        <TextType
          as="p"
          text={strings.hero.title}
          keywords={[strings.hero.keyword]}
          keywordColor="var(--hrack-accent-flame)"
          keywordClassName="whitespace-nowrap"
          typingSpeed={26}
          initialDelay={200}
          loop={false}
          showCursor
          cursorCharacter="|"
          cursorClassName="text-text-faint"
          className="mt-6 max-w-2xl text-[15px] leading-relaxed text-text-muted sm:text-[16px]"
        />

        {/* 行为号召 */}
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

      {/* 产品界面：应用截图 + 可拖动的悬浮监控窗 */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        className="mt-16 w-full max-w-5xl min-w-0"
      >
        <div className="relative overflow-hidden rounded-2xl border border-border-default shadow-[0_28px_70px_-28px_var(--hrack-shadow-popover)]">
          <Image
            src="/demo-app.png"
            alt="HRack"
            width={1342}
            height={898}
            priority
            className="h-auto w-full"
          />
        </div>
      </motion.div>

      {/* 悬浮监控窗：可在整个 hero 区域拖动 */}
      <FloatingRack />
    </section>
  )
}
