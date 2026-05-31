import React, { useEffect, useRef, useState, useCallback } from 'react'
import { Canvas as FabricCanvas, Rect, Ellipse, Line, Path, FabricObject, loadSVGFromString } from 'fabric'
import type { ShapeDescriptor, ShapeDescriptorBatch, CanvasSnapshot } from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'

type DrawTool = 'select' | 'rect' | 'ellipse' | 'line'

function generateId() {
  return `shape_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function fabricObjectToDescriptor(obj: FabricObject): ShapeDescriptor | null {
  const base = {
    schemaVersion: SCHEMA_VERSION as typeof SCHEMA_VERSION,
    shapeId: (obj as FabricObject & { shapeId?: string }).shapeId ?? generateId(),
    name: (obj as FabricObject & { name?: string }).name ?? obj.type ?? 'shape',
    style: {
      fill: typeof obj.fill === 'string' ? obj.fill : null,
      fillOpacity: obj.opacity ?? 1,
      stroke: typeof obj.stroke === 'string' ? obj.stroke : null,
      strokeWidth: obj.strokeWidth ?? 0,
      strokeOpacity: 1,
      fillRule: 'nonzero' as const,
    },
    transform: `matrix(1 0 0 1 ${obj.left ?? 0} ${obj.top ?? 0})`,
    visible: obj.visible ?? true,
    locked: !obj.selectable,
  }

  if (obj instanceof Rect) {
    return {
      ...base,
      type: 'rect',
      x: obj.left ?? 0,
      y: obj.top ?? 0,
      width: (obj.width ?? 0) * (obj.scaleX ?? 1),
      height: (obj.height ?? 0) * (obj.scaleY ?? 1),
      rx: obj.rx,
      ry: obj.ry,
    }
  }
  if (obj instanceof Ellipse) {
    return {
      ...base,
      type: 'ellipse',
      cx: (obj.left ?? 0) + (obj.rx ?? 0) * (obj.scaleX ?? 1),
      cy: (obj.top ?? 0) + (obj.ry ?? 0) * (obj.scaleY ?? 1),
      rx: (obj.rx ?? 0) * (obj.scaleX ?? 1),
      ry: (obj.ry ?? 0) * (obj.scaleY ?? 1),
    }
  }
  if (obj instanceof Line) {
    return {
      ...base,
      type: 'line',
      x1: obj.x1 ?? 0,
      y1: obj.y1 ?? 0,
      x2: obj.x2 ?? 0,
      y2: obj.y2 ?? 0,
    }
  }
  if (obj instanceof Path) {
    return {
      ...base,
      type: 'path',
      d: (obj.path ?? []).map((cmd: (string | number)[]) => cmd.join(' ')).join(' '),
    }
  }
  return null
}

export function Editor2DPanel(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const fabricRef = useRef<FabricCanvas | null>(null)
  const [tool, setTool] = useState<DrawTool>('select')
  const [fillColor, setFillColor] = useState('#3b82f6')
  const [strokeColor, setStrokeColor] = useState('#ffffff')
  // Drawing state as refs to avoid stale closures in Fabric event handlers
  const isDrawingRef = useRef(false)
  const startPointRef = useRef<{ x: number; y: number } | null>(null)
  const activeShapeRef = useRef<FabricObject | null>(null)
  const toolRef = useRef(tool)
  toolRef.current = tool
  const fillColorRef = useRef(fillColor)
  fillColorRef.current = fillColor
  const strokeColorRef = useRef(strokeColor)
  strokeColorRef.current = strokeColor

  // Announce ready
  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-2d',
        criticality: 'critical',
      })
    })
    return unsub
  }, [])

  // Init Fabric.js canvas + attach drawing event handlers
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return
    const container = containerRef.current
    const w = container.clientWidth || 800
    const h = container.clientHeight || 600

    const fc = new FabricCanvas(canvasRef.current, {
      backgroundColor: '#ffffff',
      selection: true,
      width: w,
      height: h,
    })
    fabricRef.current = fc

    // --- Native Fabric drawing handlers ---
    // Using Fabric events (not React DOM events) avoids stale-closure problems.
    // opt.absolutePointer = scene coords (correct for placing shapes in Fabric v6).

    fc.on('mouse:down', (opt) => {
      const t = toolRef.current
      if (t === 'select') return
      // absolutePointer holds scene-space coordinates in Fabric v6
      const { x, y } = (opt as unknown as { absolutePointer: { x: number; y: number } }).absolutePointer
      isDrawingRef.current = true
      startPointRef.current = { x, y }

      const fill = fillColorRef.current
      const stroke = strokeColorRef.current
      let shape: FabricObject | null = null

      if (t === 'rect') {
        shape = new Rect({ left: x, top: y, width: 1, height: 1, fill, stroke, strokeWidth: 1, opacity: 0.9 })
      } else if (t === 'ellipse') {
        shape = new Ellipse({ left: x, top: y, rx: 0.5, ry: 0.5, fill, stroke, strokeWidth: 1, opacity: 0.9 })
      } else if (t === 'line') {
        shape = new Line([x, y, x, y], { stroke: fill, strokeWidth: 2, fill: '' })
      }

      if (shape) {
        fc.add(shape)
        activeShapeRef.current = shape
      }
    })

    fc.on('mouse:move', (opt) => {
      if (!isDrawingRef.current || !startPointRef.current || !activeShapeRef.current) return
      const { x, y } = (opt as unknown as { absolutePointer: { x: number; y: number } }).absolutePointer
      const start = startPointRef.current
      const shape = activeShapeRef.current
      const dx = x - start.x
      const dy = y - start.y

      if (shape instanceof Rect) {
        shape.set({
          left: dx < 0 ? x : start.x,
          top: dy < 0 ? y : start.y,
          width: Math.abs(dx),
          height: Math.abs(dy),
        })
      } else if (shape instanceof Ellipse) {
        shape.set({
          left: dx < 0 ? x : start.x,
          top: dy < 0 ? y : start.y,
          rx: Math.abs(dx) / 2,
          ry: Math.abs(dy) / 2,
        })
      } else if (shape instanceof Line) {
        shape.set({ x2: x, y2: y })
      }
      fc.requestRenderAll()
    })

    fc.on('mouse:up', () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      startPointRef.current = null
      activeShapeRef.current = null
      // Auto-switch back to select; the tool-sync effect sets fc.selection = true
      setTool('select')
    })

    // ResizeObserver keeps canvas matching container
    const ro = new ResizeObserver(() => {
      const nw = container.clientWidth
      const nh = container.clientHeight
      if (nw > 0 && nh > 0) {
        fc.setDimensions({ width: nw, height: nh })
        fc.renderAll()
      }
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      fc.dispose()
      fabricRef.current = null
    }
  }, [])

  // Sync fc.selection with active tool — disables rubber-band box when drawing
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.selection = tool === 'select'
    // Let Fabric manage cursor via its own hoverCursor / defaultCursor
    fc.defaultCursor = tool === 'select' ? 'default' : 'crosshair'
    fc.hoverCursor = tool === 'select' ? 'move' : 'crosshair'
  }, [tool])

  // Force resize when panel becomes active (handles first-visit timing)
  useEffect(() => {
    const unsub = bus.on('panel:activated', (ev) => {
      if (ev.panelId !== '2d') return
      const fc = fabricRef.current
      const container = containerRef.current
      if (!fc || !container) return
      const w = container.clientWidth
      const h = container.clientHeight
      if (w > 0 && h > 0) {
        fc.setDimensions({ width: w, height: h })
        fc.renderAll()
      }
    })
    return unsub
  }, [])

  // Restore canvas from project
  useEffect(() => {
    const unsub = bus.on('project:restore', async (data) => {
      const fc = fabricRef.current
      if (!fc) return
      fc.clear()
      fc.backgroundColor = '#ffffff'
      if (data.svgData) {
        try {
          const { objects } = await loadSVGFromString(data.svgData)
          const validObjs = objects.filter((o): o is FabricObject => o !== null)
          if (validObjs.length > 0) fc.add(...validObjs)
        } catch (err) {
          console.warn('[Editor2D] SVG restore failed:', err)
        }
      }
      fc.renderAll()
    })
    return unsub
  }, [])

  // Dirty state tracking
  useEffect(() => {
    const fc = fabricRef.current
    if (!fc) return
    const onModified = () => {
      bus.emit('dirty:changed', {
        schemaVersion: SCHEMA_VERSION,
        source: 'mfe-2d',
        isDirty: true,
        timestamp: new Date().toISOString(),
      })
    }
    fc.on('object:added', onModified)
    fc.on('object:modified', onModified)
    fc.on('object:removed', onModified)
    return () => {
      fc.off('object:added', onModified)
      fc.off('object:modified', onModified)
      fc.off('object:removed', onModified)
    }
  }, [])

  const publishShapes = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    const shapes: ShapeDescriptor[] = []
    fc.getObjects().forEach((obj) => {
      const desc = fabricObjectToDescriptor(obj)
      if (desc) shapes.push(desc)
    })
    const batch: ShapeDescriptorBatch = {
      schemaVersion: SCHEMA_VERSION,
      batchId: generateId(),
      shapes,
    }
    bus.emit('shapes:publish', batch)
  }, [])

  const takeSnapshot = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    const svgData = fc.toSVG()
    const snapshot: CanvasSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      snapshotId: generateId(),
      svgData,
      viewBox: { x: 0, y: 0, width: fc.width ?? 800, height: fc.height ?? 600 },
      capturedAt: new Date().toISOString(),
    }
    bus.emit('canvas:snapshot', snapshot)
  }, [])

  const deleteSelected = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    const objs = fc.getActiveObjects()
    objs.forEach((o) => fc.remove(o))
    fc.discardActiveObject()
    fc.renderAll()
  }, [])

  const clearCanvas = useCallback(() => {
    const fc = fabricRef.current
    if (!fc) return
    fc.clear()
    fc.backgroundColor = '#ffffff'
    fc.renderAll()
  }, [])

  const TOOLS: Array<{ id: DrawTool; label: string }> = [
    { id: 'select', label: '↖ Select' },
    { id: 'rect', label: '□ Rect' },
    { id: 'ellipse', label: '○ Ellipse' },
    { id: 'line', label: '╱ Line' },
  ]

  return (
    <div style={styles.panel}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        {TOOLS.map((t) => (
          <button
            key={t.id}
            style={{ ...styles.toolBtn, ...(tool === t.id ? styles.toolBtnActive : {}) }}
            onClick={() => setTool(t.id)}
          >
            {t.label}
          </button>
        ))}
        <div style={styles.sep} />
        {/* Color pickers */}
        <label style={styles.colorLabel} title="Fill color">
          Fill
          <input
            type="color"
            value={fillColor}
            onChange={(e) => setFillColor(e.target.value)}
            style={styles.colorInput}
          />
        </label>
        <label style={styles.colorLabel} title="Stroke color">
          Stroke
          <input
            type="color"
            value={strokeColor}
            onChange={(e) => setStrokeColor(e.target.value)}
            style={styles.colorInput}
          />
        </label>
        <div style={styles.sep} />
        <button style={styles.toolBtn} onClick={deleteSelected} title="Delete selected (Del)">
          🗑 Del
        </button>
        <button style={styles.toolBtn} onClick={clearCanvas} title="Clear all">
          ✕ Clear
        </button>
        <div style={styles.sep} />
        <button style={styles.actionBtn} onClick={publishShapes} title="Send shapes to 3D editor">
          → 3D
        </button>
        <button style={styles.actionBtn} onClick={takeSnapshot} title="Snapshot for export">
          📷 Snap
        </button>
      </div>

      {/* Canvas area */}
      <div ref={containerRef} style={styles.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', background: '#1a1a1a' },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    padding: '6px 8px',
    background: '#252525',
    borderBottom: '1px solid #333',
    flexShrink: 0,
    flexWrap: 'wrap',
  },
  toolBtn: {
    padding: '4px 10px',
    background: 'transparent',
    border: '1px solid transparent',
    borderRadius: 4,
    color: '#aaa',
    fontSize: 12,
    cursor: 'pointer',
  },
  toolBtnActive: {
    background: '#2d4a6e',
    borderColor: '#3b82f6',
    color: '#7eb3f7',
  },
  sep: { width: 1, height: 20, background: '#444', margin: '0 4px', flexShrink: 0 },
  colorLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 11,
    color: '#888',
    cursor: 'pointer',
  },
  colorInput: {
    width: 28,
    height: 22,
    padding: 1,
    border: '1px solid #444',
    borderRadius: 3,
    cursor: 'pointer',
    background: 'transparent',
  },
  actionBtn: {
    padding: '4px 10px',
    background: '#1d3a2a',
    border: '1px solid #2d6a4a',
    borderRadius: 4,
    color: '#6ee7b7',
    fontSize: 12,
    cursor: 'pointer',
  },
  canvasWrap: {
    flex: 1,
    overflow: 'hidden',
    background: '#2a2a2a',
  },
}
