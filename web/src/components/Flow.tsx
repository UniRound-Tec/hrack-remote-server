'use client'

import { useLang } from '@/i18n/lang-context'
import { ShieldCheck } from 'lucide-react'
import { motion, useInView, useReducedMotion } from 'motion/react'
import type { CSSProperties } from 'react'
import { useRef } from 'react'
import { Eyebrow, Reveal, fadeUpItem } from './Reveal'

function Node({
  label,
  origin = false
}: {
  label: string
  origin?: boolean
}) {
  return (
    <div
      className={`flex min-h-11 items-center justify-center rounded-md border px-3.5 py-2 text-center text-[13px] font-medium leading-snug tracking-tight text-text-primary ${
        origin ? 'border-border-strong' : 'border-border-default'
      }`}
    >
      {label}
    </div>
  )
}

function Wire({
  label,
  tone = 'neutral',
  duration = 2.8,
  armed = true
}: {
  label: string
  tone?: 'neutral' | 'signal'
  duration?: number
  armed?: boolean
}) {
  const line =
    tone === 'signal'
      ? 'bg-[color-mix(in_srgb,var(--hrack-status-working)_40%,transparent)]'
      : 'bg-border-strong'
  const dot =
    tone === 'signal' ? 'bg-status-working-dot' : 'bg-[var(--hrack-accent-spark)]'
  const text = tone === 'signal' ? 'text-status-working' : 'text-text-faint'

  return (
    <div className="relative flex min-h-11 min-w-0 items-center">
      <div
        className={`relative h-px w-full origin-left transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          armed ? 'scale-x-100' : 'scale-x-0'
        } ${line}`}
      >
        <span
          className={`flow-wire-dot flow-wire-dot-x ${dot}`}
          style={
            {
              '--packet-duration': `${duration}s`,
              '--packet-delay': '0s',
              animationPlayState: armed ? 'running' : 'paused',
              opacity: armed ? 1 : 0
            } as CSSProperties
          }
        />
        <span
          className={`flow-wire-dot flow-wire-dot-x ${dot}`}
          style={
            {
              '--packet-duration': `${duration}s`,
              '--packet-delay': `-${duration / 2}s`,
              animationPlayState: armed ? 'running' : 'paused',
              opacity: armed ? 1 : 0
            } as CSSProperties
          }
        />
      </div>
      <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span
          className={`bg-content px-1.5 font-maple text-[10px] tracking-wide ${text}`}
        >
          {label}
        </span>
      </span>
    </div>
  )
}

function Fork({ label, armed = true }: { label: string; armed?: boolean }) {
  return (
    <div className="relative flex h-9 items-stretch justify-center">
      <div
        className={`relative w-px origin-top bg-[color-mix(in_srgb,var(--hrack-status-working)_40%,transparent)] transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          armed ? 'scale-y-100' : 'scale-y-0'
        }`}
      >
        <span
          className="flow-wire-dot flow-wire-dot-y bg-status-working-dot"
          style={
            {
              '--packet-duration': '2.2s',
              '--packet-delay': '-0.4s',
              animationPlayState: armed ? 'running' : 'paused',
              opacity: armed ? 1 : 0
            } as CSSProperties
          }
        />
      </div>
      <span className="absolute top-1/2 left-[calc(50%+10px)] -translate-y-1/2 whitespace-nowrap font-maple text-[10px] tracking-wide text-status-working">
        {label}
      </span>
    </div>
  )
}

function VWire({
  label,
  tone = 'neutral'
}: {
  label: string
  tone?: 'neutral' | 'signal'
}) {
  const line =
    tone === 'signal'
      ? 'bg-[color-mix(in_srgb,var(--hrack-status-working)_40%,transparent)]'
      : 'bg-border-strong'
  const text = tone === 'signal' ? 'text-status-working' : 'text-text-faint'

  return (
    <div className="flex flex-col items-center py-2">
      <div className={`h-6 w-px ${line}`} />
      <span className={`py-1 font-maple text-[10px] tracking-wide ${text}`}>
        {label}
      </span>
      <div className={`h-6 w-px ${line}`} />
    </div>
  )
}

export function Flow() {
  const { strings } = useLang()
  const n = strings.flow.nodes
  const diagramRef = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const armed = useInView(diagramRef, { once: true, amount: 0.35 }) || Boolean(reduce)

  return (
    <section
      id="flow"
      className="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28"
    >
      <Reveal>
        <Eyebrow>flow</Eyebrow>
        <h2 className="mt-3 max-w-2xl text-[26px] leading-snug font-semibold tracking-tight text-text-primary sm:text-[32px]">
          {strings.flow.heading}
        </h2>
        <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-text-muted">
          {strings.flow.intro}
        </p>
      </Reveal>

      <Reveal delay={0.08}>
        <div
          ref={diagramRef}
          className="mt-10 overflow-hidden rounded-2xl border border-border-default bg-content"
        >
          <div className="hidden px-6 py-6 md:block lg:px-8">
            <div className="grid grid-cols-[minmax(8.75rem,11rem)_minmax(3.5rem,1fr)_minmax(8.75rem,11rem)_minmax(3.5rem,1fr)_minmax(10.5rem,13.5rem)] grid-rows-[auto_auto_auto] items-center">
              <Node label={n.cli} origin />
              <div className="col-span-3 px-3">
                <Wire label="pty · bytes" duration={3.2} armed={armed} />
              </div>
              <Node label={n.tui} />

              <Fork label="hooks · sse · extension" armed={armed} />
              <div className="col-span-4" />

              <Node label={n.adapter} />
              <div className="px-3">
                <Wire label="translate" tone="signal" duration={1.6} armed={armed} />
              </div>
              <Node label={n.status} />
              <div className="px-3">
                <Wire label="sync" tone="signal" duration={1.5} armed={armed} />
              </div>
              <Node label={n.surfaces} />
            </div>
          </div>

          <div className="flex flex-col items-stretch px-5 py-5 md:hidden">
            <Node label={n.cli} origin />
            <VWire label="pty · bytes" />
            <Node label={n.tui} />
            <VWire label="hooks · sse · extension" tone="signal" />
            <Node label={n.adapter} />
            <VWire label="translate" tone="signal" />
            <Node label={n.status} />
            <VWire label="sync" tone="signal" />
            <Node label={n.surfaces} />
          </div>

          <motion.ol
            className="grid grid-cols-1 gap-px border-t border-border-default bg-border-default md:grid-cols-3"
            initial={reduce ? false : 'hidden'}
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={{
              hidden: {},
              show: { transition: { staggerChildren: 0.08 } }
            }}
          >
            {strings.flow.steps.map((step, index) => (
              <motion.li
                key={step.title}
                variants={fadeUpItem}
                className="bg-content px-5 py-5"
              >
                <p className="font-maple text-[11px] text-text-faint tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </p>
                <h3 className="mt-2 text-[15px] font-semibold tracking-tight text-text-primary">
                  {step.title}
                </h3>
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                  {step.desc}
                </p>
              </motion.li>
            ))}
          </motion.ol>
        </div>
      </Reveal>

      <Reveal delay={0.12}>
        <p className="mt-5 flex items-start gap-2 text-[13px] leading-relaxed text-text-strong">
          <ShieldCheck
            className="mt-0.5 size-4 shrink-0 text-status-done"
            strokeWidth={1.75}
          />
          {strings.flow.safety}
        </p>
      </Reveal>
    </section>
  )
}
