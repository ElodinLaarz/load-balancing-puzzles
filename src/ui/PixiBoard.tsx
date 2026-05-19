import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { Cell, Dir, Grid } from '../sim/types'
import { idx } from '../sim/types'
import type { FlowGrid, SinkResult } from '../sim/solve'

export interface BoardProps {
  grid: Grid
  cellSize?: number
  flows?: FlowGrid | null
  sinkResults?: SinkResult[]
  /** button: 0 = left/paint, 2 = right/erase. */
  onCellPaint?: (x: number, y: number, button: number) => void
}

const RESOURCE_COLOR: Record<string, number> = {
  iron: 0xb0b0c0,
  coal: 0x202020,
  copper: 0xd97a3a,
  'iron-plate': 0xc8c8e0,
  'copper-plate': 0xe89a5a,
}

const DIR_ANGLE: Record<Dir, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }

const MIN_SCALE = 0.3
const MAX_SCALE = 3

export function PixiBoard({ grid, cellSize = 48, flows, sinkResults, onCellPaint }: BoardProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const layerRef = useRef<Container | null>(null)
  const paintRef = useRef(onCellPaint)
  paintRef.current = onCellPaint
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)

  const baseW = grid.w * cellSize
  const baseH = grid.h * cellSize
  const viewW = Math.ceil(baseW * scale)
  const viewH = Math.ceil(baseH * scale)

  // Mount Pixi once per grid-size change.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const app = new Application()
    let cancelled = false
    ;(async () => {
      await app.init({
        background: 0x141821,
        antialias: true,
        width: baseW,
        height: baseH,
      })
      if (cancelled) {
        app.destroy(true)
        return
      }
      host.appendChild(app.canvas)
      const layer = new Container()
      app.stage.addChild(layer)
      appRef.current = app
      layerRef.current = layer
      app.canvas.style.display = 'block'
      app.canvas.style.width = '100%'
      app.canvas.style.height = '100%'
      app.canvas.oncontextmenu = (e) => e.preventDefault()
      setReady(true)
    })()
    return () => {
      cancelled = true
      setReady(false)
      if (appRef.current) {
        appRef.current.destroy(true, { children: true })
        appRef.current = null
        layerRef.current = null
      }
    }
  }, [baseW, baseH])

  // Resize renderer when scale changes (CSS scales canvas; renderer res stays base).
  // No-op needed: canvas is base size, host scales via CSS width/height.

  // Draw whenever inputs change.
  useEffect(() => {
    const app = appRef.current
    const layer = layerRef.current
    if (!ready || !app || !layer) return

    layer.removeChildren()

    const bg = new Graphics()
    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        bg.rect(x * cellSize, y * cellSize, cellSize, cellSize)
      }
    }
    bg.fill({ color: 0x1c2230 }).stroke({ color: 0x2a3142, width: 1 })
    layer.addChild(bg)

    for (let y = 0; y < grid.h; y++) {
      for (let x = 0; x < grid.w; x++) {
        const c = grid.cells[idx(grid, x, y)]
        if (!c) continue
        layer.addChild(drawCell(c, x, y, cellSize, flows?.[idx(grid, x, y)] ?? null))
      }
    }

    if (sinkResults) {
      for (const s of sinkResults) {
        const g = new Graphics()
        g.rect(s.x * cellSize, s.y * cellSize, cellSize, cellSize)
          .stroke({ color: s.ok ? 0x4ade80 : 0xef4444, width: 3 })
        layer.addChild(g)
      }
    }
  }, [ready, grid, cellSize, flows, sinkResults])

  // DOM-level handlers for paint/zoom: simpler than Pixi events for drag tracking.
  function cellFromEvent(e: React.MouseEvent | MouseEvent): { x: number; y: number } | null {
    const host = hostRef.current
    if (!host) return null
    const rect = host.getBoundingClientRect()
    const lx = ((e.clientX - rect.left) / rect.width) * grid.w
    const ly = ((e.clientY - rect.top) / rect.height) * grid.h
    const cx = Math.floor(lx)
    const cy = Math.floor(ly)
    if (cx < 0 || cy < 0 || cx >= grid.w || cy >= grid.h) return null
    return { x: cx, y: cy }
  }

  const paintingRef = useRef<number | null>(null) // active button
  const lastCellRef = useRef<string | null>(null)

  function handleDown(e: React.MouseEvent) {
    if (e.button !== 0 && e.button !== 2) return
    e.preventDefault()
    paintingRef.current = e.button
    lastCellRef.current = null
    const c = cellFromEvent(e)
    if (c) {
      lastCellRef.current = `${c.x},${c.y}`
      paintRef.current?.(c.x, c.y, e.button)
    }
  }

  function handleMove(e: React.MouseEvent) {
    if (paintingRef.current === null) return
    const c = cellFromEvent(e)
    if (!c) return
    const key = `${c.x},${c.y}`
    if (key === lastCellRef.current) return
    lastCellRef.current = key
    paintRef.current?.(c.x, c.y, paintingRef.current)
  }

  function handleUp() {
    paintingRef.current = null
    lastCellRef.current = null
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)))
  }

  return (
    <div
      ref={hostRef}
      style={{ width: viewW, height: viewH, userSelect: 'none', touchAction: 'none' }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleUp}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
    />
  )
}

function drawCell(c: Cell, x: number, y: number, s: number, flow: Record<string, number> | null) {
  const node = new Container()
  node.x = x * s
  node.y = y * s

  const g = new Graphics()
  const color =
    c.kind === 'source'
      ? 0x3b82f6
      : c.kind === 'sink'
        ? 0x9333ea
        : c.kind.startsWith('splitter')
          ? 0xeab308
          : c.kind.startsWith('underground')
            ? 0x14b8a6
            : tierColor(c.tier)
  g.rect(2, 2, s - 4, s - 4).fill({ color })
  node.addChild(g)

  const arrow = new Graphics()
  arrow.moveTo(-s * 0.18, -s * 0.14)
  arrow.lineTo(s * 0.22, 0)
  arrow.lineTo(-s * 0.18, s * 0.14)
  arrow.lineTo(-s * 0.08, 0)
  arrow.closePath()
  arrow.fill({ color: 0xffffff, alpha: 0.85 })
  arrow.x = s / 2
  arrow.y = s / 2
  arrow.rotation = DIR_ANGLE[c.dir]
  node.addChild(arrow)

  const display = flow ?? c.feed ?? c.require
  if (display) {
    const entries = Object.entries(display).filter(([, v]) => v > 0.01)
    if (entries.length) {
      const total = entries.reduce((a, [, v]) => a + v, 0)
      let cx = 4
      const barY = s - 8
      const barW = s - 8
      const pip = new Graphics()
      for (const [k, v] of entries) {
        const w = (v / total) * barW
        pip.rect(cx, barY, w, 4).fill({ color: RESOURCE_COLOR[k] ?? 0xffffff })
        cx += w
      }
      node.addChild(pip)

      if (c.kind === 'source' || c.kind === 'sink') {
        const style = new TextStyle({ fill: 0xffffff, fontSize: 10, fontFamily: 'monospace' })
        const txt = new Text({ text: total.toFixed(1), style })
        txt.x = 4
        txt.y = 4
        node.addChild(txt)
      }
    }
  }

  return node
}

function tierColor(t: Cell['tier']) {
  switch (t) {
    case 'red':
      return 0xdc2626
    case 'blue':
      return 0x2563eb
    case 'yellow':
    default:
      return 0xca8a04
  }
}
