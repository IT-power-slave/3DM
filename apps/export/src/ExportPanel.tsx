import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import type { CanvasSnapshot, SceneSnapshot, GeometryType, GeometryParams } from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'

type ExportFormat = 'png' | 'svg'
type ExportSource = '2d' | '3d'

const MAX_DIMENSION_RECOMMENDED = 4096

function buildGeometry(type: GeometryType = 'box', params: GeometryParams = {}): THREE.BufferGeometry {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(params.width ?? 1, params.height ?? 1, params.depth ?? 1)
    case 'sphere':
      return new THREE.SphereGeometry(params.radius ?? 0.5, params.radialSegments ?? 32, 16)
    case 'cylinder':
      return new THREE.CylinderGeometry(
        params.radius ?? 0.5, params.radius ?? 0.5,
        params.height ?? 1, params.radialSegments ?? 32,
      )
    case 'cone':
      return new THREE.ConeGeometry(params.radius ?? 0.5, params.height ?? 1, params.radialSegments ?? 32)
    case 'plane':
      return new THREE.PlaneGeometry(params.width ?? 2, params.height ?? 2)
    case 'extrude-rect': {
      const shape = new THREE.Shape()
      const w = params.width ?? 1; const h = params.height ?? 1
      shape.moveTo(0, 0); shape.lineTo(w, 0); shape.lineTo(w, h); shape.lineTo(0, h); shape.closePath()
      return new THREE.ExtrudeGeometry(shape, { depth: params.depth ?? 0.5, bevelEnabled: false })
    }
    case 'extrude-ellipse': {
      const shape = new THREE.Shape()
      shape.absellipse(0, 0, params.rx ?? 0.5, params.ry ?? 0.5, 0, Math.PI * 2, false, 0)
      return new THREE.ExtrudeGeometry(shape, { depth: params.depth ?? 0.5, bevelEnabled: false })
    }
    default:
      return new THREE.BoxGeometry(1, 1, 1)
  }
}

