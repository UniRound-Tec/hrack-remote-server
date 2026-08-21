'use client'

import { useLang } from '@/i18n/lang-context'
import { ShieldCheck } from 'lucide-react'
import { Eyebrow, Reveal } from './Reveal'

/**
 * 旁路观察管线图（README ASCII 图的活性化）：
 * 上路 PTY 传字节（中性色），下路 Hooks/SSE/Extension 传信号（工作蓝）。
 * 信号点用 SMIL animateMotion 沿路径流动；reduced-motion 时隐藏信号点。
 */
const PTY_PATH = 'M150,112 C 260,112 400,44 520,44'
const FORK_PATH = 'M84,152 C 84,196 120,206 168,206'
const MID_PATH = 'M278,206 H 340'
const OUT_PATH = 'M462,206 H 508'

function Node({
  x,
  y,
  w,
  h,
  label,
  strong = false
}: {
  x: number
  y: number
  w: number
  h: number
  label: string
  strong?: boolean
}) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={10}
        fill="var(--hrack-bg-surface)"
        stroke={
          strong
            ? 'var(--hrack-border-strong)'
            : 'var(--hrack-border-default)'
        }
      />
      <foreignObject x={x} y={y} width={w} height={h}>
        <div
          style={{
            display: 'flex',
            height: '100%',
            width: '100%',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '0 8px',
            textAlign: 'center',
            fontSize: 12.5,
            lineHeight: 1.3,
            color: 'var(--hrack-text-secondary)'
          }}
        >
          {label}
        </div>
      </foreignObject>
    </g>
  )
}

function Lane({
  d,
  label,
  labelX,
  labelY,
  color
}: {
  d: string
  label: string
  labelX: number
  labelY: number
  color: string
}) {
  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke="var(--hrack-border-strong)"
        strokeWidth="1"
        className="flow-lane"
      />
      <text
        x={labelX}
        y={labelY}
        className="font-maple"
        fontSize="9"
        fill={color}
        textAnchor="middle"
      >
        {label}
      </text>
    </g>
  )
}

function Packet({
  d,
  begin,
  dur,
  color,
  r = 3
}: {
  d: string
  begin: string
  dur: number
  color: string
  r?: number
}) {
  return (
    <circle r={r} fill={color} className="flow-packet-smil">
      <animateMotion dur={`${dur}s`} begin={begin} repeatCount="indefinite" path={d} />
    </circle>
  )
}

export function Flow() {
  const { strings } = useLang()
  const n = strings.flow.nodes

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
        <div className="mt-10 overflow-x-auto rounded-2xl border border-border-default bg-content p-4 shadow-[0_20px_50px_-30px_var(--hrack-shadow-popover)] sm:p-6">
          <svg
            viewBox="0 0 672 240"
            className="h-auto w-full min-w-[560px]"
            role="img"
            aria-label={strings.flow.heading}
          >
            {/* 上路：PTY 字节流（中性） */}
            <Lane d={PTY_PATH} label="pty · bytes" labelX={330} labelY={92} color="var(--hrack-text-faint)" />
            {/* 下路：事件信号（工作蓝） */}
            <Lane d={FORK_PATH} label="hooks · sse · extension" labelX={128} labelY={176} color="var(--hrack-status-working)" />
            <Lane d={MID_PATH} label="translate" labelX={309} labelY={196} color="var(--hrack-status-working)" />
            <Lane d={OUT_PATH} label="sync" labelX={485} labelY={196} color="var(--hrack-status-working)" />

            <Node x={24} y={94} w={120} h={56} label={n.cli} strong />
            <Node x={520} y={20} w={120} h={48} label={n.tui} />
            <Node x={168} y={182} w={110} h={48} label={n.adapter} />
            <Node x={340} y={182} w={122} h={48} label={n.status} />
            <Node x={508} y={178} w={140} h={56} label={n.surfaces} />

            {/* 字节流包（中性深色） */}
            <Packet d={PTY_PATH} begin="0s" dur={3.4} color="var(--hrack-accent-spark)" />
            <Packet d={PTY_PATH} begin="-1.7s" dur={3.4} color="var(--hrack-accent-spark)" />
            {/* 事件信号包（工作蓝） */}
            <Packet d={FORK_PATH} begin="-0.5s" dur={2.6} color="var(--hrack-status-working-dot)" r={3.5} />
            <Packet d={FORK_PATH} begin="-1.9s" dur={2.6} color="var(--hrack-status-working-dot)" r={3.5} />
            <Packet d={MID_PATH} begin="-1.2s" dur={1.4} color="var(--hrack-status-working-dot)" r={3.5} />
            <Packet d={OUT_PATH} begin="-0.4s" dur={1.3} color="var(--hrack-status-working-dot)" r={3.5} />
          </svg>
        </div>
      </Reveal>

      <ol className="mt-8 grid grid-cols-1 gap-3 md:grid-cols-3">
        {strings.flow.steps.map((step, index) => (
          <Reveal key={step.title} delay={0.1 + index * 0.08}>
            <li className="h-full rounded-xl border border-border-subtle bg-content p-5">
              <p className="font-maple text-[11px] text-text-faint tabular-nums">
                {String(index + 1).padStart(2, '0')}
              </p>
              <h3 className="mt-2.5 text-[16px] font-semibold tracking-tight text-text-primary">
                {step.title}
              </h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-text-muted">
                {step.desc}
              </p>
            </li>
          </Reveal>
        ))}
      </ol>

      <Reveal delay={0.15}>
        <p className="mt-6 flex items-start gap-2 text-[13px] leading-relaxed text-text-strong">
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
