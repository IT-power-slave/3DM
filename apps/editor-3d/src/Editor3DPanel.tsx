import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type {
  SceneSnapshot,
  SceneObject,
  SceneLight,
  SceneCamera,
  ShapeDescriptorBatch,
  GeometryType,
  GeometryParams,
} from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'

function generateId() {
  return `obj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

type PrimitiveType = 'box' | 'sphere' | 'cylinder' | 'cone' | 'plane'
type TransformMode = 'translate' | 'rotate' | 'scale'

interface ObjectMeta {
  id: string
  name: string
  color: string
  /** 'merged-mesh' marks objects produced by the Object Merge operation */
  objectType?: 'mesh' | 'merged-mesh'
  geometryType: GeometryType
  geometryParams: GeometryParams
}

/** A single entry on the undo stack — currently only merge steps are tracked. */
interface UndoStep {
  type: 'merge'
  mergedId: string
  sources: Array<{
    id: string
    mesh: THREE.Mesh
    meta: ObjectMeta
    /** true = source was deleted; false = source was hidden */
    deleted: boolean
    originalVisible: boolean
  }>
}

function buildGeometry(type: GeometryType, params: GeometryParams): THREE.BufferGeometry {
  switch (type) {
    case 'box':
      return new THREE.BoxGeometry(params.width ?? 1, params.height ?? 1, params.depth ?? 1)
    case 'sphere':
      return new THREE.SphereGeometry(params.radius ?? 0.5, params.radialSegments ?? 32, 16)
    case 'cylinder':
      return new THREE.CylinderGeometry(
        params.radius ?? 0.5,
        params.radius ?? 0.5,
        params.height ?? 1,
        params.radialSegments ?? 32,
      )
    case 'cone':
      return new THREE.ConeGeometry(params.radius ?? 0.5, params.height ?? 1, params.radialSegments ?? 32)
    case 'plane':
      return new THREE.PlaneGeometry(params.width ?? 2, params.height ?? 2)
    case 'extrude-rect': {
      const shape = new THREE.Shape()
      const w = params.width ?? 1
      const h = params.height ?? 1
      shape.moveTo(0, 0)
      shape.lineTo(w, 0)
      shape.lineTo(w, h)
      shape.lineTo(0, h)
      shape.closePath()
      return new THREE.ExtrudeGeometry(shape, { depth: params.depth ?? 0.5, bevelEnabled: false })
    }
    case 'extrude-ellipse': {
      const rx = params.rx ?? 0.5
      const ry = params.ry ?? 0.5
      const shape = new THREE.Shape()
      shape.absellipse(0, 0, rx, ry, 0, Math.PI * 2, false, 0)
      return new THREE.ExtrudeGeometry(shape, { depth: params.depth ?? 0.5, bevelEnabled: false })
    }
    default:
      return new THREE.BoxGeometry(1, 1, 1)
  }
}

export function Editor3DPanel(): React.ReactElement {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const orbitRef = useRef<OrbitControls | null>(null)
  const transformRef = useRef<TransformControls | null>(null)
  const frameIdRef = useRef<number>(0)
  const objectsRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const metaRef = useRef<Map<string, ObjectMeta>>(new Map())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [objectList, setObjectList] = useState<ObjectMeta[]>([])
  const [transformMode, setTransformMode] = useState<TransformMode>('translate')
  // Merge selection — independent of transform selection
  const [mergeSelectedIds, setMergeSelectedIds] = useState<string[]>([])
  const [mergeDialog, setMergeDialog] = useState<{ open: boolean; name: string; keepSources: boolean }>({
    open: false, name: '', keepSources: false,
  })
  const [mergeInfo, setMergeInfo] = useState<string | null>(null)
  const [canUndo, setCanUndo] = useState(false)
  const undoStackRef = useRef<UndoStep[]>([])

  // Announce MFE ready
  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-3d',
        criticality: 'critical',
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
    scene.background = new THREE.Color('#1e1e1e')
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 1000)
    camera.position.set(5, 5, 5)
    cameraRef.current = camera

    // OrbitControls
    const orbit = new OrbitControls(camera, renderer.domElement)
    orbit.enableDamping = true
    orbitRef.current = orbit

    // TransformControls
    // NOTE: In Three.js r160+, TransformControls extends Controls (not Object3D).
    // tc.dispose() calls this.traverse() which doesn't exist on Controls — it crashes.
    // Use tc.disconnect() for cleanup instead.
    const tc = new TransformControls(camera, renderer.domElement)
    tc.addEventListener('dragging-changed', (ev) => {
      orbit.enabled = !(ev as THREE.Event & { value: boolean }).value
    })
    tc.addEventListener('objectChange', () => {
      bus.emit('dirty:changed', {
        schemaVersion: SCHEMA_VERSION,
        source: 'mfe-3d',
        isDirty: true,
        timestamp: new Date().toISOString(),
      })
    })
    // getHelper() returns TransformControlsRoot (an Object3D) — track it for cleanup
    const tcHelper = tc.getHelper()
    scene.add(tcHelper)
    transformRef.current = tc

    // Default lights
    const ambient = new THREE.AmbientLight(0xffffff, 0.4)
    ambient.name = 'ambient_default'
    scene.add(ambient)

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2)
    dirLight.position.set(5, 10, 5)
    dirLight.castShadow = true
    dirLight.name = 'dir_default'
    scene.add(dirLight)

    // Grid helper
    const grid = new THREE.GridHelper(20, 20, '#333333', '#2a2a2a')
    scene.add(grid)

    const animate = () => {
      frameIdRef.current = requestAnimationFrame(animate)
      orbit.update()
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

    return () => {
      cancelAnimationFrame(frameIdRef.current)
      ro.disconnect()
      // tc.dispose() crashes in r169 (TransformControls.traverse is not a function).
      // Use disconnect() to remove DOM listeners, then remove the visual helper.
      tc.disconnect()
      scene.remove(tcHelper)
      orbit.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
      rendererRef.current = null
      sceneRef.current = null
      cameraRef.current = null
      orbitRef.current = null
      transformRef.current = null
    }
  }, [])

  // Publish scene snapshot to viewer / export
  const publishSnapshot = useCallback(() => {
    const scene = sceneRef.current
    const camera = cameraRef.current
    if (!scene || !camera) return

    const objects: SceneObject[] = []
    objectsRef.current.forEach((mesh, id) => {
      const meta = metaRef.current.get(id)
      objects.push({
        objectId: id,
        type: meta?.objectType === 'merged-mesh' ? 'merged-mesh' : 'mesh',
        name: mesh.name,
        parentId: null,
        position: { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z },
        rotation: {
          x: mesh.quaternion.x,
          y: mesh.quaternion.y,
          z: mesh.quaternion.z,
          w: mesh.quaternion.w,
        },
        scale: { x: mesh.scale.x, y: mesh.scale.y, z: mesh.scale.z },
        visible: mesh.visible,
        castShadow: mesh.castShadow,
        receiveShadow: mesh.receiveShadow,
        geometryType: meta?.geometryType,
        geometryParams: meta?.geometryParams,
        color: meta?.color,
      })
    })

    const defaultLights: SceneLight[] = [
      { lightId: 'ambient_default', type: 'ambient', color: { r: 1, g: 1, b: 1 }, intensity: 0.4 },
      {
        lightId: 'dir_default',
        type: 'directional',
        color: { r: 1, g: 1, b: 1 },
        intensity: 1.2,
        position: { x: 5, y: 10, z: 5 },
      },
    ]

    const cameras: SceneCamera[] = [
      {
        cameraId: 'default_cam',
        name: 'Default Camera',
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        target: { x: 0, y: 0, z: 0 },
        fov: camera.fov,
        near: camera.near,
        far: camera.far,
      },
    ]

    const snapshot: SceneSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      snapshotId: generateId(),
      objects,
      defaultLights,
      cameras,
      capturedAt: new Date().toISOString(),
    }
    bus.emit('scene:snapshot', snapshot)
  }, [])

  // Force resize when panel becomes active; auto-sync viewer when it's opened
  useEffect(() => {
    const unsub = bus.on('panel:activated', (ev) => {
      if (ev.panelId === 'viewer') {
        // Auto-push current scene snapshot so viewer is always up-to-date
        publishSnapshot()
      }
      if (ev.panelId === '3d') {
        const el = mountRef.current
        const renderer = rendererRef.current
        const camera = cameraRef.current
        if (!el || !renderer || !camera) return
        const w = el.clientWidth
        const h = el.clientHeight
        if (w > 0 && h > 0) {
          renderer.setSize(w, h)
          camera.aspect = w / h
          camera.updateProjectionMatrix()
        }
      }
    })
    return unsub
  }, [publishSnapshot])

  // Select object via TransformControls
  const selectObject = useCallback((id: string | null) => {
    const tc = transformRef.current
    const scene = sceneRef.current
    if (!tc || !scene) return

    setSelectedId(id)
    if (id) {
      const mesh = objectsRef.current.get(id)
      if (mesh) {
        tc.attach(mesh)
      }
    } else {
      tc.detach()
    }
  }, [])

  // Change transform mode
  useEffect(() => {
    const tc = transformRef.current
    if (tc) tc.setMode(transformMode)
  }, [transformMode])

  // Internal helper to add a mesh to the scene
  const addMesh = useCallback(
    (
      geo: THREE.BufferGeometry,
      meta: ObjectMeta,
    ) => {
      const scene = sceneRef.current
      if (!scene) return

      const material = new THREE.MeshStandardMaterial({ color: meta.color })
      const mesh = new THREE.Mesh(geo, material)
      mesh.name = meta.name
      mesh.castShadow = true
      mesh.receiveShadow = true
      scene.add(mesh)
      objectsRef.current.set(meta.id, mesh)
      metaRef.current.set(meta.id, meta)
      setObjectList((prev) => [...prev, meta])

      bus.emit('dirty:changed', {
        schemaVersion: SCHEMA_VERSION,
        source: 'mfe-3d',
        isDirty: true,
        timestamp: new Date().toISOString(),
      })
    },
    [],
  )

  // Add primitive
  const addPrimitive = useCallback(
    (type: PrimitiveType) => {
      const id = generateId()
      const geoTypeMap: Record<PrimitiveType, GeometryType> = {
        box: 'box', sphere: 'sphere', cylinder: 'cylinder', cone: 'cone', plane: 'plane',
      }
      const paramsMap: Record<PrimitiveType, GeometryParams> = {
        box: { width: 1, height: 1, depth: 1 },
        sphere: { radius: 0.5, radialSegments: 32 },
        cylinder: { radius: 0.5, height: 1, radialSegments: 32 },
        cone: { radius: 0.5, height: 1, radialSegments: 32 },
        plane: { width: 2, height: 2 },
      }
      const geoType = geoTypeMap[type]
      const params = paramsMap[type]
      const name = `${type}_${id.slice(-4)}`
      const color = '#3b82f6'
      const geo = buildGeometry(geoType, params)
      const meta: ObjectMeta = { id, name, color, geometryType: geoType, geometryParams: params }
      addMesh(geo, meta)
    },
    [addMesh],
  )

  // Toggle an object's inclusion in the merge selection (independent of transform selection)
  const toggleMergeSelect = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setMergeSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  // Open merge confirmation dialog
  const openMergeDialog = useCallback(() => {
    if (mergeSelectedIds.length < 2) {
      setMergeInfo('Select at least 2 objects to merge')
      setTimeout(() => setMergeInfo(null), 3000)
      return
    }
    const firstName = metaRef.current.get(mergeSelectedIds[0])?.name ?? 'Object'
    setMergeDialog({ open: true, name: `Merged_${firstName}`, keepSources: false })
  }, [mergeSelectedIds])

  // Execute the merge operation
  const executeMerge = useCallback(() => {
    const scene = sceneRef.current
    if (!scene || mergeSelectedIds.length < 2) return

    const geometriesToMerge: THREE.BufferGeometry[] = []
    const undoSources: UndoStep['sources'] = []

    // Compute combined bounding box for centroid placement
    const combinedBox = new THREE.Box3()
    for (const id of mergeSelectedIds) {
      const mesh = objectsRef.current.get(id)
      if (mesh) combinedBox.expandByObject(mesh)
    }
    const centroid = combinedBox.getCenter(new THREE.Vector3())

    // Bake each source object's world transform into a cloned geometry
    for (const id of mergeSelectedIds) {
      const mesh = objectsRef.current.get(id)
      const meta = metaRef.current.get(id)
      if (!mesh || !meta) continue
      mesh.updateWorldMatrix(true, false)
      const clonedGeo = mesh.geometry.clone()
      clonedGeo.applyMatrix4(mesh.matrixWorld)
      geometriesToMerge.push(clonedGeo)
      undoSources.push({ id, mesh, meta, deleted: !mergeDialog.keepSources, originalVisible: mesh.visible })
    }

    if (geometriesToMerge.length < 2) return

    const merged = mergeGeometries(geometriesToMerge, false)
    geometriesToMerge.forEach((g) => g.dispose()) // dispose world-space clones

    if (!merged) {
      setMergeInfo('Merge failed: incompatible geometry attributes')
      setTimeout(() => setMergeInfo(null), 3000)
      setMergeDialog({ open: false, name: '', keepSources: false })
      return
    }

    // Re-express merged geometry relative to centroid
    merged.translate(-centroid.x, -centroid.y, -centroid.z)

    // Build merged mesh with permanent wireframe edge overlay
    const mergedId = generateId()
    const material = new THREE.MeshStandardMaterial({ color: '#3b82f6' })
    const mergedMesh = new THREE.Mesh(merged, material)
    mergedMesh.name = mergeDialog.name
    mergedMesh.position.copy(centroid)
    mergedMesh.castShadow = true
    mergedMesh.receiveShadow = true

    const edges = new THREE.EdgesGeometry(merged)
    const wireMat = new THREE.LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.65 })
    const wireframe = new THREE.LineSegments(edges, wireMat)
    wireframe.name = '__wireframe__'
    mergedMesh.add(wireframe)

    scene.add(mergedMesh)

    const mergedMeta: ObjectMeta = {
      id: mergedId,
      name: mergeDialog.name,
      color: '#3b82f6',
      objectType: 'merged-mesh',
      geometryType: 'box',
      geometryParams: {},
    }
    objectsRef.current.set(mergedId, mergedMesh)
    metaRef.current.set(mergedId, mergedMeta)

    // Remove or hide source objects
    undoSources.forEach(({ id: srcId, mesh: srcMesh }) => {
      if (mergeDialog.keepSources) {
        srcMesh.visible = false
      } else {
        if (selectedId === srcId) {
          transformRef.current?.detach()
          setSelectedId(null)
        }
        scene.remove(srcMesh)
        objectsRef.current.delete(srcId)
        metaRef.current.delete(srcId)
      }
    })

    setObjectList([...metaRef.current.values()])
    setMergeSelectedIds([])
    setMergeDialog({ open: false, name: '', keepSources: false })

    undoStackRef.current.push({ type: 'merge', mergedId, sources: undoSources })
    setCanUndo(true)

    bus.emit('dirty:changed', {
      schemaVersion: SCHEMA_VERSION,
      source: 'mfe-3d',
      isDirty: true,
      timestamp: new Date().toISOString(),
    })
    publishSnapshot()
  }, [mergeSelectedIds, mergeDialog, selectedId, publishSnapshot])

  // Undo last merge operation
  const undoLast = useCallback(() => {
    const step = undoStackRef.current[undoStackRef.current.length - 1]
    if (!step) return
    const scene = sceneRef.current
    if (!scene) return

    undoStackRef.current.pop()

    if (step.type === 'merge') {
      const mergedMesh = objectsRef.current.get(step.mergedId)
      if (mergedMesh) {
        if (selectedId === step.mergedId) {
          transformRef.current?.detach()
          setSelectedId(null)
        }
        scene.remove(mergedMesh)
        mergedMesh.traverse((child) => {
          const c = child as THREE.Mesh
          if (c.geometry) c.geometry.dispose()
          if (c.material) {
            if (Array.isArray(c.material)) c.material.forEach((m) => m.dispose())
            else (c.material as THREE.Material).dispose()
          }
        })
        objectsRef.current.delete(step.mergedId)
        metaRef.current.delete(step.mergedId)
      }

      // Restore sources to their pre-merge state
      step.sources.forEach(({ id, mesh, meta, deleted, originalVisible }) => {
        mesh.visible = originalVisible
        if (deleted) {
          scene.add(mesh)
          objectsRef.current.set(id, mesh)
          metaRef.current.set(id, meta)
        }
      })

      setObjectList([...metaRef.current.values()])
      setCanUndo(undoStackRef.current.length > 0)

      bus.emit('dirty:changed', {
        schemaVersion: SCHEMA_VERSION,
        source: 'mfe-3d',
        isDirty: true,
        timestamp: new Date().toISOString(),
      })
      publishSnapshot()
    }
  }, [selectedId, publishSnapshot])
  useEffect(() => {
    const unsub = bus.on('shapes:publish', (batch: ShapeDescriptorBatch) => {
      const results = batch.shapes.map((shape) => {
        try {
          let geoType: GeometryType = 'box'
          let params: GeometryParams = {}
          const color = shape.style.fill ?? '#3b82f6'

          if (shape.type === 'rect') {
            geoType = 'extrude-rect'
            params = { width: shape.width / 50, height: shape.height / 50, depth: 0.5 }
          } else if (shape.type === 'ellipse') {
            geoType = 'extrude-ellipse'
            params = { rx: shape.rx / 50, ry: shape.ry / 50, depth: 0.5 }
          } else {
            geoType = 'box'
            params = { width: 1, height: 1, depth: 1 }
          }

          const id = `2d_${shape.shapeId}`
          // Remove existing if re-published
          const existing = objectsRef.current.get(id)
          if (existing && sceneRef.current) {
            sceneRef.current.remove(existing)
            objectsRef.current.delete(id)
            metaRef.current.delete(id)
            setObjectList((prev) => prev.filter((o) => o.id !== id))
          }

          const meta: ObjectMeta = { id, name: shape.name, color, geometryType: geoType, geometryParams: params }
          const geo = buildGeometry(geoType, params)
          addMesh(geo, meta)

          return { shapeId: shape.shapeId, status: 'accepted' as const }
        } catch (err) {
          return { shapeId: shape.shapeId, status: 'rejected' as const, reason: String(err) }
        }
      })

      bus.emit('shapes:ack', {
        schemaVersion: SCHEMA_VERSION,
        batchId: batch.batchId,
        results,
      })

      // Auto-sync viewer after importing 2D shapes
      publishSnapshot()
    })
    return unsub
  }, [addMesh, publishSnapshot])

  // Restore scene from project
  useEffect(() => {
    const unsub = bus.on('project:restore', (data) => {
      const scene = sceneRef.current
      if (!scene) return

      // Clear user objects (keep lights and grid)
      objectsRef.current.forEach((mesh) => scene.remove(mesh))
      objectsRef.current.clear()
      metaRef.current.clear()
      setObjectList([])
      setSelectedId(null)
      transformRef.current?.detach()

      // Restore from snapshot
      if (data.sceneSnapshot) {
        data.sceneSnapshot.objects.forEach((obj) => {
          const geoType = obj.geometryType ?? 'box'
          const params = obj.geometryParams ?? {}
          const color = obj.color ?? '#3b82f6'
          const geo = buildGeometry(geoType, params)
          const meta: ObjectMeta = { id: obj.objectId, name: obj.name, color, geometryType: geoType, geometryParams: params }

          const material = new THREE.MeshStandardMaterial({ color })
          const mesh = new THREE.Mesh(geo, material)
          mesh.name = obj.name
          mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
          mesh.quaternion.set(obj.rotation.x, obj.rotation.y, obj.rotation.z, obj.rotation.w)
          mesh.scale.set(obj.scale.x, obj.scale.y, obj.scale.z)
          mesh.visible = obj.visible
          mesh.castShadow = obj.castShadow
          mesh.receiveShadow = obj.receiveShadow
          scene.add(mesh)
          objectsRef.current.set(obj.objectId, mesh)
          metaRef.current.set(obj.objectId, meta)
        })
        setObjectList([...metaRef.current.values()])
      }
    })
    return unsub
  }, [])

  // Delete selected — also evict from merge selection
  const deleteSelected = useCallback(() => {
    if (!selectedId) return
    const scene = sceneRef.current
    const mesh = objectsRef.current.get(selectedId)
    if (mesh && scene) {
      transformRef.current?.detach()
      scene.remove(mesh)
      objectsRef.current.delete(selectedId)
      metaRef.current.delete(selectedId)
      setObjectList((prev) => prev.filter((o) => o.id !== selectedId))
      setMergeSelectedIds((prev) => prev.filter((id) => id !== selectedId))
      setSelectedId(null)

      bus.emit('dirty:changed', {
        schemaVersion: SCHEMA_VERSION,
        source: 'mfe-3d',
        isDirty: true,
        timestamp: new Date().toISOString(),
      })
    }
  }, [selectedId])

  const PRIMITIVES: Array<{ type: PrimitiveType; label: string }> = [
    { type: 'box', label: '□ Box' },
    { type: 'sphere', label: '○ Sphere' },
    { type: 'cylinder', label: '⬤ Cyl' },
    { type: 'cone', label: '△ Cone' },
    { type: 'plane', label: '▭ Plane' },
  ]

  const TRANSFORM_MODES: Array<{ mode: TransformMode; label: string }> = [
    { mode: 'translate', label: '↔ Move' },
    { mode: 'rotate', label: '↻ Rotate' },
    { mode: 'scale', label: '⤢ Scale' },
  ]

  return (
    <div style={styles.panel}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <span style={styles.label}>Add:</span>
        {PRIMITIVES.map((p) => (
          <button key={p.type} style={styles.toolBtn} onClick={() => addPrimitive(p.type)}>
            {p.label}
          </button>
        ))}
        <div style={styles.sep} />
        <span style={styles.label}>Transform:</span>
        {TRANSFORM_MODES.map((m) => (
          <button
            key={m.mode}
            style={{ ...styles.toolBtn, ...(transformMode === m.mode ? styles.toolBtnActive : {}) }}
            onClick={() => setTransformMode(m.mode)}
            disabled={!selectedId}
          >
            {m.label}
          </button>
        ))}
        <div style={styles.sep} />
        <button style={styles.dangerBtn} onClick={deleteSelected} disabled={!selectedId}>
          🗑 Del
        </button>
        <div style={styles.sep} />
        <button
          style={{ ...styles.mergeBtn, ...(mergeSelectedIds.length < 2 ? styles.mergeBtnDisabled : {}) }}
          onClick={openMergeDialog}
          disabled={mergeSelectedIds.length < 2}
          title={mergeSelectedIds.length < 2 ? 'Check ≥2 objects in the outliner to merge' : `Merge ${mergeSelectedIds.length} objects`}
        >
          ⊕ Merge{mergeSelectedIds.length >= 2 ? ` (${mergeSelectedIds.length})` : ''}
        </button>
        <button
          style={{ ...styles.undoBtn, ...(canUndo ? {} : styles.undoBtnDisabled) }}
          onClick={undoLast}
          disabled={!canUndo}
          title="Undo last merge"
        >
          ↩ Undo
        </button>
        {mergeInfo && <span style={styles.mergeInfo}>{mergeInfo}</span>}
        <div style={styles.sep} />
        <button style={styles.actionBtn} onClick={publishSnapshot}>
          📡 Sync Viewer
        </button>
      </div>

      <div style={styles.body}>
        {/* Outliner */}
        <div style={styles.outliner}>
          <p style={styles.outlinerTitle}>Scene ({objectList.length})</p>
          {objectList.length === 0 && (
            <p style={styles.empty}>No objects</p>
          )}
          {objectList.map((o) => (
            <div
              key={o.id}
              style={{
                ...styles.outlinerItem,
                ...(selectedId === o.id ? styles.outlinerItemSelected : {}),
                ...(mergeSelectedIds.includes(o.id) ? styles.outlinerItemMerge : {}),
              }}
              onClick={() => selectObject(selectedId === o.id ? null : o.id)}
            >
              <input
                type="checkbox"
                style={styles.mergeCheck}
                checked={mergeSelectedIds.includes(o.id)}
                onClick={(e) => toggleMergeSelect(o.id, e)}
                onChange={() => {}} // controlled by onClick
                title="Add to merge selection"
              />
              <span
                style={{
                  ...styles.colorDot,
                  background: o.color,
                  border: o.objectType === 'merged-mesh' ? '1px solid #00ff88' : '1px solid rgba(255,255,255,0.2)',
                }}
              />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {o.objectType === 'merged-mesh' ? '⊕ ' : ''}{o.name}
              </span>
            </div>
          ))}
        </div>

        {/* 3D Viewport */}
        <div ref={mountRef} style={styles.viewport} />
      </div>

      {/* Merge Dialog */}
      {mergeDialog.open && (
        <div style={styles.dialogOverlay}>
          <div style={styles.dialog}>
            <p style={styles.dialogTitle}>⊕ Merge Objects</p>
            <label style={styles.dialogLabel}>
              Name
              <input
                style={styles.dialogInput}
                value={mergeDialog.name}
                onChange={(e) => setMergeDialog((d) => ({ ...d, name: e.target.value }))}
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') executeMerge(); if (e.key === 'Escape') setMergeDialog({ open: false, name: '', keepSources: false }) }}
              />
            </label>
            <label style={styles.dialogCheckLabel}>
              <input
                type="checkbox"
                checked={mergeDialog.keepSources}
                onChange={(e) => setMergeDialog((d) => ({ ...d, keepSources: e.target.checked }))}
              />
              Keep source objects (hide instead of delete)
            </label>
            <div style={styles.dialogActions}>
              <button style={styles.dialogCancelBtn} onClick={() => setMergeDialog({ open: false, name: '', keepSources: false })}>
                Cancel
              </button>
              <button style={styles.dialogMergeBtn} onClick={executeMerge}>
                Merge {mergeSelectedIds.length} objects
              </button>
            </div>
          </div>
        </div>
      )}
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
  label: { color: '#888', fontSize: 11, marginRight: 2 },
  toolBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#ccc',
    fontSize: 12,
    cursor: 'pointer',
  },
  toolBtnActive: { background: '#2d4a6e', borderColor: '#3b82f6', color: '#7eb3f7' },
  sep: { width: 1, height: 20, background: '#444', margin: '0 4px', flexShrink: 0 },
  dangerBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#f87171',
    fontSize: 12,
    cursor: 'pointer',
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
  body: { display: 'flex', flex: 1, overflow: 'hidden' },
  outliner: {
    width: 180,
    background: '#1e1e1e',
    borderRight: '1px solid #333',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'auto',
    flexShrink: 0,
  },
  outlinerTitle: { fontSize: 11, color: '#666', padding: '8px 10px', borderBottom: '1px solid #2a2a2a', margin: 0 },
  outlinerItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 10px',
    fontSize: 12,
    color: '#ccc',
    cursor: 'pointer',
    borderBottom: '1px solid #252525',
  },
  outlinerItemSelected: { background: '#2d4a6e', color: '#7eb3f7' },
  outlinerItemMerge: { background: '#1a2f1a', outline: '1px solid #00ff8844' },
  mergeCheck: { flexShrink: 0, cursor: 'pointer', accentColor: '#00ff88', margin: 0 },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    border: '1px solid rgba(255,255,255,0.2)',
  },
  empty: { fontSize: 11, color: '#555', padding: '8px 10px' },
  viewport: { flex: 1, overflow: 'hidden', position: 'relative' },
  mergeBtn: {
    padding: '4px 10px',
    background: '#1a2f1a',
    border: '1px solid #00cc66',
    borderRadius: 4,
    color: '#00ff88',
    fontSize: 12,
    cursor: 'pointer',
  },
  mergeBtnDisabled: { opacity: 0.35, cursor: 'default' },
  undoBtn: {
    padding: '4px 8px',
    background: 'transparent',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#aaa',
    fontSize: 12,
    cursor: 'pointer',
  },
  undoBtnDisabled: { opacity: 0.3, cursor: 'default' },
  mergeInfo: {
    fontSize: 11,
    color: '#f87171',
    padding: '0 6px',
  },
  dialogOverlay: {
    position: 'absolute' as const,
    inset: 0,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: '#252525',
    border: '1px solid #444',
    borderRadius: 8,
    padding: '20px 24px',
    minWidth: 320,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
  },
  dialogTitle: { margin: 0, fontSize: 14, color: '#00ff88', fontWeight: 600 },
  dialogLabel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 4,
    fontSize: 12,
    color: '#aaa',
  },
  dialogInput: {
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#eee',
    padding: '6px 8px',
    fontSize: 13,
    outline: 'none',
  },
  dialogCheckLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 12,
    color: '#aaa',
    cursor: 'pointer',
  },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  dialogCancelBtn: {
    padding: '6px 14px',
    background: 'transparent',
    border: '1px solid #555',
    borderRadius: 4,
    color: '#aaa',
    fontSize: 12,
    cursor: 'pointer',
  },
  dialogMergeBtn: {
    padding: '6px 16px',
    background: '#1a2f1a',
    border: '1px solid #00cc66',
    borderRadius: 4,
    color: '#00ff88',
    fontSize: 12,
    cursor: 'pointer',
    fontWeight: 600,
  },
}
