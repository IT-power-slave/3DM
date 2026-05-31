import React, { useEffect } from 'react'
import { useProjectStore } from './projectStore'
import { bus } from '@3dm/event-bus'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'

export function ProjectManagerPanel(): React.ReactElement {
  const { context, newProject, openProject, saveProject, saveProjectAs, closeProject } =
    useProjectStore()

  // Announce MFE ready and create initial project
  useEffect(() => {
    const unsub = bus.on('shell:ready', () => {
      if (!useProjectStore.getState().context.isOpen) {
        newProject()
      }
      bus.emit('mfe:ready', {
        schemaVersion: SCHEMA_VERSION,
        mfeId: 'mfe-project',
        criticality: 'critical',
      })
    })
    return unsub
  }, [newProject])

  // Listen for direct project commands (from keyboard shortcuts and menu)
  useEffect(() => {
    const unsub = bus.on('project:command', (ev) => {
      if (ev.command === 'save') void saveProject()
      if (ev.command === 'save-as') void saveProjectAs()
      if (ev.command === 'open') void openProject()
      if (ev.command === 'new') newProject()
    })
    return unsub
  }, [saveProject, saveProjectAs, openProject, newProject])

  // Listen for modal responses (menu-triggered confirmations)
  useEffect(() => {
    const unsub = bus.on('modal:response', (res) => {
      if (res.modalId === 'new-project' && res.action === 'confirm') newProject()
      if (res.modalId === 'open-project' && res.action === 'browse') void openProject()
      if (res.modalId === 'save-project' && res.action === 'save') void saveProject()
    })
    return unsub
  }, [newProject, openProject, saveProject])

  // Cache the latest canvas, scene snapshots, and material library so they're included in saves
  useEffect(() => {
    const u1 = bus.on('canvas:snapshot', (snap) => {
      useProjectStore.getState().setCanvasSnapshot(snap)
    })
    const u2 = bus.on('scene:snapshot', (snap) => {
      useProjectStore.getState().setSceneSnapshot(snap)
    })
    const u3 = bus.on('material:library', (ev) => {
      useProjectStore.getState().setMaterialLibrary(ev.materials)
    })
    return () => { u1(); u2(); u3() }
  }, [])

  // Propagate dirty signals from MFEs to project store
  useEffect(() => {
    const unsub = bus.on('dirty:changed', (sig) => {
      if (sig.isDirty && !useProjectStore.getState().context.isDirty) {
        useProjectStore.getState().setDirty(true)
      }
    })
    return unsub
  }, [])

  // Autosave every 30 seconds when project is open and dirty
  useEffect(() => {
    if (!context.isOpen || !context.isDirty) return
    const timer = setInterval(() => {
      void useProjectStore.getState().saveProject()
    }, 30_000)
    return () => clearInterval(timer)
  }, [context.isOpen, context.isDirty])

  // beforeunload guard
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (context.isDirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [context.isDirty])

  return (
    <div style={styles.panel}>
      <h3 style={styles.heading}>Project Manager</h3>

      <div style={styles.info}>
        <Row label="Name" value={context.name || '—'} />
        <Row label="Status" value={context.status} />
        <Row label="Dirty" value={context.isDirty ? '● Unsaved' : 'Saved'} />
        <Row
          label="Last Save"
          value={context.lastSavedAt ? new Date(context.lastSavedAt).toLocaleTimeString() : 'Never'}
        />
      </div>

      <div style={styles.actions}>
        <ActionBtn label="⊕ New Project" onClick={newProject} />
        <ActionBtn label="📂 Open…" onClick={() => void openProject()} />
        <ActionBtn label="💾 Save" onClick={() => void saveProject()} disabled={!context.isOpen} />
        <ActionBtn label="💾 Save As…" onClick={() => void saveProjectAs()} disabled={!context.isOpen} />
        <ActionBtn label="✕ Close" onClick={closeProject} disabled={!context.isOpen} danger />
      </div>

      <div style={styles.shortcuts}>
        <p style={styles.shortcutsTitle}>Keyboard Shortcuts</p>
        <ShortcutRow keys="Ctrl+N" label="New Project" />
        <ShortcutRow keys="Ctrl+S" label="Save" />
        <ShortcutRow keys="Ctrl+Shift+S" label="Save As" />
        <ShortcutRow keys="Ctrl+O" label="Open" />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={rowStyles.row}>
      <span style={rowStyles.label}>{label}</span>
      <span style={rowStyles.value}>{value}</span>
    </div>
  )
}

function ShortcutRow({ keys, label }: { keys: string; label: string }) {
  return (
    <div style={rowStyles.row}>
      <kbd style={rowStyles.kbd}>{keys}</kbd>
      <span style={{ ...rowStyles.label, fontSize: 11 }}>{label}</span>
    </div>
  )
}

function ActionBtn({
  label,
  onClick,
  disabled,
  danger,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      style={{
        ...styles.btn,
        ...(disabled ? styles.btnDisabled : {}),
        ...(danger ? styles.btnDanger : {}),
      }}
      onClick={onClick}
      disabled={disabled}
    >
      {label}
    </button>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: 16,
    background: '#1e1e1e',
    color: '#e0e0e0',
    gap: 16,
    overflowY: 'auto',
  },
  heading: { fontSize: 14, fontWeight: 600, color: '#7eb3f7', margin: 0 },
  info: {
    background: '#252525',
    borderRadius: 6,
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  actions: { display: 'flex', flexDirection: 'column', gap: 6 },
  shortcuts: {
    background: '#252525',
    borderRadius: 6,
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  shortcutsTitle: { fontSize: 10, color: '#666', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 4px' },
  btn: {
    padding: '8px 16px',
    background: '#2d4a6e',
    border: 'none',
    borderRadius: 4,
    color: '#7eb3f7',
    fontSize: 13,
    cursor: 'pointer',
    textAlign: 'left',
  },
  btnDisabled: { opacity: 0.4, cursor: 'default' },
  btnDanger: { background: '#4a1a1a', color: '#f87171' },
}

const rowStyles: Record<string, React.CSSProperties> = {
  row: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 },
  label: { color: '#888' },
  value: { color: '#ddd' },
  kbd: {
    background: '#1a1a1a',
    border: '1px solid #444',
    borderRadius: 3,
    padding: '1px 5px',
    fontSize: 10,
    color: '#aaa',
    fontFamily: 'monospace',
  },
}
