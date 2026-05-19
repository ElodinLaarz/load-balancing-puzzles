import { useEffect, useRef, useState } from 'react'
import { Application, Container, Graphics, Text, TextStyle } from 'pixi.js'
import type { BeltTier, Cell, Dir, Grid } from '../sim/types'
import { idx } from '../sim/types'
import type { FlowGrid, SinkResult } from '../sim/solve'
import { applyScroll, nextScroll, type PanOrigin } from './pan'
import { previewCellSpec } from './previewCell'

export interface BoardProps {
  grid: Grid
  cellSize?: number
  flows?: FlowGrid | null
  sinkResults?: SinkResult[]
  /** Active placement direction; used for the first cell of a drag before motion exists. */
  placementDir: Dir
  /** Active placement tier; used to color the ghost preview under the cursor. */
  placementTier: BeltTier
  /**
   * Called per cell during paint/erase. For paint, `dir` is the smart-tile direction
   * (motion-aware); for erase, `dir` is null.
   */
  onPlace?: (x: number, y: number, dir: Dir | null, button: number) => void
  onHoverCell?: (cell: { x: number; y: number } | null) => void
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

export function PixiBoard({
  grid,
  cellSize = 48,
  flows,
  sinkResults,
  placementDir,
  placementTier,
  onPlace,
  onHoverCell,
}: BoardProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)
  const layerRef = useRef<Container | null>(null)
  const previewLayerRef = useRef<Container | null>(null)
  const placeRef = useRef(onPlace)
  const hoverRef = useRef(onHoverCell)
  const placementDirRef = useRef(placementDir)
  // Keep refs pointed at the latest prop values. Effects run after commit and
  // before any user-triggered DOM event handler fires, so the refs are always
  // current by the time the mouse/wheel handlers below read them.
  useEffect(() => {
    placeRef.current = onPlace
  }, [onPlace])
  useEffect(() => {
    hoverRef.current = onHoverCell
  }, [onHoverCell])
  useEffect(() => {
    placementDirRef.current = placementDir
  }, [placementDir])
  const [ready, setReady] = useState(false)
  const [scale, setScale] = useState(1)
  const [spaceDown, setSpaceDown] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null)

  // Track Space key for "space+drag to pan" gesture. Ignore auto-repeat.
  useEffect(() => {
    const isEditable = (t: EventTarget | null) =>
      t instanceof HTMLInputElement || t instanceof HTMLSelectElement || t instanceof HTMLTextAreaElement
    const onDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat && !isEditable(e.target)) {
        e.preventDefault()
        setSpaceDown(true)
      }
    }
    const onUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceDown(false)
    }
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
    }
  }, [])

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
      // Preview overlay lives in its own layer so hover-driven redraws don't
      // touch the main cell layer.
      const previewLayer = new Container()
      previewLayer.alpha = 0.4
      app.stage.addChild(previewLayer)
      appRef.current = app
      layerRef.current = layer
      previewLayerRef.current = previewLayer
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
        previewLayerRef.current = null
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

  // Ghost preview overlay. Runs in its own layer with alpha 0.4 so hover-driven
  // redraws don't thrash the main cell layer. Skipped when hovering source/sink
  // (those cells can't be replaced anyway).
  useEffect(() => {
    const preview = previewLayerRef.current
    if (!ready || !preview) return
    preview.removeChildren()
    if (!hover) return
    const existing = grid.cells[idx(grid, hover.x, hover.y)]
    if (existing && (existing.kind === 'source' || existing.kind === 'sink')) return
    const ghost = drawCell(
      previewCellSpec(placementDir, placementTier),
      hover.x,
      hover.y,
      cellSize,
      null,
    )
    preview.addChild(ghost)
  }, [ready, hover, placementDir, placementTier, cellSize, grid])

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

  // Smart-tile drag state: track last cell touched and re-orient as the path turns.
  const paintingRef = useRef<number | null>(null)
  const lastCellRef = useRef<{ x: number; y: number } | null>(null)

  // Pan state: middle-mouse drag, or Space+left-drag. Pans the scrollable parent
  // (`.board-wrap`) rather than the canvas itself, so it composes cleanly with
  // CSS `overflow: auto` and the existing zoom transform. The ref drives the
  // hot path (mousemove); state drives cursor styling.
  const panningRef = useRef(false)
  const [panning, setPanning] = useState(false)
  const panOriginRef = useRef<PanOrigin | null>(null)
  const spaceDownRef = useRef(false)
  useEffect(() => {
    spaceDownRef.current = spaceDown
  }, [spaceDown])

  function placeAt(x: number, y: number, dir: Dir | null, button: number) {
    placeRef.current?.(x, y, dir, button)
  }

  function handleDown(e: React.MouseEvent) {
    // Pan: middle-mouse drag, or Space+left-drag. Takes precedence over paint.
    if (e.button === 1 || (e.button === 0 && spaceDownRef.current)) {
      const host = hostRef.current
      const scroller = host?.parentElement
      if (!scroller) return
      e.preventDefault()
      panningRef.current = true
      panOriginRef.current = {
        x: e.clientX,
        y: e.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      }
      setPanning(true)
      return
    }
    if (e.button !== 0 && e.button !== 2) return
    e.preventDefault()
    paintingRef.current = e.button
    const c = cellFromEvent(e)
    if (!c) {
      lastCellRef.current = null
      return
    }
    lastCellRef.current = c
    // First cell uses held placement direction (Factorio behavior).
    placeAt(c.x, c.y, e.button === 2 ? null : placementDirRef.current, e.button)
  }

  function handleMove(e: React.MouseEvent) {
    if (panningRef.current && panOriginRef.current) {
      const scroller = hostRef.current?.parentElement
      if (scroller) {
        applyScroll(
          scroller,
          nextScroll(panOriginRef.current, { clientX: e.clientX, clientY: e.clientY })
        )
      }
      return
    }
    const c = cellFromEvent(e)
    hoverRef.current?.(c)
    setHover((prev) => {
      if (c === null) return prev === null ? prev : null
      if (prev && prev.x === c.x && prev.y === c.y) return prev
      return c
    })
    const button = paintingRef.current
    if (button === null || !c) return
    const last = lastCellRef.current
    if (!last) {
      lastCellRef.current = c
      placeAt(c.x, c.y, button === 2 ? null : placementDirRef.current, button)
      return
    }
    if (last.x === c.x && last.y === c.y) return
    // Walk an orthogonal path from `last` to `c`. Dominant axis first.
    const path = orthoPath(last, c)
    let prev = last
    for (const step of path) {
      const dir = dirBetween(prev, step)
      if (!dir) {
        prev = step
        continue
      }
      if (button === 0) {
        // Re-orient the previous cell to face the new outgoing direction.
        // For the very first step, this updates the cell placed on mousedown.
        placeAt(prev.x, prev.y, dir, 0)
        // Place the new cell facing the same direction (will be re-oriented if drag turns).
        placeAt(step.x, step.y, dir, 0)
      } else {
        placeAt(step.x, step.y, null, 2)
      }
      prev = step
    }
    lastCellRef.current = c
  }

  function handleUp() {
    if (panningRef.current) {
      panningRef.current = false
      panOriginRef.current = null
      setPanning(false)
      return
    }
    paintingRef.current = null
    lastCellRef.current = null
  }

  function handleLeave() {
    handleUp()
    hoverRef.current?.(null)
    setHover(null)
  }

  function handleWheel(e: React.WheelEvent) {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
    setScale((s) => Math.max(MIN_SCALE, Math.min(MAX_SCALE, s * factor)))
  }

  // Cursor: 'grabbing' during an active pan, 'grab' when Space is held (pan-ready),
  // default otherwise.
  const cursor = panning ? 'grabbing' : spaceDown ? 'grab' : 'default'

  return (
    <div
      ref={hostRef}
      style={{ width: viewW, height: viewH, userSelect: 'none', touchAction: 'none', cursor }}
      onMouseDown={handleDown}
      onMouseMove={handleMove}
      onMouseUp={handleUp}
      onMouseLeave={handleLeave}
      onContextMenu={(e) => e.preventDefault()}
      onWheel={handleWheel}
      // Suppress browser middle-click auto-scroll on platforms that bind it.
      onAuxClick={(e) => {
        if (e.button === 1) e.preventDefault()
      }}
    />
  )
}

