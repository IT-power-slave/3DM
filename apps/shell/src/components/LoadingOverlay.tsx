import React from 'react'
import { useShellStore } from '../store/shellStore'

export function LoadingOverlay(): React.ReactElement | null {
  const { shellReady, criticalMfesReady } = useShellStore()

  if (shellReady && criticalMfesReady) return null

  return (
    <div style={styles.overlay}>
      <div style={styles.content}>
        <div style={styles.spinner} />
        <p style={styles.text}>Loading 3D Studio…</p>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: '#1a1a1a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10000,
  },
  content: { textAlign: 'center' },
  spinner: {
    width: 48,
    height: 48,
    border: '4px solid #333',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    margin: '0 auto 16px',
    animation: 'spin 0.8s linear infinite',
  },
  text: { color: '#aaa', fontSize: 14 },
}

// Inject spin keyframe
if (typeof document !== 'undefined') {
  const id = '__3dm_spin'
  if (!document.getElementById(id)) {
    const s = document.createElement('style')
    s.id = id
    s.textContent = '@keyframes spin { to { transform: rotate(360deg); } }'
    document.head.appendChild(s)
  }
}
