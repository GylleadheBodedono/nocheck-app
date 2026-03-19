'use client'

import React, { useEffect, useState, useCallback, useRef } from 'react'

// ─── Types ──────────────────────────────────────────────────────────────────

type Connection = {
  from: string   // data-node-id of source
  to: string     // data-node-id of target
  color?: string
}

type Props = {
  connections: Connection[]
  containerRef: React.RefObject<HTMLDivElement | null>
}

type LineCoords = {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
}

// ─── Component ──────────────────────────────────────────────────────────────

export function ConnectionLines({ connections, containerRef }: Props) {
  const [lines, setLines] = useState<LineCoords[]>([])
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })
  const rafRef = useRef<number>(0)

  const recalculate = useCallback(() => {
    const container = containerRef.current
    if (!container) return

    const containerRect = container.getBoundingClientRect()
    setDimensions({
      width: containerRect.width,
      height: containerRect.height,
    })

    const newLines: LineCoords[] = []

    for (const conn of connections) {
      const fromEl = container.querySelector(`[data-node-id="${conn.from}"]`)
      const toEl = container.querySelector(`[data-node-id="${conn.to}"]`)
      if (!fromEl || !toEl) continue

      const fromRect = fromEl.getBoundingClientRect()
      const toRect = toEl.getBoundingClientRect()

      // Determine which side to connect from/to based on relative position
      let x1: number, y1: number, x2: number, y2: number

      if (fromRect.right <= toRect.left) {
        // from is left of to: connect right edge -> left edge
        x1 = fromRect.right - containerRect.left
        y1 = fromRect.top + fromRect.height / 2 - containerRect.top
        x2 = toRect.left - containerRect.left
        y2 = toRect.top + toRect.height / 2 - containerRect.top
      } else if (fromRect.left >= toRect.right) {
        // from is right of to: connect left edge -> right edge
        x1 = fromRect.left - containerRect.left
        y1 = fromRect.top + fromRect.height / 2 - containerRect.top
        x2 = toRect.right - containerRect.left
        y2 = toRect.top + toRect.height / 2 - containerRect.top
      } else {
        // overlapping horizontally — connect center to center
        x1 = fromRect.left + fromRect.width / 2 - containerRect.left
        y1 = fromRect.bottom - containerRect.top
        x2 = toRect.left + toRect.width / 2 - containerRect.left
        y2 = toRect.top - containerRect.top
      }

      newLines.push({
        x1,
        y1,
        x2,
        y2,
        color: conn.color || '#0D9488',
      })
    }

    setLines(newLines)
  }, [connections, containerRef])

  // Recalculate on mount and when connections change
  useEffect(() => {
    recalculate()
  }, [recalculate])

  // Recalculate on resize via ResizeObserver
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver(() => {
      recalculate()
    })

    resizeObserver.observe(container)

    // Also listen for window resize as a fallback
    window.addEventListener('resize', recalculate)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', recalculate)
    }
  }, [containerRef, recalculate])

  // MutationObserver + rAF loop: recalculate when nodes move (drag, style changes)
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Use MutationObserver to detect style/transform changes on child nodes
    const mutationObserver = new MutationObserver(() => {
      // Throttle via rAF to avoid excessive recalculations
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(recalculate)
    })

    mutationObserver.observe(container, {
      attributes: true,
      attributeFilter: ['style', 'class'],
      subtree: true,
    })

    return () => {
      mutationObserver.disconnect()
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [containerRef, recalculate])

  if (lines.length === 0 || dimensions.width === 0) return null

  return (
    <svg
      className="absolute inset-0 pointer-events-none hidden md:block"
      width={dimensions.width}
      height={dimensions.height}
      style={{ overflow: 'visible' }}
    >
      {lines.map((line, i) => {
        // Calculate control points for cubic bezier
        const dx = Math.abs(line.x2 - line.x1)
        const cpOffset = Math.max(dx * 0.4, 40)

        // Determine direction for control points
        const goingRight = line.x1 < line.x2
        const cp1x = goingRight ? line.x1 + cpOffset : line.x1 - cpOffset
        const cp2x = goingRight ? line.x2 - cpOffset : line.x2 + cpOffset

        const d = `M ${line.x1} ${line.y1} C ${cp1x} ${line.y1}, ${cp2x} ${line.y2}, ${line.x2} ${line.y2}`

        return (
          <path
            key={i}
            d={d}
            fill="none"
            stroke={line.color}
            strokeWidth={1.5}
            strokeDasharray="8 4"
            opacity={0.4}
          />
        )
      })}
    </svg>
  )
}
