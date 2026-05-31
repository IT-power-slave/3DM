import { create } from 'zustand'
import type { ProjectContext, ModalRequest, AppSettings } from '@3dm/shared-contracts'
import { DEFAULT_APP_SETTINGS, EMPTY_PROJECT_CONTEXT } from '@3dm/shared-contracts'

export type MfeLoadState = 'loading' | 'ready' | 'error'

interface ShellState {
  // Readiness
  shellReady: boolean
  mfeStates: Record<string, MfeLoadState>
  criticalMfesReady: boolean

  // Project
  projectContext: ProjectContext

  // Modals
  pendingModal: ModalRequest | null

  // Settings
  settings: AppSettings

  // Dirty state (aggregated)
  dirtyMfes: Set<string>

  // Actions
  setShellReady: () => void
  setMfeReady: (mfeId: string, criticality: 'critical' | 'non-critical') => void
  setMfeError: (mfeId: string) => void
  setProjectContext: (ctx: ProjectContext) => void
  setDirtyState: (source: string, isDirty: boolean) => void
  showModal: (req: ModalRequest) => void
  dismissModal: () => void
  updateSettings: (partial: Partial<AppSettings>) => void
}

const CRITICAL_MFES = new Set(['mfe-project', 'mfe-2d', 'mfe-3d'])

export const useShellStore = create<ShellState>((set, get) => ({
  shellReady: false,
  mfeStates: {},
  criticalMfesReady: false,
  projectContext: EMPTY_PROJECT_CONTEXT,
  pendingModal: null,
  settings: DEFAULT_APP_SETTINGS,
  dirtyMfes: new Set(),

  setShellReady: () => set({ shellReady: true }),

  setMfeReady: (mfeId, _criticality) => {
    set((state) => {
      const next = { ...state.mfeStates, [mfeId]: 'ready' as MfeLoadState }
      const criticalReady = [...CRITICAL_MFES].every((id) => next[id] === 'ready')
      return { mfeStates: next, criticalMfesReady: criticalReady }
    })
  },

  setMfeError: (mfeId) => {
    set((state) => {
      const isCritical = CRITICAL_MFES.has(mfeId)
      if (isCritical) {
        console.error(`[Shell] Critical MFE "${mfeId}" failed to load.`)
      }
      return { mfeStates: { ...state.mfeStates, [mfeId]: 'error' as MfeLoadState } }
    })
  },

  setProjectContext: (ctx) => set({ projectContext: ctx }),

  setDirtyState: (source, isDirty) => {
    set((state) => {
      const next = new Set(state.dirtyMfes)
      if (isDirty) next.add(source)
      else next.delete(source)
      return { dirtyMfes: next }
    })
    // Reflect into project context isDirty
    const ctx = get().projectContext
    const anyDirty = get().dirtyMfes.size > 0
    if (ctx.isDirty !== anyDirty) {
      set((state) => ({ projectContext: { ...state.projectContext, isDirty: anyDirty } }))
    }
  },

  showModal: (req) => set({ pendingModal: req }),
  dismissModal: () => set({ pendingModal: null }),

  updateSettings: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
}))
