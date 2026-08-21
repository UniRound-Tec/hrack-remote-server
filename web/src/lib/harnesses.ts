/**
 * 深度接入的 Harness 注册表 — 数据来自主仓 README 支持表。
 * integration / runtime 为设计性微标签，保持英文（与主仓 i18n 约定一致）。
 */
export interface HarnessDef {
  id: string
  name: string
  /** 接入方式（README 表第二列） */
  integration: string
  /** strings.harnesses.statuses 的 key */
  statusesKey: string
  runtimes: readonly ('host' | 'wsl')[]
}

export const deepHarnesses: readonly HarnessDef[] = [
  {
    id: 'dsh',
    name: 'DeepSeek Harness',
    integration: 'web surface + runtime bridge',
    statusesKey: 'dsh',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'claude-code',
    name: 'Claude Code',
    integration: 'official hooks',
    statusesKey: 'claude-code',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'codex',
    name: 'Codex CLI',
    integration: 'stable hooks',
    statusesKey: 'codex',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'opencode',
    name: 'OpenCode',
    integration: 'server + sse',
    statusesKey: 'opencode',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'pi',
    name: 'Pi',
    integration: 'extension api',
    statusesKey: 'pi',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'kimi',
    name: 'Kimi Code',
    integration: 'official hooks',
    statusesKey: 'kimi',
    runtimes: ['host', 'wsl']
  },
  {
    id: 'grok',
    name: 'Grok Build',
    integration: 'official hooks',
    statusesKey: 'grok',
    runtimes: ['host', 'wsl']
  }
]
