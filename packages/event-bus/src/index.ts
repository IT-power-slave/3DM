import type {
  ProjectContext,
  DirtyStateSignal,
  ShellReadySignal,
  MfeReadySignal,
  ModalRequest,
  ModalResponse,
  ShortcutRegistration,
  AppSettings,
  ShapeDescriptorBatch,
  ShapeDescriptorAck,
  CanvasSnapshot,
  SceneSnapshot,
  ExportRequest,
  ExportProgress,
  PanelActivatedEvent,
  ProjectRestoreEvent,
  ProjectCommandEvent,
} from '@3dm/shared-contracts'

// ─── Event Type Map ───────────────────────────────────────────────────────────

export interface EventMap {
  // Shell lifecycle
  'shell:ready': ShellReadySignal
  'mfe:ready': MfeReadySignal

  // Panel navigation
  'panel:activated': PanelActivatedEvent

  // Project
  'project:context': ProjectContext
  'project:restore': ProjectRestoreEvent
  'project:command': ProjectCommandEvent

  // Dirty state
  'dirty:changed': DirtyStateSignal

  // Modals
  'modal:request': ModalRequest
  'modal:response': ModalResponse

  // Shortcuts
  'shortcuts:register': ShortcutRegistration

  // Settings
  'settings:changed': AppSettings

  // 2D → 3D
  'shapes:publish': ShapeDescriptorBatch
  'shapes:ack': ShapeDescriptorAck

  // 2D → EXPORT
  'canvas:snapshot': CanvasSnapshot

  // 3D → VIEWER / EXPORT
  'scene:snapshot': SceneSnapshot

  // EXPORT
  'export:request': ExportRequest
  'export:progress': ExportProgress
}

export type EventKey = keyof EventMap

// ─── Typed Event Bus ──────────────────────────────────────────────────────────

type Listener<T> = (payload: T) => void

class EventBus {
  private listeners = new Map<string, Set<Listener<unknown>>>()

  on<K extends EventKey>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(listener as Listener<unknown>)
    return () => this.off(event, listener)
  }

  off<K extends EventKey>(event: K, listener: Listener<EventMap[K]>): void {
    this.listeners.get(event)?.delete(listener as Listener<unknown>)
  }

  emit<K extends EventKey>(event: K, payload: EventMap[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload))
  }

  once<K extends EventKey>(event: K, listener: Listener<EventMap[K]>): () => void {
    const wrapper = (payload: EventMap[K]) => {
      listener(payload)
      this.off(event, wrapper)
    }
    return this.on(event, wrapper)
  }
}

// Singleton bus shared across all MFEs (in the same JS bundle context)
export const bus = new EventBus()

export type { EventBus }
