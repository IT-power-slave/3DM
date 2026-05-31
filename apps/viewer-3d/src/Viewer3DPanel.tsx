import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { BufferGeometryLoader } from 'three'
import type { SceneSnapshot, GeometryType, GeometryParams } from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'

type DisplayMode = 'solid' | 'wireframe' | 'solid+wire'

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

export function Viewer3DPanel(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const frameIdRef = useRef<number>(0)
  const [snapshot, setSnapshot] = useState<SceneSnapshot | null>(null)
  const [displayMode, setDisplayMode] = useState<DisplayMode>('solid')
  const [localLightIntensity, setLocalLightIntensity] = useState(1)
  const viewerMeshesRef = useRef<THREE.Mesh[]>([])
  const viewerLightsRef = useRef<THREE.Light[]>([])

  // Announce MFE ready
  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-viewer',
        criticality: 'non-critical',
      })
    })
    return unsub
  }, [])

  // Init Three.js
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const w = el.clientWidth || 800
    const h = el.clientHeight || 600

    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setSize(w, h)
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.shadowMap.enabled = true
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#1a1a2e')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
    camera.position.set(5, 5, 5)
    cameraRef.current = camera

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controlsRef.current = controls

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const ro = new ResizeObserver(() => {
      const nw = el.clientWidth
      const nh = el.clientHeight
      if (nw > 0 && nh > 0) {
        renderer.setSize(nw, nh)
        camera.aspect = nw / nh
        camera.updateProjectionMatrix()
      }
    })
    ro.observe(el)

    // Grid gives visual feedback that viewport is alive before first sync
    const grid = new THREE.GridHelper(20, 20, '#444', '#2a2a2a')
    scene.add(grid)

    return () => {
      cancelAnimationFrame(frameIdRef.current)
      ro.disconnect()
      controls.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      controlsRef.current = null
      viewerMeshesRef.current = []
      viewerLightsRef.current = []
    }
  }, [])

  // Force resize when panel becomes active
  useEffect(() => {
    const unsub = bus.on('panel:activated', (ev) => {
      if (ev.panelId !== 'viewer') return
      const el = mountRef.current
      const renderer = rendererRef.current
      const camera = cameraRef.current
      if (!el || !renderer || !camera) return
      const w = el.clientWidth; const h = el.clientHeight
      if (w > 0 && h > 0) {
        renderer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
    })
    return unsub
  }, [])

  // Consume scene snapshot
  useEffect(() => {
    const unsub = bus.on('scene:snapshot', (snap) => setSnapshot(snap))
    return unsub
  }, [])

  // Rebuild scene when snapshot or display mode changes
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene || !snapshot) return

    // Dispose and remove previously tracked meshes (including wireframe children)
    viewerMeshesRef.current.forEach((m) => {
      m.traverse((child) => {
        const c = child as THREE.Mesh | THREE.LineSegments
        if (c.geometry) c.geometry.dispose()
        if ((c as THREE.Mesh).material) {
          const mats = Array.isArray((c as THREE.Mesh).material)
            ? ((c as THREE.Mesh).material as THREE.Material[])
            : [(c as THREE.Mesh).material as THREE.Material]
          mats.forEach((mat) => mat.dispose())
        }
      })
      scene.remove(m)
    })
    viewerMeshesRef.current = []

    // Remove previously tracked lights
    viewerLightsRef.current.forEach((l) => scene.remove(l))
    viewerLightsRef.current = []

    // Add lights from snapshot and track them
    snapshot.defaultLights.forEach((l) => {
      let light: THREE.Light
      if (l.type === 'ambient') {
        light = new THREE.AmbientLight(
          new THREE.Color(l.color.r, l.color.g, l.color.b),
          l.intensity * localLightIntensity,
        )
      } else {
        const dLight = new THREE.DirectionalLight(
          new THREE.Color(l.color.r, l.color.g, l.color.b),
          l.intensity * localLightIntensity,
        )
        if (l.position) dLight.position.set(l.position.x, l.position.y, l.position.z)
        dLight.castShadow = true
        light = dLight
      }
      scene.add(light)
      viewerLightsRef.current.push(light)
    })

    // Reconstruct objects with proper geometry
    const geoLoader = new BufferGeometryLoader()
    snapshot.objects.forEach((obj) => {
      let geo: THREE.BufferGeometry

      if (obj.type === 'merged-mesh' && obj.geometryJSON) {
        // Deserialize the exact merged geometry sent by the editor
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        geo = geoLoader.parse(obj.geometryJSON as any)
      } else {
        geo = buildGeometry(obj.geometryType, obj.geometryParams)
      }

      const mat = new THREE.MeshStandardMaterial({
        color: obj.color ?? '#3b82f6',
        wireframe: displayMode === 'wireframe',
      })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.name = obj.name
      mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
      mesh.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
      mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
      mesh.visible = obj.visible
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      viewerMeshesRef.current.push(mesh)

      // Permanent wireframe edge overlay for merged objects (mirrors the editor overlay)
      if (obj.type === 'merged-mesh') {
        const edges = new THREE.EdgesGeometry(geo)
        const wireMat = new THREE.LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.65 })
        const wireframe = new THREE.LineSegments(edges, wireMat)
        wireframe.name = '__wireframe__'
        mesh.add(wireframe)
      }

      if (displayMode === 'solid+wire') {
        const wireMat = new THREE.MeshBasicMaterial({
          color: '#ffffff', wireframe: true, opacity: 0.15, transparent: true,
        })
        const wireMesh = new THREE.Mesh(geo.clone(), wireMat)
        mesh.add(wireMesh)
      }
    })

    // Set camera from snapshot
    const cam = snapshot.cameras[0]
    const camera = cameraRef.current
    if (cam && camera) {
      camera.position.set(cam.position.x, cam.position.y, cam.position.z)
      controlsRef.current?.target.set(cam.target.x, cam.target.y, cam.target.z)
      controlsRef.current?.update()
    }
  }, [snapshot, displayMode, localLightIntensity])

  const MODES: Array<{ id: DisplayMode; label: string }> = [
    { id: 'solid', label: '● Solid' },
    { id: 'wireframe', label: '⬡ Wire' },
    { id: 'solid+wire', label: '◈ Solid+Wire' },
  ]

  return (
    <div style={styles.panel}>
      <div style={styles.toolbar}>
        {MODES.map((m) => (
          <button
            key={m.id}
            style={{ ...styles.toolBtn, ...(displayMode === m.id ? styles.toolBtnActive : {}) }}
            onClick={() => setDisplayMode(m.id)}
          >
            {m.label}
          </button>
        ))}
        <div style={styles.sep} />
        <label style={styles.sliderLabel}>Light</label>
        <input
          type="range"
          min={0}
          max={2}
          step={0.1}
          value={localLightIntensity}
          onChange={(e) => setLocalLightIntensity(Number(e.target.value))}
          style={{ width: 80 }}
        />
        <span style={styles.sliderValue}>{localLightIntensity.toFixed(1)}x</span>
        {!snapshot && <span style={styles.hint}>Sync from 3D Editor to preview scene</span>}
        {snapshot && (
          <span style={styles.hint}>
            {snapshot.objects.length} object{snapshot.objects.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div ref={mountRef} style={styles.viewport} />
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
  toolBtnActive: { background: '#2d4a6e', borderColor: '#3b82f6', color: '#7eb3f7' },
  sep: { width: 1, height: 20, background: '#444', margin: '0 4px' },
  sliderLabel: { color: '#888', fontSize: 12 },
  sliderValue: { color: '#aaa', fontSize: 11, minWidth: 28 },
  hint: { color: '#555', fontSize: 11, marginLeft: 8 },
  viewport: { flex: 1, overflow: 'hidden' },
}
