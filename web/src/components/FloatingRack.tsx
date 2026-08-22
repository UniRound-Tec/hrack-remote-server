'use client'

import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { useLang } from '@/i18n/lang-context'
import { useRack } from '@/lib/use-rack'
import { Brand } from './Brand'
import { Rack } from './Rack'

/** 与主仓 `FloatingApp` 收起态一致：默认露出 3 条。 */
const COLLAPSED_COUNT = 3

/**
 * 活的悬浮窗：从产品截图里抽出来，fixed 铺在视口上。
 * 交互复刻主仓 FloatingApp：顶栏拖动、收起 3 条 / 展开全部、关闭。
 * 关闭后留一枚芯片，避免落地页签名元素再也回不来。
 */
export function FloatingRack() {
  const { strings } = useLang()
  const states = useRack()
  const containerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [open, setOpen] = useState(true)
  const dragRef = useRef<{
    startX: number
    startY: number
    x0: number
    y0: number
  } | null>(null)

  const visible = expanded ? states : states.slice(0, COLLAPSED_COUNT)
  const attentionCount = states.filter(
    (state) => state.status === 'needs-you' || state.status === 'error'
  ).length

  useLayoutEffect(() => {
    const panel = panelRef.current
    const container = containerRef.current
    if (!panel || !container || !pos) return
    const maxX = Math.max(0, container.clientWidth - panel.offsetWidth)
    const maxY = Math.max(0, container.clientHeight - panel.offsetHeight)
    if (pos.x > maxX || pos.y > maxY) {
      setPos({ x: Math.min(pos.x, maxX), y: Math.min(pos.y, maxY) })
    }
  }, [expanded, open, pos])

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!open || event.button !== 0) return
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
        ref={panelRef}
        role={open ? 'dialog' : undefined}
        aria-label={strings.hero.rackLabel}
        className={`pointer-events-auto absolute top-[34%] right-[6%] w-[300px] select-none sm:w-[320px] ${
          open ? 'cursor-grab touch-none active:cursor-grabbing' : ''
        }`}
        style={pos ? { left: pos.x, top: pos.y, right: 'auto' } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        {open ? (
          <div>
            <Rack
              states={visible}
              attentionCount={attentionCount}
              onClose={() => setOpen(false)}
              expand={
                states.length > COLLAPSED_COUNT
                  ? {
                      expanded,
                      total: states.length,
                      onToggle: () => setExpanded((value) => !value)
                    }
                  : undefined
              }
            />
          </div>
        ) : (
          <button
            type="button"
            data-testid="floating-reopen"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={() => {
              setOpen(true)
              setExpanded(false)
            }}
            className="hrack-press flex w-full cursor-pointer items-center gap-2 rounded-full border border-border-default bg-content px-3.5 py-2 shadow-[0_16px_36px_-12px_var(--hrack-shadow-popover)] hover:border-border-strong"
          >
            <Brand className="text-[16px]" />
            <span className="font-maple text-[10px] tracking-wide text-text-faint">
              {strings.rack.reopen}
            </span>
            {attentionCount > 0 && (
              <span className="ml-auto text-[10px] font-medium text-status-needs-you">
                {attentionCount} {strings.rack.attention}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  )
}