export function ExportPanel(): React.ReactElement {
  const [canvasSnap, setCanvasSnap] = useState<CanvasSnapshot | null>(null)
  const [sceneSnap, setSceneSnap] = useState<SceneSnapshot | null>(null)
  const [source, setSource] = useState<ExportSource>('2d')
  const [format, setFormat] = useState<ExportFormat>('png')
  const [width, setWidth] = useState(1920)
  const [height, setHeight] = useState(1080)
  const [status, setStatus] = useState<'idle' | 'rendering' | 'done' | 'error'>('idle')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const offscreenRef = useRef<HTMLCanvasElement>(null)

  // Announce MFE ready
  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-export',
        criticality: 'non-critical',
      })
    })
    return unsub
  }, [])

  // Consume snapshots
  useEffect(() => {
    const u1 = bus.on('canvas:snapshot', (snap) => setCanvasSnap(snap))
    const u2 = bus.on('scene:snapshot', (snap) => setSceneSnap(snap))
    return () => { u1(); u2() }
  }, [])

  const export2DPNG = useCallback(async (): Promise<string> => {
    if (!canvasSnap) throw new Error('No 2D canvas snapshot available')
    const img = new Image()
    const svgBlob = new Blob([canvasSnap.svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(svgBlob)
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = rej
      img.src = url
    })
    URL.revokeObjectURL(url)

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    return canvas.toDataURL('image/png')
  }, [canvasSnap, width, height])

  const export2DSVG = useCallback((): string => {
    if (!canvasSnap) throw new Error('No 2D canvas snapshot available')
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(canvasSnap.svgData)}`
    return dataUrl
  }, [canvasSnap])

  const export3DPNG = useCallback(async (): Promise<string> => {
    if (!sceneSnap) throw new Error('No 3D scene snapshot available')

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(width, height)
    renderer.shadowMap.enabled = true

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#1a1a2e')

    // Set up lights from snapshot
    sceneSnap.defaultLights.forEach((l) => {
      if (l.type === 'ambient') {
        scene.add(new THREE.AmbientLight(new THREE.Color(l.color.r, l.color.g, l.color.b), l.intensity))
      } else if (l.type === 'directional') {
        const light = new THREE.DirectionalLight(new THREE.Color(l.color.r, l.color.g, l.color.b), l.intensity)
        if (l.position) light.position.set(l.position.x, l.position.y, l.position.z)
        scene.add(light)
      }
    })

    // Reconstruct objects with proper geometry
    sceneSnap.objects.forEach((obj) => {
      const geo = buildGeometry(obj.geometryType, obj.geometryParams)
      const mat = new THREE.MeshStandardMaterial({ color: obj.color ?? '#3b82f6' })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
      mesh.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      scene.add(mesh)
    })

    // Camera from snapshot
    const camData = sceneSnap.cameras[0]
    const camera = new THREE.PerspectiveCamera(camData?.fov ?? 60, width / height, 0.1, 1000)
    if (camData) {
      camera.position.set(camData.position.x, camData.position.y, camData.position.z)
      camera.lookAt(camData.target.x, camData.target.y, camData.target.z)
    } else {
      camera.position.set(5, 5, 5)
      camera.lookAt(0, 0, 0)
    }

    renderer.render(scene, camera)
    const dataUrl = renderer.domElement.toDataURL('image/png')
    renderer.dispose()
    return dataUrl
  }, [sceneSnap, width, height])

  const runExport = useCallback(async () => {
    setStatus('rendering')
    setProgress(10)
    setResultUrl(null)
    try {
      let dataUrl: string
      if (source === '2d' && format === 'png') {
        setProgress(40)
        dataUrl = await export2DPNG()
      } else if (source === '2d' && format === 'svg') {
        setProgress(60)
        dataUrl = export2DSVG()
      } else {
        setProgress(40)
        dataUrl = await export3DPNG()
      }
      setProgress(100)
      setResultUrl(dataUrl)
      setStatus('done')

      bus.emit('export:progress', {
        schemaVersion: SCHEMA_VERSION,
        requestId: `exp_${Date.now()}`,
        progress: 100,
        status: 'done',
        resultDataUrl: dataUrl,
      })
    } catch (err) {
      console.error('[Export] Failed:', err)
      setStatus('error')
      setProgress(0)
    }
  }, [source, format, export2DPNG, export2DSVG, export3DPNG])

  const downloadResult = useCallback(() => {
    if (!resultUrl) return
    const a = document.createElement('a')
    a.href = resultUrl
    a.download = `3d-studio-export.${format}`
    a.click()
  }, [resultUrl, format])

  const warn4K = width > MAX_DIMENSION_RECOMMENDED || height > MAX_DIMENSION_RECOMMENDED

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>Export</h3>

      <Section title="Source">
        <RadioGroup
          name="source"
          options={[
            { value: '2d', label: '2D Canvas', disabled: !canvasSnap },
            { value: '3d', label: '3D Scene', disabled: !sceneSnap },
          ]}
          value={source}
          onChange={(v) => setSource(v as ExportSource)}
        />
        <p style={styles.hint}>
          {source === '2d'
            ? canvasSnap
              ? `Snapshot: ${new Date(canvasSnap.capturedAt).toLocaleTimeString()}`
              : '⚠ No snapshot. Use 📷 Snap in 2D Editor.'
            : sceneSnap
            ? `Snapshot: ${new Date(sceneSnap.capturedAt).toLocaleTimeString()}`
            : '⚠ No snapshot. Use 📡 Sync in 3D Editor.'}
        </p>
      </Section>

      <Section title="Format">
        <RadioGroup
          name="format"
          options={[
            { value: 'png', label: 'PNG' },
            { value: 'svg', label: 'SVG', disabled: source === '3d' },
          ]}
          value={format}
          onChange={(v) => setFormat(v as ExportFormat)}
        />
      </Section>

      {format === 'png' && (
        <Section title="Resolution">
          <div style={styles.row}>
            <NumberInput label="W" value={width} onChange={setWidth} min={64} max={8192} />
            <span style={styles.x}>×</span>
            <NumberInput label="H" value={height} onChange={setHeight} min={64} max={8192} />
            <span style={styles.px}>px</span>
          </div>
          {warn4K && (
            <p style={styles.warn}>⚠ Resolution exceeds 4K. Export may be slow or fail.</p>
          )}
        </Section>
      )}

      <button
        style={{
          ...styles.exportBtn,
          ...(status === 'rendering' ? styles.exportBtnDisabled : {}),
        }}
        onClick={() => void runExport()}
        disabled={status === 'rendering'}
      >
        {status === 'rendering' ? `Rendering… ${progress}%` : `Export ${format.toUpperCase()}`}
      </button>

      {status === 'done' && resultUrl && (
        <div style={styles.result}>
          {format === 'png' && (
            <img src={resultUrl} alt="Export preview" style={styles.preview} />
          )}
          <button style={styles.downloadBtn} onClick={downloadResult}>
            ⬇ Download
          </button>
        </div>
      )}

      {status === 'error' && (
        <p style={styles.error}>Export failed. Check console for details.</p>
      )}

      {/* Offscreen canvas for 2D rasterization */}
      <canvas ref={offscreenRef} style={{ display: 'none' }} />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sectionStyles.container}>
      <p style={sectionStyles.title}>{title}</p>
      {children}
    </div>
  )
}

function RadioGroup({
  name,
  options,
  value,
  onChange,
}: {
  name: string
  options: Array<{ value: string; label: string; disabled?: boolean }>
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      {options.map((o) => (
        <label
          key={o.value}
          style={{ ...radioStyles.label, ...(o.disabled ? radioStyles.disabled : {}) }}
        >
          <input
            type="radio"
            name={name}
            value={o.value}
            checked={value === o.value}
            disabled={o.disabled}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </label>
      ))}
    </div>
  )
}

function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  min: number
  max: number
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ color: '#888', fontSize: 11 }}>{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        style={inputStyles.input}
      />
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: 16,
    gap: 12,
    background: '#1e1e1e',
    color: '#e0e0e0',
    overflowY: 'auto',
  },
  heading: { fontSize: 14, fontWeight: 600, color: '#7eb3f7', marginBottom: 4 },
  hint: { fontSize: 11, color: '#666', marginTop: 4 },
  row: { display: 'flex', alignItems: 'center', gap: 6 },
  x: { color: '#666', fontSize: 12 },
  px: { color: '#666', fontSize: 11 },
  warn: { fontSize: 11, color: '#f59e0b', marginTop: 4 },
  exportBtn: {
    padding: '10px 20px',
    background: '#3b82f6',
    border: 'none',
    borderRadius: 6,
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  exportBtnDisabled: { opacity: 0.6, cursor: 'default' },
  result: { display: 'flex', flexDirection: 'column', gap: 8 },
  preview: { maxWidth: '100%', maxHeight: 200, borderRadius: 4, border: '1px solid #333' },
  downloadBtn: {
    padding: '8px 16px',
    background: '#1d3a2a',
    border: '1px solid #2d6a4a',
    borderRadius: 4,
    color: '#6ee7b7',
    fontSize: 13,
    cursor: 'pointer',
    alignSelf: 'flex-start',
  },
  error: { color: '#f87171', fontSize: 12 },
}

const sectionStyles: Record<string, React.CSSProperties> = {
  container: {
    background: '#252525',
    borderRadius: 6,
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  title: { fontSize: 11, color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 },
}

const radioStyles: Record<string, React.CSSProperties> = {
  label: { display: 'flex', alignItems: 'center', gap: 4, fontSize: 13, color: '#ccc', cursor: 'pointer' },
  disabled: { opacity: 0.4, cursor: 'default' },
}

const inputStyles: Record<string, React.CSSProperties> = {
  input: {
    width: 70,
    padding: '3px 6px',
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#ddd',
    fontSize: 12,
  },
}
