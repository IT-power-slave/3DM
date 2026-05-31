import React from 'react'
import { useBusWiring } from './hooks/useBusWiring'
import { MenuBar } from './components/MenuBar'
import { Workspace } from './components/Workspace'
import { ModalOverlay } from './components/ModalOverlay'
import { LoadingOverlay } from './components/LoadingOverlay'
import { StatusBar } from './components/StatusBar'
import { useShellStore } from './store/shellStore'
import { bus } from '@3dm/event-bus'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'

export function App(): React.ReactElement {
  useBusWiring()

  const { setShellReady, projectContext } = useShellStore()

  React.useEffect(() => {
    setShellReady()
  }, [setShellReady])

  // Global keyboard shortcuts
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const isCtrl = e.ctrlKey || e.metaKey
      if (!isCtrl) return

      if (e.key === 'n') {
        e.preventDefault()
        bus.emit('modal:request', {
          schemaVersion: SCHEMA_VERSION,
          modalId: 'new-project',
          title: 'New Project',
          message: projectContext.isDirty
            ? 'Unsaved changes will be lost. Continue?'
            : 'Create a new empty project?',
          actions: [
            { label: 'Create', action: 'confirm', variant: 'primary' },
            { label: 'Cancel', action: 'cancel' },
          ],
        })
      }

      if (e.key === 's' && !e.shiftKey) {
        e.preventDefault()
        bus.emit('project:command', { command: 'save' })
      }

      if (e.key === 's' && e.shiftKey) {
        e.preventDefault()
        bus.emit('project:command', { command: 'save-as' })
      }

      if (e.key === 'o') {
        e.preventDefault()
        bus.emit('project:command', { command: 'open' })
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [projectContext.isDirty])

  return (
    <div style={styles.root}>
      <MenuBar />
      <Workspace />
      <StatusBar />
      <ModalOverlay />
      <LoadingOverlay />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: '#1a1a1a',
    color: '#e0e0e0',
  },
}
