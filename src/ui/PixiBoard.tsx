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
  onCellClick?: (x: number, y: number, button: number) => void
}

const RESOURCE_COLOR: Record<string, number> = {
  iron: 0xb0b0c0,
  coal: 0x202020,
  copper: 0xd97a3a,
  'iron-plate': 0xc8c8e0,
  'copper-plate': 0xe89a5a,
}

const DIR_ANGLE: Record<Dir, number> = { E: 0, S: Math.PI / 2, W: Math.PI, N: -Math.PI / 2 }

export function PixiBoard({ grid, cellSize = 48, flows, sinkResults, onCellClick }: BoardProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const layerRef = useRef<Container | null>(null)
  const clickRef = useRef(onCellClick)
  clickRef.current = onCellClick
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const app = new Application()
    let cancelled = false
    ;(async () => {
      await app.init({
        background: 0x141821,
        antialias: true,
        width: grid.w * cellSize,
        height: grid.h * cellSize,
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
  }, [grid.w, grid.h, cellSize])

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

    const hit = new Graphics()
    hit.rect(0, 0, grid.w * cellSize, grid.h * cellSize).fill({ color: 0xffffff, alpha: 0.001 })
    hit.eventMode = 'static'
    hit.on('pointerdown', (e) => {
      const local = e.getLocalPosition(layer)
      const cx = Math.floor(local.x / cellSize)
      const cy = Math.floor(local.y / cellSize)
      if (cx >= 0 && cx < grid.w && cy >= 0 && cy < grid.h) {
        clickRef.current?.(cx, cy, e.button)
      }
    })
    layer.addChild(hit)
  }, [ready, grid, cellSize, flows, sinkResults])

  return <div ref={hostRef} style={{ width: grid.w * cellSize, height: grid.h * cellSize }} />
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
