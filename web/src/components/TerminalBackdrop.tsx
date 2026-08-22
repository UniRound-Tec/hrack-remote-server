'use client'

import { useReducedMotion } from 'motion/react'
import FaultyTerminal from './FaultyTerminal'

/**
 * 全局 FaultyTerminal 背景。参数对齐 react-bits 面板；
 * 着色器输出透明通道，叠在 HRack Light 浅底上只留下数字残影。
 */
export function TerminalBackdrop() {
  const reduce = useReducedMotion()

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden mix-blend-multiply"
    >
      <FaultyTerminal
        className="h-full w-full"
        tint="#6f6f6f"
        scale={1.5}
        digitSize={1.2}
        timeScale={0.5}
        noiseAmp={1}
        brightness={1}
        scanlineIntensity={0.5}
        curvature={0.1}
        mouseStrength={0.5}
        mouseReact={!reduce}
        pageLoadAnimation={!reduce}
        pause={Boolean(reduce)}
      />
    </div>
  )
}
