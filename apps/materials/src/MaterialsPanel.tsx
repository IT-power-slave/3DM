import React, { useCallback, useEffect, useRef, useState } from 'react'
import type {
  MaterialDefinition,
  MaterialShadingModel,
} from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId(): string {
  return `mat_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function normalizedToHex(r: number, g: number, b: number): string {
  const toHex = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`
}

function hexToNormalized(hex: string): { r: number; g: number; b: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  if (!result) return { r: 0.8, g: 0.8, b: 0.8 }
  return {
    r: parseInt(result[1], 16) / 255,
    g: parseInt(result[2], 16) / 255,
    b: parseInt(result[3], 16) / 255,
  }
}

function makeDefaultMaterial(name: string): MaterialDefinition {
  return {
    materialId: genId(),
    name,
    shadingModel: 'lambert',
    diffuseColor: { r: 0.8, g: 0.8, b: 0.8 },
    specularColor: null,
    shininess: null,
    opacity: 1.0,
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MaterialsPanel(): React.ReactElement {
  const [materials, setMaterials] = useState<MaterialDefinition[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ matId: string } | null>(null)
  const [assignStatus, setAssignStatus] = useState<{
    type: 'pending' | 'success' | 'error'
    text: string
  } | null>(null)
  const [selectedObjectIds, setSelectedObjectIds] = useState<string[]>([])

  const materialsRef = useRef<MaterialDefinition[]>([])
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const assignTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Keep ref in sync with state
  useEffect(() => {
    materialsRef.current = materials
  }, [materials])

  const selectedMaterial = materials.find((m) => m.materialId === selectedId) ?? null

  // ─── Publish helpers ─────────────────────────────────────────────────────

  const publishRef = useCallback((mat: MaterialDefinition) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      bus.emit('material:reference', {
        schemaVersion: SCHEMA_VERSION,
        material: mat,
        action: 'upsert',
      })
      debounceRef.current = null
    }, 100)
  }, [])

  const publishLibrary = useCallback((mats: MaterialDefinition[]) => {
    bus.emit('material:library', { schemaVersion: SCHEMA_VERSION, materials: mats })
  }, [])

  const markDirty = useCallback(() => {
    bus.emit('dirty:changed', {
      schemaVersion: SCHEMA_VERSION,
      source: 'mfe-materials',
      isDirty: true,
      timestamp: new Date().toISOString(),
    })
  }, [])

  // ─── Bus listeners ────────────────────────────────────────────────────────

  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-materials',
        criticality: 'non-critical',
      })
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = bus.on('3d:selection', (sel) => {
      setSelectedObjectIds(sel.objectIds)
    })
    return unsub
  }, [])

  useEffect(() => {
    const unsub = bus.on('project:restore', (data) => {
      const lib = data.materialLibrary ?? []
      materialsRef.current = lib
      setMaterials(lib)
      setSelectedId(lib.length > 0 ? lib[0].materialId : null)
      // Re-publish all materials so viewer and editor reflect restored state
      lib.forEach((mat) => {
        bus.emit('material:reference', {
          schemaVersion: SCHEMA_VERSION,
          material: mat,
          action: 'upsert',
        })
      })
    })
    return unsub
  }, [])

  // ─── CRUD operations ──────────────────────────────────────────────────────

  const updateMaterial = useCallback(
    (updated: MaterialDefinition) => {
      const next = materialsRef.current.map((m) =>
        m.materialId === updated.materialId ? updated : m,
      )
      materialsRef.current = next
      setMaterials(next)
      publishRef(updated)
      publishLibrary(next)
      markDirty()
    },
    [publishRef, publishLibrary, markDirty],
  )

  const createMaterial = useCallback(() => {
    const mat = makeDefaultMaterial(`Material ${materialsRef.current.length + 1}`)
    const next = [...materialsRef.current, mat]
    materialsRef.current = next
    setMaterials(next)
    setSelectedId(mat.materialId)
    publishRef(mat)
    publishLibrary(next)
    markDirty()
  }, [publishRef, publishLibrary, markDirty])

  const duplicateMaterial = useCallback(
    (matId: string) => {
      const src = materialsRef.current.find((m) => m.materialId === matId)
      if (!src) return
      const dup: MaterialDefinition = { ...src, materialId: genId(), name: `${src.name} Copy` }
      const next = [...materialsRef.current, dup]
      materialsRef.current = next
      setMaterials(next)
      setSelectedId(dup.materialId)
      publishRef(dup)
      publishLibrary(next)
      markDirty()
    },
    [publishRef, publishLibrary, markDirty],
  )

  const requestDelete = useCallback((matId: string) => {
    setDeleteConfirm({ matId })
  }, [])

  const executeDelete = useCallback(() => {
    if (!deleteConfirm) return
    const { matId } = deleteConfirm
    const matToDelete = materialsRef.current.find((m) => m.materialId === matId)
    const next = materialsRef.current.filter((m) => m.materialId !== matId)
    materialsRef.current = next
    setMaterials(next)
    if (selectedId === matId) {
      setSelectedId(next.length > 0 ? next[0].materialId : null)
    }
    if (matToDelete) {
      bus.emit('material:reference', {
        schemaVersion: SCHEMA_VERSION,
        material: matToDelete,
        action: 'deleted',
      })
    }
    publishLibrary(next)
    markDirty()
    setDeleteConfirm(null)
  }, [deleteConfirm, selectedId, publishLibrary, markDirty])

  const switchShadingModel = useCallback(
    (mat: MaterialDefinition, model: MaterialShadingModel) => {
      if (mat.shadingModel === model) return
      const updated: MaterialDefinition =
        model === 'lambert'
          ? { ...mat, shadingModel: 'lambert', specularColor: null, shininess: null }
          : {
              ...mat,
              shadingModel: 'phong-blinn',
              specularColor: mat.specularColor ?? { r: 1, g: 1, b: 1 },
              shininess: mat.shininess ?? 32,
            }
      updateMaterial(updated)
    },
    [updateMaterial],
  )

  // ─── Material Assignment ──────────────────────────────────────────────────

  const assignMaterial = useCallback(() => {
    if (!selectedId) return
    const requestId = `assign_${Date.now()}`

    bus.emit('material:assign', {
      schemaVersion: SCHEMA_VERSION,
      requestId,
      materialId: selectedId,
      objectIds: selectedObjectIds,
    })

    setAssignStatus({ type: 'pending', text: 'Assigning…' })

    if (assignTimerRef.current) clearTimeout(assignTimerRef.current)
    assignTimerRef.current = setTimeout(() => {
      setAssignStatus({ type: 'error', text: 'Timeout — 3D Editor did not respond' })
      setTimeout(() => setAssignStatus(null), 3000)
    }, 2000)

    const cleanup = bus.on('material:assign-ack', (ack) => {
      if (ack.requestId !== requestId) return
      if (assignTimerRef.current) clearTimeout(assignTimerRef.current)
      cleanup()
      if (ack.accepted.length > 0) {
        setAssignStatus({ type: 'success', text: `Assigned to ${ack.accepted.length} object(s)` })
      } else {
        setAssignStatus({ type: 'error', text: 'No objects accepted the assignment' })
      }
      setTimeout(() => setAssignStatus(null), 3000)
    })
  }, [selectedId, selectedObjectIds])

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={s.root}>
      <div style={s.header}>🎨 Material Designer</div>

      <div style={s.body}>
        {/* ── Library Panel ──────────────────────────────────────── */}
        <div style={s.library}>
          <div style={s.libraryToolbar}>
            <button style={s.tbBtn} onClick={createMaterial} title="New material">
              + New
            </button>
            {selectedId && (
              <>
                <button
                  style={s.tbBtn}
                  onClick={() => duplicateMaterial(selectedId)}
                  title="Duplicate"
                >
                  ⧉
                </button>
                <button
                  style={{ ...s.tbBtn, ...s.deleteBtn }}
                  onClick={() => requestDelete(selectedId)}
                  title="Delete"
                >
                  🗑
                </button>
              </>
            )}
          </div>

          <div style={s.materialList}>
            {materials.length === 0 ? (
              <div style={s.empty}>No materials yet.{'\n'}Click + New to create one.</div>
            ) : (
              materials.map((mat) => (
                <div
                  key={mat.materialId}
                  style={{
                    ...s.matItem,
                    ...(mat.materialId === selectedId ? s.matItemSelected : {}),
                  }}
                  onClick={() => setSelectedId(mat.materialId)}
                >
                  <div
                    style={{
                      ...s.swatch,
                      background: normalizedToHex(
                        mat.diffuseColor.r,
                        mat.diffuseColor.g,
                        mat.diffuseColor.b,
                      ),
                    }}
                  />
                  <div style={s.matInfo}>
                    <div style={s.matName}>{mat.name}</div>
                    <div style={s.matModel}>
                      {mat.shadingModel === 'lambert' ? 'Diffuse' : 'Specular'}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Property Editor ────────────────────────────────────── */}
        <div style={s.propPanel}>
          {!selectedMaterial ? (
            <div style={s.empty}>Select or create a material to edit its properties.</div>
          ) : (
            <div style={s.propEditor}>
              {/* Name */}
              <div style={s.propRow}>
                <label style={s.propLabel}>Name</label>
                <input
                  style={s.nameInput}
                  value={selectedMaterial.name}
                  onChange={(e) => updateMaterial({ ...selectedMaterial, name: e.target.value })}
                />
              </div>

              {/* Shading model */}
              <div style={s.sectionLabel}>Shading Model</div>
              <div style={s.modelGroup}>
                {(['lambert', 'phong-blinn'] as const).map((model) => (
                  <label key={model} style={s.radioLabel}>
                    <input
                      type="radio"
                      name={`model-${selectedMaterial.materialId}`}
                      checked={selectedMaterial.shadingModel === model}
                      onChange={() => switchShadingModel(selectedMaterial, model)}
                    />
                    &nbsp;
                    {model === 'lambert' ? 'Diffuse (Lambert)' : 'Specular (Phong / Blinn-Phong)'}
                  </label>
                ))}
              </div>

              {/* Diffuse color */}
              <div style={s.propRow}>
                <label style={s.propLabel}>Diffuse Color</label>
                <div style={s.colorRow}>
                  <input
                    type="color"
                    style={s.colorPicker}
                    value={normalizedToHex(
                      selectedMaterial.diffuseColor.r,
                      selectedMaterial.diffuseColor.g,
                      selectedMaterial.diffuseColor.b,
                    )}
                    onChange={(e) =>
                      updateMaterial({
                        ...selectedMaterial,
                        diffuseColor: hexToNormalized(e.target.value),
                      })
                    }
                  />
                  <span style={s.colorHex}>
                    {normalizedToHex(
                      selectedMaterial.diffuseColor.r,
                      selectedMaterial.diffuseColor.g,
                      selectedMaterial.diffuseColor.b,
                    )}
                  </span>
                </div>
              </div>

              {/* Specular-only properties */}
              {selectedMaterial.shadingModel === 'phong-blinn' && (
                <>
                  <div style={s.propRow}>
                    <label style={s.propLabel}>Specular Color</label>
                    <div style={s.colorRow}>
                      <input
                        type="color"
                        style={s.colorPicker}
                        value={normalizedToHex(
                          selectedMaterial.specularColor?.r ?? 1,
                          selectedMaterial.specularColor?.g ?? 1,
                          selectedMaterial.specularColor?.b ?? 1,
                        )}
                        onChange={(e) =>
                          updateMaterial({
                            ...selectedMaterial,
                            specularColor: hexToNormalized(e.target.value),
                          })
                        }
                      />
                      <span style={s.colorHex}>
                        {normalizedToHex(
                          selectedMaterial.specularColor?.r ?? 1,
                          selectedMaterial.specularColor?.g ?? 1,
                          selectedMaterial.specularColor?.b ?? 1,
                        )}
                      </span>
                    </div>
                  </div>

                  <div style={s.propRow}>
                    <label style={s.propLabel}>Shininess</label>
                    <div style={s.sliderRow}>
                      <input
                        type="range"
                        min={1}
                        max={256}
                        style={s.slider}
                        value={selectedMaterial.shininess ?? 32}
                        onChange={(e) =>
                          updateMaterial({
                            ...selectedMaterial,
                            shininess: Number(e.target.value),
                          })
                        }
                      />
                      <span style={s.sliderVal}>{selectedMaterial.shininess ?? 32}</span>
                    </div>
                  </div>
                </>
              )}

              {/* Opacity */}
              <div style={s.propRow}>
                <label style={s.propLabel}>Opacity</label>
                <div style={s.sliderRow}>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    style={s.slider}
                    value={selectedMaterial.opacity}
                    onChange={(e) =>
                      updateMaterial({ ...selectedMaterial, opacity: Number(e.target.value) })
                    }
                  />
                  <span style={s.sliderVal}>{selectedMaterial.opacity.toFixed(2)}</span>
                </div>
              </div>

              {/* Assignment */}
              <div style={s.assignSection}>
                <div style={s.selInfo}>
                  {selectedObjectIds.length === 0
                    ? '⚠ No objects selected in 3D Editor'
                    : `${selectedObjectIds.length} object(s) selected in 3D Editor`}
                </div>
                <button
                  style={{
                    ...s.assignBtn,
                    ...(selectedObjectIds.length === 0 ? s.assignBtnDisabled : {}),
                  }}
                  disabled={selectedObjectIds.length === 0}
                  onClick={assignMaterial}
                >
                  Assign to Selected Objects
                </button>
                {assignStatus && (
                  <div
                    style={{
                      ...s.statusMsg,
                      ...(assignStatus.type === 'success' ? s.statusOk : {}),
                      ...(assignStatus.type === 'error' ? s.statusErr : {}),
                    }}
                  >
                    {assignStatus.text}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirmation dialog ─────────────────────────── */}
      {deleteConfirm && (
        <div style={s.overlay}>
          <div style={s.dialog}>
            <div style={s.dialogTitle}>Delete Material?</div>
            <div style={s.dialogMsg}>
              This material will be permanently removed. Any objects using it will revert to the
              default material.
            </div>
            <div style={s.dialogActions}>
              <button style={s.cancelBtn} onClick={() => setDeleteConfirm(null)}>
                Cancel
              </button>
              <button style={s.confirmDeleteBtn} onClick={executeDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: '100%',
    background: '#1a1a1a',
    color: '#e0e0e0',
    fontFamily: 'system-ui, sans-serif',
    fontSize: 13,
    overflow: 'hidden',
  },
  header: {
    padding: '10px 14px',
    borderBottom: '1px solid #333',
    fontWeight: 600,
    fontSize: 14,
    background: '#222',
    flexShrink: 0,
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },

  // Library panel
  library: {
    width: 200,
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #333',
    flexShrink: 0,
  },
  libraryToolbar: {
    display: 'flex',
    gap: 4,
    padding: '6px 8px',
    borderBottom: '1px solid #2a2a2a',
    flexShrink: 0,
  },
  tbBtn: {
    background: '#2d4a6e',
    color: '#7eb3f7',
    border: 'none',
    borderRadius: 3,
    padding: '4px 8px',
    cursor: 'pointer',
    fontSize: 12,
  },
  deleteBtn: {
    background: '#5a1a1a',
    color: '#f87171',
    marginLeft: 'auto',
  },
  materialList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 0',
  },
  matItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 10px',
    cursor: 'pointer',
    borderRadius: 4,
    margin: '1px 4px',
  },
  matItemSelected: {
    background: '#1e3a5f',
  },
  swatch: {
    width: 22,
    height: 22,
    borderRadius: 4,
    border: '1px solid #444',
    flexShrink: 0,
  },
  matInfo: { flex: 1, minWidth: 0 },
  matName: {
    fontWeight: 500,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  matModel: { fontSize: 11, color: '#888', marginTop: 1 },

  // Property panel
  propPanel: {
    flex: 1,
    overflowY: 'auto',
    padding: 14,
  },
  propEditor: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  propRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  propLabel: {
    width: 110,
    flexShrink: 0,
    color: '#aaa',
    fontSize: 12,
  },
  nameInput: {
    flex: 1,
    background: '#2a2a2a',
    border: '1px solid #444',
    borderRadius: 4,
    color: '#e0e0e0',
    padding: '4px 8px',
    fontSize: 13,
  },
  sectionLabel: {
    color: '#7eb3f7',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 4,
    paddingBottom: 4,
    borderBottom: '1px solid #2a2a2a',
  },
  modelGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    paddingLeft: 4,
  },
  radioLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    cursor: 'pointer',
    color: '#ccc',
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  colorPicker: {
    width: 40,
    height: 28,
    padding: 1,
    border: '1px solid #444',
    borderRadius: 3,
    background: 'transparent',
    cursor: 'pointer',
  },
  colorHex: {
    color: '#aaa',
    fontSize: 12,
    fontFamily: 'monospace',
  },
  sliderRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  slider: {
    flex: 1,
    accentColor: '#3b82f6',
  },
  sliderVal: {
    width: 36,
    textAlign: 'right',
    color: '#ccc',
    fontSize: 12,
    fontFamily: 'monospace',
  },

  // Assignment
  assignSection: {
    marginTop: 8,
    padding: '10px 0',
    borderTop: '1px solid #2a2a2a',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  selInfo: {
    color: '#888',
    fontSize: 12,
  },
  assignBtn: {
    background: '#2d4a6e',
    color: '#7eb3f7',
    border: 'none',
    borderRadius: 4,
    padding: '8px 14px',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  assignBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  statusMsg: {
    fontSize: 12,
    padding: '4px 8px',
    borderRadius: 4,
    background: '#2a2a2a',
    color: '#888',
  },
  statusOk: { background: '#1a3a1a', color: '#4ade80' },
  statusErr: { background: '#3a1a1a', color: '#f87171' },

  // Empty state
  empty: {
    color: '#555',
    fontSize: 12,
    textAlign: 'center',
    margin: 'auto',
    padding: 20,
    whiteSpace: 'pre-line',
  },

  // Delete dialog
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  dialog: {
    background: '#252525',
    border: '1px solid #444',
    borderRadius: 8,
    padding: 20,
    width: 320,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  dialogTitle: { fontWeight: 600, fontSize: 15 },
  dialogMsg: { color: '#aaa', fontSize: 13, lineHeight: 1.5 },
  dialogActions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  cancelBtn: {
    background: '#333',
    color: '#ccc',
    border: '1px solid #555',
    borderRadius: 4,
    padding: '6px 14px',
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    background: '#7f1d1d',
    color: '#fca5a5',
    border: 'none',
    borderRadius: 4,
    padding: '6px 14px',
    cursor: 'pointer',
    fontWeight: 600,
  },
}
