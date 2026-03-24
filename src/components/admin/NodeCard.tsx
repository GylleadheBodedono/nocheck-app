'use client'

import React, { useState, useRef, useCallback, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type NodeItem = {
  id: number | string
  label: string
  checked?: boolean
  color?: string
  icon?: React.ReactNode
}

type Props = {
  title: string
  icon: React.ReactNode
  items: NodeItem[]
  onToggle?: (id: number | string) => void
  selectable?: boolean
  position: 'left' | 'right'
  className?: string
  draggable?: boolean
  onPositionChange?: (x: number, y: number) => void
  initialPosition?: { x: number; y: number }
  onHeaderClick?: () => void
}

// ─── Component ──────────────────────────────────────────────────────────────

/**
 * Card de nó arrastável para o editor visual de templates.
 * Representa um grupo (ex: seção ou template) com lista de itens selecionáveis.
 * Suporta drag-and-drop via eventos de mouse para reposicionamento no canvas.
 */
export function NodeCard({
  title,
  icon,
  items,
  onToggle,
  selectable = false,
  position,
  className = '',
  draggable = false,
  onPositionChange,
  initialPosition,
  onHeaderClick,
}: Props) {
  const [isDragging, setIsDragging] = useState(false)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [pos, setPos] = useState(initialPosition || { x: 0, y: 0 })
  const cardRef = useRef<HTMLDivElement>(null)

  // Sync with external initialPosition changes
  useEffect(() => {
    if (initialPosition) setPos(initialPosition)
  }, [initialPosition])

  const getClientXY = (e: MouseEvent | TouchEvent) => {
    if ('touches' in e) {
      const t = e.touches[0] || e.changedTouches[0]
      return { x: t.clientX, y: t.clientY }
    }
    return { x: e.clientX, y: e.clientY }
  }

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!draggable || !cardRef.current) return
      // Nao iniciar drag se clicou no botao de expand
      if ((e.target as HTMLElement).closest('button')) return
      e.preventDefault()
      const nativeEvent = e.nativeEvent as MouseEvent | TouchEvent
      const { x, y } = getClientXY(nativeEvent)
      const rect = cardRef.current.getBoundingClientRect()
      setOffset({ x: x - rect.left, y: y - rect.top })
      setIsDragging(true)
    },
    [draggable],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      e.preventDefault()
      const { x, y } = getClientXY(e)
      if (!cardRef.current) return
      const parent = cardRef.current.parentElement
      if (!parent) return
      const parentRect = parent.getBoundingClientRect()
      const newX = x - parentRect.left - offset.x
      const newY = y - parentRect.top - offset.y
      setPos({ x: newX, y: newY })
    }

    const handleUp = () => {
      setIsDragging(false)
      onPositionChange?.(pos.x, pos.y)
    }

    window.addEventListener('mousemove', handleMove, { passive: false })
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('mouseup', handleUp)
    window.addEventListener('touchend', handleUp)

    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('mouseup', handleUp)
      window.removeEventListener('touchend', handleUp)
    }
  }, [isDragging, offset, pos.x, pos.y, onPositionChange])

  const dragStyles: React.CSSProperties = draggable
    ? {
        transform: `translate(${pos.x}px, ${pos.y}px)`,
        transition: isDragging ? 'none' : 'transform 0.05s ease',
        position: 'relative' as const,
        zIndex: isDragging ? 50 : undefined,
      }
    : {}

  return (
    <div
      ref={cardRef}
      data-node-id={`${position}-${title.toLowerCase().replace(/\s+/g, '-')}`}
      className={`w-52 bg-surface border border-subtle rounded-xl shadow-sm flex flex-col ${className}`}
      style={dragStyles}
    >
      {/* Header */}
      <div
        className={`flex items-center gap-2 px-3 py-2.5 border-b border-subtle${
          draggable ? (isDragging ? ' cursor-grabbing' : ' cursor-grab') : ''
        }`}
        onMouseDown={draggable ? handlePointerDown : undefined}
        onTouchStart={draggable ? handlePointerDown : undefined}
      >
        <span className="text-muted shrink-0">{icon}</span>
        <h3 className="text-sm font-semibold text-secondary truncate">{title}</h3>
        <span className="text-[10px] text-muted tabular-nums ml-auto">{items.length}</span>
        {onHeaderClick && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onHeaderClick() }}
            className="p-1 text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors shrink-0"
            title={`Configurar ${title}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          </button>
        )}
      </div>

      {/* Items list */}
      <div className="overflow-y-auto max-h-[200px] py-1">
        {items.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted italic">Nenhum item.</p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className="flex items-center gap-2 px-3 py-1.5 hover:bg-primary/5 transition-colors"
          >
            {/* Checkbox or dot indicator */}
            {selectable ? (
              <input
                type="checkbox"
                checked={item.checked ?? false}
                onChange={() => onToggle?.(item.id)}
                className="rounded border-default bg-surface text-primary focus:ring-primary w-3 h-3 shrink-0 cursor-pointer"
              />
            ) : (
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: item.color || 'var(--color-text-muted)' }}
              />
            )}

            {/* Icon */}
            {item.icon && (
              <span className="text-muted shrink-0">{item.icon}</span>
            )}

            {/* Label */}
            <span className="text-xs text-main truncate">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
