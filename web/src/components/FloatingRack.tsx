'use client'

import { useRef, useState, type PointerEvent } from 'react'
import { useRack } from '@/lib/use-rack'
import { Rack } from './Rack'

/**
 * 悬浮在页面上的“活的悬浮窗”：复用 Rack 面板（hrack 标题栏 + 实时会话卡），
 * 真实可拖动 —— Pointer Events + setPointerCapture（鼠标/触屏均可）。
 * 以整个视口为边界（fixed 层），可拖出 hero 的 max-width 范围、任意移动；
 * 滚动时悬浮窗跟随视口，行为与主窗口的悬浮监控一致。
 */
export function FloatingRack() {
  const states = useRack()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{
    startX: number
    startY: number
    x0: number
    y0: number
  } | null>(null)

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    const target = event.currentTarget
    const container = containerRef.current
    if (!container) return
    target.setPointerCapture(event.pointerId)
    const rect = target.getBoundingClientRect()
    const base = pos ?? {
      x: rect.left - container.getBoundingClientRect().left,
      y: rect.top - container.getBoundingClientRect().top
    }
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      x0: base.x,
      y0: base.y
    }
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const container = containerRef.current
    if (!drag || !container) return
    const maxX = Math.max(0, container.clientWidth - event.currentTarget.offsetWidth)
    const maxY = Math.max(0, container.clientHeight - event.currentTarget.offsetHeight)
    const x = Math.min(Math.max(drag.x0 + event.clientX - drag.startX, 0), maxX)
    const y = Math.min(Math.max(drag.y0 + event.clientY - drag.startY, 0), maxY)
    setPos({ x, y })
  }

  const handlePointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    dragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed inset-0 z-[60]"
    >
      <div
        role="dialog"
        aria-label="HRack 悬浮监控（可拖动）"
        className="pointer-events-auto absolute top-[34%] right-[6%] w-[300px] cursor-grab touch-none select-none active:cursor-grabbing sm:w-[320px]"
        style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <Rack states={states} />
      </div>
    </div>
  )
}
