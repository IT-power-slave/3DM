import React from 'react'
import { useShellStore } from '../store/shellStore'
import { bus } from '@3dm/event-bus'

export function MenuBar(): React.ReactElement {
  const { projectContext, settings, updateSettings } = useShellStore()
  const { name, isDirty, isOpen } = projectContext

  const title = isOpen ? `${name}${isDirty ? ' *' : ''}` : '3D Studio'

  const toggleTheme = () => {
    const next = settings.theme === 'dark' ? 'light' : 'dark'
    updateSettings({ theme: next })
    bus.emit('settings:changed', { ...settings, theme: next })
  }

  return (
    <div style={styles.bar}>
      <div style={styles.left}>
        <span style={styles.logo}>⬡ 3D Studio</span>
        <MenuGroup label="File">
          <MenuItem label="New Project" shortcut="Ctrl+N" onClick={() => bus.emit('modal:request', {
            schemaVersion: '1.0.0',
            modalId: 'new-project',
            title: 'New Project',
            message: isDirty ? 'Unsaved changes will be lost. Continue?' : 'Create a new empty project?',
            actions: [
              { label: 'Create', action: 'confirm', variant: 'primary' },
              { label: 'Cancel', action: 'cancel' },
            ],
          })} />
          <MenuItem label="Open…" shortcut="Ctrl+O" onClick={() => bus.emit('modal:request', {
            schemaVersion: '1.0.0',
            modalId: 'open-project',
            title: 'Open Project',
            message: 'Choose a .3ds project file to open.',
            actions: [
              { label: 'Browse…', action: 'browse', variant: 'primary' },
              { label: 'Cancel', action: 'cancel' },
            ],
          })} />
          <MenuItem label="Save" shortcut="Ctrl+S" onClick={() => bus.emit('modal:request', {
            schemaVersion: '1.0.0',
            modalId: 'save-project',
            title: 'Save Project',
            message: 'Save the current project?',
            actions: [
              { label: 'Save', action: 'save', variant: 'primary' },
              { label: 'Cancel', action: 'cancel' },
            ],
          })} />
        </MenuGroup>
        <MenuGroup label="View">
          <MenuItem label={`Theme: ${settings.theme}`} onClick={toggleTheme} />
        </MenuGroup>
      </div>
      <div style={styles.center}>
        <span style={styles.title}>{title}</span>
      </div>
      <div style={styles.right} />
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function MenuGroup({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={styles.menuGroup}>
      <button style={styles.menuBtn} onClick={() => setOpen((o) => !o)}>
        {label}
      </button>
      {open && (
        <div style={styles.dropdown} onClick={() => setOpen(false)}>
          {children}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  label,
  shortcut,
  onClick,
}: {
  label: string
  shortcut?: string
  onClick: () => void
}) {
  return (
    <button style={styles.menuItem} onClick={onClick}>
      <span>{label}</span>
      {shortcut && <span style={styles.shortcut}>{shortcut}</span>}
    </button>
  )
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 36,
    background: '#2a2a2a',
    borderBottom: '1px solid #3a3a3a',
    flexShrink: 0,
    userSelect: 'none',
    position: 'relative',
    zIndex: 1000,
  },
  left: { display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8 },
  center: { position: 'absolute', left: '50%', transform: 'translateX(-50%)' },
  right: { flex: 1 },
  logo: { fontSize: 14, fontWeight: 700, color: '#7eb3f7', marginRight: 8 },
  title: { fontSize: 13, color: '#aaa' },
  menuGroup: { position: 'relative' },
  menuBtn: {
    background: 'transparent',
    border: 'none',
    color: '#ccc',
    fontSize: 13,
    padding: '4px 10px',
    cursor: 'pointer',
    borderRadius: 4,
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    background: '#2d2d2d',
    border: '1px solid #444',
    borderRadius: 4,
    padding: '4px 0',
    minWidth: 200,
    boxShadow: '0 4px 16px rgba(0,0,0,.5)',
    zIndex: 2000,
  },
  menuItem: {
    display: 'flex',
    justifyContent: 'space-between',
    width: '100%',
    background: 'transparent',
    border: 'none',
    color: '#ddd',
    fontSize: 13,
    padding: '6px 16px',
    cursor: 'pointer',
    textAlign: 'left',
  },
  shortcut: { color: '#888', marginLeft: 24 },
}
