import ClaudeCode from '@lobehub/icons/es/ClaudeCode/components/Mono'
import Codex from '@lobehub/icons/es/Codex/components/Mono'
import DeepSeek from '@lobehub/icons/es/DeepSeek/components/Mono'
import Grok from '@lobehub/icons/es/Grok/components/Mono'
import Kimi from '@lobehub/icons/es/Kimi/components/Mono'
import OpenCode from '@lobehub/icons/es/OpenCode/components/Mono'
import Pi from '@lobehub/icons/es/Pi/components/Mono'
import type { ComponentType, SVGProps } from 'react'

export type BrandIcon = ComponentType<
  SVGProps<SVGSVGElement> & { size?: number | string }
>

/** 主仓 src/app/adapterIcons.ts 中落地页用到的子集。 */
const adapterIcons: Record<string, BrandIcon> = {
  dsh: DeepSeek,
  codex: Codex,
  'claude-code': ClaudeCode,
  opencode: OpenCode,
  kimi: Kimi,
  grok: Grok,
  pi: Pi
}

export function getAdapterIcon(adapterId: string): BrandIcon {
  return adapterIcons[adapterId] ?? ClaudeCode
}
