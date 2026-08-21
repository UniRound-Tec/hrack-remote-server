'use client'

import { useLang } from '@/i18n/lang-context'
import {
  sessionStatuses,
  statusColor,
  statusLabel,
  type SessionStatus
} from '@/lib/session-status'
import { useInView, useReducedMotion } from 'motion/react'
import { useRef } from 'react'
import { Eyebrow, Reveal } from './Reveal'

const statusKeys: Record<SessionStatus, string> = {
  working: 'working',
  'needs-you': 'needs-you',
  done: 'done',
  error: 'error',
  idle: 'idle',
  exited: 'exited'
}

const itemKeys: Record<SessionStatus, keyof StatesItems> = {
  working: 'working',
  'needs-you': 'needsYou',
  done: 'done',
  error: 'error',
  idle: 'idle',
  exited: 'exited'
}

type StatesItems = {
  working: string
  needsYou: string
  done: string
  error: string
  idle: string
  exited: string
}

/**
 * 六盏灯：一面仪器，不是六张卡片。滚入后依次点亮，
 * 灯色即产品语义色（这套颜色在整站只用于状态）。
 */
export function States() {
  const { strings } = useLang()
  const containerRef = useRef<HTMLDivElement>(null)
  const inView = useInView(containerRef, { once: true, margin: '-120px' })
  const reduce = useReducedMotion()
  const lit = inView || reduce

  return (
    <section
      id="states"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <Eyebrow>states</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[26px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[32px]">
          {strings.states.heading}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-text-muted">
          {strings.states.intro}
        </p>
      </Reveal>

      <div
        ref={containerRef}
        className="mt-10 overflow-hidden rounded-2xl border border-border-default bg-content"
      >
        <div className="grid grid-cols-1 gap-px bg-border-default sm:grid-cols-2 lg:grid-cols-3">
          {sessionStatuses.map((status, index) => {
            const color = statusColor[status]
            const item = strings.states.items[itemKeys[status]]
            return (
              <div key={status} className="bg-content p-5">
                <div className="flex items-center justify-between">
                  <span
                    className={`size-3 rounded-full transition-colors duration-700 ${status === 'working' && lit ? 'dot-breathe' : ''}`}
                    style={{
                      transitionDelay: lit ? `${index * 110}ms` : '0ms',
                      backgroundColor:
                        status === 'exited'
                          ? 'transparent'
                          : lit
                            ? color
                            : 'var(--hrack-status-idle-dot)',
                      boxShadow:
                        lit && status !== 'exited'
                          ? `0 0 14px color-mix(in srgb, ${color} 55%, transparent)`
                          : 'none',
                      ...(status === 'exited'
                        ? { border: '1.5px solid var(--hrack-status-exited)' }
                        : {})
                    }}
                    aria-hidden
                  />
                  <span className="font-maple text-[10px] tracking-[0.18em] text-text-faint uppercase">
                    {statusKeys[status]}
                  </span>
                </div>
                <h3 className="mt-4 text-[16px] font-semibold tracking-tight text-text-primary">
                  {statusLabel(status, strings)}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                  {item}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
