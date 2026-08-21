'use client'

import ShinyText from '@/effects/ShinyText'

/** HRack 品牌字标：Ammonite 子集字体 + 光带扫过（与主仓侧栏同一参数风格）。 */
export function Brand({ className = '' }: { className?: string }) {
  return (
    <ShinyText
      text="hrack"
      color="var(--hrack-brand-logo)"
      shineColor="var(--hrack-brand-logoShine)"
      speed={3.2}
      spread={100}
      className={`font-brand leading-none tracking-[0.08em] ${className}`}
    />
  )
}
