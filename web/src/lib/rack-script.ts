import type { SessionStatus } from './session-status'

/**
 * Rack 实时模拟的剧本引擎。
 *
 * 每个会话是一段手写的状态时间线（步骤 = 状态 + 时长 + 终端风格说明行），
 * 驱动器用绝对时间取模推进 —— 无漂移、无定时器链，任何时刻刷新页面都在演。
 * 说明行是终端风格设计元素，各语言保持英文（与主仓微标签约定一致）。
 */
export interface RackStep {
  status: SessionStatus
  /** 该步骤停留时长（毫秒） */
  duration: number
  /** 说明行（maple mono 小字） */
  detail: string
}

export interface RackSessionScript {
  adapterId: string
  name: string
  /** 开场延迟：错开各卡相位，rack 任何时刻都异构 */
  startDelay: number
  steps: RackStep[]
}

export interface RackRuntimeState {
  script: RackSessionScript
  stepIndex: number
  status: SessionStatus
  detail: string
  /** 当前步骤已进行毫秒 */
  stepElapsed: number
}

export const rackScripts: readonly RackSessionScript[] = [
  {
    adapterId: 'claude-code',
    name: 'refactor-auth',
    startDelay: 0,
    steps: [
      { status: 'working', duration: 5200, detail: 'edit src/auth/session.ts' },
      { status: 'needs-you', duration: 6400, detail: 'approve · rm -rf dist/' },
      { status: 'working', duration: 3600, detail: 'run pnpm test' },
      { status: 'done', duration: 3200, detail: 'turn complete' },
      { status: 'idle', duration: 1400, detail: 'watching' }
    ]
  },
  {
    adapterId: 'codex',
    name: 'fix-ws-proxy',
    startDelay: 3400,
    steps: [
      { status: 'working', duration: 4600, detail: 'read proxy/relay.ts' },
      { status: 'working', duration: 3800, detail: 'patch heartbeat' },
      { status: 'needs-you', duration: 5600, detail: 'approve · pnpm i ws@8' },
      { status: 'working', duration: 4200, detail: 'run e2e smoke' },
      { status: 'done', duration: 3000, detail: 'turn complete' },
      { status: 'idle', duration: 1200, detail: 'watching' }
    ]
  },
  {
    adapterId: 'dsh',
    name: 'landing-copy',
    startDelay: 7100,
    steps: [
      { status: 'working', duration: 6200, detail: 'draft hero copy' },
      { status: 'done', duration: 2600, detail: 'turn complete' },
      { status: 'working', duration: 4400, detail: 'review diff' },
      { status: 'error', duration: 4200, detail: 'exit 1 · vitest run' },
      { status: 'working', duration: 3200, detail: 'fix fixture' },
      { status: 'done', duration: 3000, detail: 'turn complete' }
    ]
  },
  {
    adapterId: 'opencode',
    name: 'api-client',
    startDelay: 10800,
    steps: [
      { status: 'working', duration: 3800, detail: 'gen openapi types' },
      { status: 'needs-you', duration: 5000, detail: 'question · retry policy?' },
      { status: 'working', duration: 5400, detail: 'write client tests' },
      { status: 'done', duration: 2800, detail: 'turn complete' },
      { status: 'idle', duration: 1600, detail: 'watching' }
    ]
  },
  {
    adapterId: 'kimi',
    name: 'test-matrix',
    startDelay: 14200,
    steps: [
      { status: 'working', duration: 4400, detail: 'run matrix · node 20/22' },
      { status: 'working', duration: 3600, detail: 'collect coverage' },
      { status: 'done', duration: 3000, detail: 'turn complete' },
      { status: 'idle', duration: 1400, detail: 'watching' }
    ]
  },
  {
    adapterId: 'grok',
    name: 'migrate-db',
    startDelay: 17600,
    steps: [
      { status: 'working', duration: 5600, detail: 'plan schema diff' },
      { status: 'error', duration: 4000, detail: 'exit 1 · deadlock' },
      { status: 'working', duration: 4000, detail: 'retry migration' },
      { status: 'needs-you', duration: 5200, detail: 'approve · DROP INDEX' },
      { status: 'done', duration: 3200, detail: 'turn complete' }
    ]
  }
]

/**
 * reduced-motion 下的静态快照时刻（毫秒）：t=9000 时恰好 needs-you、error、
 * working、done 同框，是最有代表性的一帧，也是 SSR/客户端一致的首帧。
 */
export const RACK_FROZEN_AT = 9_000

function stateAt(script: RackSessionScript, t: number): RackRuntimeState {
  const total = script.steps.reduce((sum, step) => sum + step.duration, 0)
  let local = (t - script.startDelay) % total
  if (local < 0) local += total
  for (let index = 0; index < script.steps.length; index += 1) {
    const step = script.steps[index]
    if (local < step.duration) {
      return {
        script,
        stepIndex: index,
        status: step.status,
        detail: step.detail,
        stepElapsed: local
      }
    }
    local -= step.duration
  }
  const last = script.steps[script.steps.length - 1]
  return {
    script,
    stepIndex: script.steps.length - 1,
    status: last.status,
    detail: last.detail,
    stepElapsed: 0
  }
}

export function rackStateAt(t: number): RackRuntimeState[] {
  return rackScripts.map((script) => stateAt(script, t))
}
