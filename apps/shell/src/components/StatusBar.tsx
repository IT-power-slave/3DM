import React from 'react'
import { useShellStore } from '../store/shellStore'

export function StatusBar(): React.ReactElement {
  const { projectContext, mfeStates, criticalMfesReady } = useShellStore()

  const ready = criticalMfesReady
  const status = ready ? projectContext.status : 'loading'

  const statusLabel: Record<string, string> = {
    empty: 'No project',
    open: 'Ready',
    saving: 'Saving…',
    loading: 'Loading…',
    error: 'Error',
  }

  const statusColor: Record<string, string> = {
    empty: '#666',
    open: '#6ee7b7',
    saving: '#f59e0b',
    loading: '#7eb3f7',
    error: '#f87171',
  }

  const mfeCount = Object.values(mfeStates).filter((s) => s === 'ready').length
  const mfeTotal = Object.keys(mfeStates).length

  return (
    <div style={styles.bar}>
      <span style={{ ...styles.indicator, color: statusColor[status] ?? '#666' }}>
        ● {statusLabel[status] ?? status}
      </span>
      <span style={styles.sep}>|</span>
      <span style={styles.item}>
        MFEs: {mfeCount}/{mfeTotal}
      </span>
      {projectContext.lastSavedAt && (
        <>
          <span style={styles.sep}>|</span>
          <span style={styles.item}>
            Saved: {new Date(projectContext.lastSavedAt).toLocaleTimeString()}
          </span>
        </>
      )}
      <div style={styles.spacer} />
      <span style={styles.item}>Ctrl+N New · Ctrl+S Save · Ctrl+O Open</span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    height: 24,
    background: '#1a1a2e',
    borderTop: '1px solid #2a2a3e',
    padding: '0 10px',
    gap: 8,
    flexShrink: 0,
    fontSize: 11,
    color: '#666',
    userSelect: 'none',
  },
  indicator: { fontWeight: 600 },
  sep: { color: '#333' },
  item: { color: '#555' },
  spacer: { flex: 1 },
}
