'use client'

import { ChevronDown, X } from 'lucide-react'
import { useLang } from '@/i18n/lang-context'
import { getAdapterIcon } from '@/lib/adapterIcons'
import { statusDot, statusLabel, statusTone } from '@/lib/session-status'
import type { RackRuntimeState } from '@/lib/rack-script'
import { Brand } from './Brand'

/**
 * 签名元素：活的 rack。
 * 结构镜像主仓 Sidebar 会话卡；折叠 / 关闭复刻主仓 FloatingApp。
 */
export function Rack({
  states,
  attentionCount = 0,
  onClose,
  expand
}: {
  states: readonly RackRuntimeState[]
  attentionCount?: number
  onClose?: () => void
  expand?: {
    expanded: boolean
    total: number
    onToggle: () => void
  }
}) {
  const { strings } = useLang()

  return (
    <div
      data-testid="rack-panel"
      data-attention={attentionCount > 0 ? 'persistent' : 'none'}
      className={`overflow-hidden rounded-2xl border border-border-default bg-content shadow-[0_28px_70px_-28px_var(--hrack-shadow-popover)] ${
        attentionCount > 0 ? 'attention-persistent' : ''
      }`}
    >
      <div className="flex items-center gap-2 border-b border-border-faint px-3.5 py-2.5">
        <Brand className="text-[18px]" />
        {attentionCount > 0 && (
          <span className="text-[10px] font-medium text-status-needs-you">
            <span data-testid="floating-attention-count">{attentionCount}</span>{' '}
            {strings.rack.attention}
          </span>
        )}
        <p className="ml-auto font-maple text-[10px] tracking-[0.22em] text-text-faint uppercase">
          {strings.rack.heading}
        </p>
        {onClose && (
          <button
            type="button"
            data-testid="floating-close"
            aria-label={strings.rack.close}
            title={strings.rack.close}
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onClose}
            className="flex size-5 shrink-0 items-center justify-center rounded-md text-text-faint transition-colors hover:bg-surface-hover hover:text-text-secondary"
          >
            <X className="size-3" strokeWidth={1.75} />
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1.5 p-2.5">
        {states.map((state) => (
          <RackCard key={state.script.adapterId} state={state} />
        ))}
      </ul>
      {expand && (
        <button
          type="button"
          data-testid="floating-expand"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={expand.onToggle}
          className="flex w-full items-center justify-center gap-1 border-t border-border-faint py-1.5 text-[11px] text-text-faint transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          <ChevronDown
            className={`size-3 transition-transform ${expand.expanded ? 'rotate-180' : ''}`}
            strokeWidth={1.75}
          />
          {expand.expanded
            ? strings.rack.collapse
            : strings.rack.expand(expand.total)}
        </button>
      )}
    </div>
  )
}

function cardShell(status: RackRuntimeState['status']): string {
  if (status === 'needs-you') {
    return 'attention-persistent border-border-default bg-surface-hover'
  }
  if (status === 'done') {
    return 'attention-complete border-border-default bg-content'
  }
  return 'border-transparent bg-content hover:border-border-subtle'
}

function RackCard({ state }: { state: RackRuntimeState }) {
  const { strings } = useLang()
  const Icon = getAdapterIcon(state.script.adapterId)
  const elapsed = Math.floor(state.stepElapsed / 1000)

  return (
    <li
      className={`flex flex-col gap-0.5 rounded-xl border px-3.5 py-2.5 transition-colors ${cardShell(state.status)}`}
    >
      <div className="flex min-w-0 items-center gap-2">
        <span className="inline-flex size-4 shrink-0 items-center justify-center">
          <Icon size={15} />
        </span>
        <span className="truncate text-[13px] font-semibold text-text-primary">
          {state.script.name}
        </span>
        <span className="font-maple text-[10px] whitespace-nowrap text-text-faint">
          {state.script.adapterId}
        </span>
        <span
          className={`size-1.5 shrink-0 rounded-full ${statusDot[state.status]}`}
        />
        <span className="ml-auto shrink-0 font-maple text-[10px] text-text-faint tabular-nums">
          {elapsed}s
        </span>
      </div>
      <div className="flex min-w-0 items-baseline justify-between gap-3 pl-6">
        <p
          className={`truncate font-maple text-[11px] leading-snug ${statusTone[state.status]}`}
        >
          {state.status === 'needs-you' && (
            <span className="mr-1.5 select-none" aria-hidden>
              ↩
            </span>
          )}
          {state.detail}
        </p>
        <p
          className={`shrink-0 text-[11px] font-medium ${statusTone[state.status]}`}
        >
          {statusLabel(state.status, strings)}
        </p>
      </div>
    </li>
  )
}
