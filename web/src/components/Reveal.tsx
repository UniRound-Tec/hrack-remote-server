'use client'

import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'

const EASE = [0.22, 1, 0.36, 1] as const

/** 滚动入场：一次性、轻位移淡入；reduced-motion 直接呈现。 */
export function Reveal({
  children,
  delay = 0,
  y = 16,
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
      viewport={{ once: true, amount: 0.22, margin: '0px 0px -8% 0px' }}
      transition={{ duration: 0.65, delay, ease: EASE }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/** 子项依次入场。 */
export function Stagger({
  children,
  delay = 0,
  className
}: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const reduce = useReducedMotion()
  if (reduce) return <div className={className}>{children}</div>
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.16, margin: '0px 0px -6% 0px' }}
      variants={{
        hidden: {},
        show: {
          transition: { staggerChildren: 0.07, delayChildren: delay }
        }
      }}
    >
      {children}
    </motion.div>
  )
}

export const fadeUpItem = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: EASE }
  }
}

/** 区块眉标：HRack 应用同款 maple 大写微标签。 */
export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="font-maple text-[10px] font-medium tracking-[0.28em] text-text-faint uppercase">
      {children}
    </p>
  )
}
