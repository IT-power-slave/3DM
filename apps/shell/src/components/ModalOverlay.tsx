import React from 'react'
import { useShellStore } from '../store/shellStore'
import { bus } from '@3dm/event-bus'
import type { ModalResponse } from '@3dm/shared-contracts'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'

export function ModalOverlay(): React.ReactElement | null {
  const { pendingModal, dismissModal } = useShellStore()

  if (!pendingModal) return null

  const respond = (action: string) => {
    const response: ModalResponse = {
      schemaVersion: SCHEMA_VERSION,
      modalId: pendingModal.modalId,
      action,
    }
    bus.emit('modal:response', response)
    dismissModal()
  }

  return (
    <div style={styles.backdrop} onMouseDown={(e) => {
      if (e.target === e.currentTarget) respond('cancel')
    }}>
      <div style={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <h2 id="modal-title" style={styles.title}>{pendingModal.title}</h2>
        <p style={styles.message}>{pendingModal.message}</p>
        <div style={styles.actions}>
          {pendingModal.actions.map((a) => (
            <button
              key={a.action}
              style={{
                ...styles.btn,
                ...(a.variant === 'primary' ? styles.primary : {}),
                ...(a.variant === 'danger' ? styles.danger : {}),
              }}
              onClick={() => respond(a.action)}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  dialog: {
    background: '#2d2d2d',
    border: '1px solid #444',
    borderRadius: 8,
    padding: '28px 32px',
    maxWidth: 480,
    width: '100%',
    boxShadow: '0 8px 32px rgba(0,0,0,.6)',
  },
  title: { fontSize: 17, fontWeight: 600, marginBottom: 12, color: '#e0e0e0' },
  message: { fontSize: 14, color: '#aaa', marginBottom: 24, lineHeight: 1.5 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  btn: {
    padding: '8px 20px',
    borderRadius: 4,
    border: '1px solid #555',
    background: '#3a3a3a',
    color: '#ccc',
    fontSize: 13,
    cursor: 'pointer',
  },
  primary: { background: '#3b82f6', borderColor: '#3b82f6', color: '#fff' },
  danger: { background: '#ef4444', borderColor: '#ef4444', color: '#fff' },
}
