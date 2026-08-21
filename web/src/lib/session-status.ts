import type { LandingStrings } from '@/i18n'

/**
 * 主仓 src/app/sessionStatus.ts 的六态契约（SPEC-S §3.3）。
 * statusDot 的 working 呼吸动画改为 .dot-breathe（主仓用 animate-pulse）。
 */
export const sessionStatuses = [
  'working',
  'needs-you',
  'done',
  'error',
  'idle',
  'exited'
] as const

export type SessionStatus = (typeof sessionStatuses)[number]

export const statusDot: Record<SessionStatus, string> = {
  working: 'bg-status-working-dot dot-breathe',
  'needs-you': 'bg-status-needs-you-dot',
  done: 'bg-status-done-dot',
  error: 'bg-status-error-dot',
  idle: 'bg-status-idle-dot',
  exited: 'border border-status-exited bg-transparent'
}

export const statusTone: Record<SessionStatus, string> = {
  working: 'text-status-working',
  'needs-you': 'text-status-needs-you',
  done: 'text-status-done',
  error: 'text-status-error',
  idle: 'text-status-idle',
  exited: 'text-status-exited'
}

/** 状态 → CSS 变量（SVG / 内联样式用）。 */
export const statusColor: Record<SessionStatus, string> = {
  working: 'var(--hrack-status-working)',
  'needs-you': 'var(--hrack-status-needsYou)',
  done: 'var(--hrack-status-done)',
  error: 'var(--hrack-status-error)',
  idle: 'var(--hrack-status-idle)',
  exited: 'var(--hrack-status-exited)'
}

const statusStringKey: Record<
  SessionStatus,
  keyof LandingStrings['status']
> = {
  working: 'working',
  'needs-you': 'needsYou',
  done: 'done',
  error: 'error',
  idle: 'idle',
  exited: 'exited'
}

export function statusLabel(
  status: SessionStatus,
  strings: LandingStrings
): string {
  return strings.status[statusStringKey[status]]
}
