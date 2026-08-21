'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

/** 滚动入场：一次性、轻位移淡入；reduced-motion 直接呈现。 */
export function Reveal({
  children,
  delay = 0,
  y = 14,
  className
}: {
  children: ReactNode
  delay?: number
  y?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** 区块眉标：HRack 应用同款 maple 大写微标签。 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-maple text-[10px] font-medium tracking-[0.28em] text-text-faint uppercase">
      {children}
    </p>
  )
}