type Pt = { x: number; y: number }

function dirBetween(a: Pt, b: Pt): Dir | null {
  if (b.x === a.x + 1 && b.y === a.y) return 'E'
  if (b.x === a.x - 1 && b.y === a.y) return 'W'
  if (b.x === a.x && b.y === a.y + 1) return 'S'
  if (b.x === a.x && b.y === a.y - 1) return 'N'
  return null
}

/**
 * Orthogonal step path from `from` (exclusive) to `to` (inclusive). When the cursor
 * jumps diagonally, walk the dominant axis first then the other. Matches Factorio's
 * "drag straight, then turn" feel.
 */
function orthoPath(from: Pt, to: Pt): Pt[] {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const sx = Math.sign(dx)
  const sy = Math.sign(dy)
  const ax = Math.abs(dx)
  const ay = Math.abs(dy)
  const path: Pt[] = []
  let cx = from.x
  let cy = from.y
  if (ax >= ay) {
    for (let i = 0; i < ax; i++) {
      cx += sx
      path.push({ x: cx, y: cy })
    }
    for (let i = 0; i < ay; i++) {
      cy += sy
      path.push({ x: cx, y: cy })
    }
  } else {
    for (let i = 0; i < ay; i++) {
      cy += sy
      path.push({ x: cx, y: cy })
    }
    for (let i = 0; i < ax; i++) {
      cx += sx
      path.push({ x: cx, y: cy })
    }
  }
  return path
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

export default PixiBoard
