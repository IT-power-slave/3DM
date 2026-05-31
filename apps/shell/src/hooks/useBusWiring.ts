import { useEffect } from 'react'
import { bus } from '@3dm/event-bus'
import { SCHEMA_VERSION } from '@3dm/shared-contracts'
import { useShellStore } from '../store/shellStore'

/**
 * Wires the global event bus to the shell store.
 * Must be called once at the App root level.
 */
export function useBusWiring(): void {
  const { setMfeReady, setProjectContext, setDirtyState, showModal, updateSettings } =
    useShellStore()

  useEffect(() => {
    const unsubs = [
      bus.on('mfe:ready', (sig) => setMfeReady(sig.mfeId, sig.criticality)),
      bus.on('project:context', (ctx) => setProjectContext(ctx)),
      bus.on('dirty:changed', (sig) => setDirtyState(sig.source, sig.isDirty)),
      bus.on('modal:request', (req) => showModal(req)),
      bus.on('settings:changed', (s) => updateSettings(s)),
    ]

    // Emit shell:ready so MFEs know they can start initialising
    bus.emit('shell:ready', { schemaVersion: SCHEMA_VERSION })

    return () => unsubs.forEach((u) => u())
  }, [setMfeReady, setProjectContext, setDirtyState, showModal, updateSettings])
}
