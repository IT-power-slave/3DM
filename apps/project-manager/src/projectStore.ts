import { create } from 'zustand'
import type { ProjectContext, CanvasSnapshot, SceneSnapshot, MaterialDefinition } from '@3dm/shared-contracts'
import { EMPTY_PROJECT_CONTEXT, SCHEMA_VERSION } from '@3dm/shared-contracts'
import { bus } from '@3dm/event-bus'
import JSZip from 'jszip'

// ─── File System Access API types (not in standard lib.dom yet) ───────────────

interface FilePickerAcceptType {
  description?: string
  accept: Record<string, string[]>
}

interface OpenFilePickerOptions {
  types?: FilePickerAcceptType[]
  multiple?: boolean
}

interface SaveFilePickerOptions {
  suggestedName?: string
  types?: FilePickerAcceptType[]
}

interface FileSystemAccessWindow {
  showOpenFilePicker: (opts?: OpenFilePickerOptions) => Promise<FileSystemFileHandle[]>
  showSaveFilePicker: (opts?: SaveFilePickerOptions) => Promise<FileSystemFileHandle>
}

function getFileSystemWindow(): FileSystemAccessWindow {
  return window as unknown as FileSystemAccessWindow
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SavedProjectData {
  context: ProjectContext
  svgData?: string
  sceneSnapshot?: SceneSnapshot
  materialLibrary?: MaterialDefinition[]
}

interface ProjectStore {
  context: ProjectContext
  fileHandle: FileSystemFileHandle | undefined
  autosaveTimer: ReturnType<typeof setInterval> | undefined

  // Latest snapshots from MFEs (cached for save)
  latestCanvasSnapshot: CanvasSnapshot | undefined
  latestSceneSnapshot: SceneSnapshot | undefined
  latestMaterialLibrary: MaterialDefinition[] | undefined

  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  closeProject: () => void
  setDirty: (isDirty: boolean) => void
  setCanvasSnapshot: (snap: CanvasSnapshot) => void
  setSceneSnapshot: (snap: SceneSnapshot) => void
  setMaterialLibrary: (materials: MaterialDefinition[]) => void
  _publishContext: (ctx: Partial<ProjectContext>) => void
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

async function serializeProject(
  ctx: ProjectContext,
  svgData?: string,
  sceneSnapshot?: SceneSnapshot,
  materialLibrary?: MaterialDefinition[],
): Promise<Blob> {
  const zip = new JSZip()
  const data: SavedProjectData = { context: ctx, svgData, sceneSnapshot, materialLibrary }
  zip.file('project.json', JSON.stringify(data, null, 2))
  if (svgData) zip.file('canvas.svg', svgData)
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}

async function deserializeProject(blob: Blob): Promise<SavedProjectData> {
  const zip = await JSZip.loadAsync(blob)
  const raw = await zip.file('project.json')?.async('string')
  if (!raw) throw new Error('Invalid project file: missing project.json')
  return JSON.parse(raw) as SavedProjectData
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

const supportsFileSystemAccess =
  typeof window !== 'undefined' && 'showOpenFilePicker' in window

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProjectStore = create<ProjectStore>((set, get) => ({
  context: EMPTY_PROJECT_CONTEXT,
  fileHandle: undefined,
  autosaveTimer: undefined,
  latestCanvasSnapshot: undefined,
  latestSceneSnapshot: undefined,
  latestMaterialLibrary: undefined,

  _publishContext: (partial) => {
    const next = { ...get().context, ...partial }
    set({ context: next })
    bus.emit('project:context', next)
  },

  setCanvasSnapshot: (snap) => set({ latestCanvasSnapshot: snap }),
  setSceneSnapshot: (snap) => set({ latestSceneSnapshot: snap }),

  setMaterialLibrary: (materials) => set({ latestMaterialLibrary: materials }),

  newProject: () => {
    const ctx: ProjectContext = {
      schemaVersion: SCHEMA_VERSION,
      projectId: generateId(),
      name: 'Untitled Project',
      filePath: undefined,
      isDirty: false,
      isOpen: true,
      status: 'open',
      lastSavedAt: undefined,
    }
    set({ fileHandle: undefined, latestCanvasSnapshot: undefined, latestSceneSnapshot: undefined, latestMaterialLibrary: undefined })
    get()._publishContext(ctx)
    // Clear MFE state
    bus.emit('project:restore', {})
  },

  openProject: async () => {
    try {
      get()._publishContext({ status: 'loading' })
      let blob: Blob

      if (supportsFileSystemAccess) {
        const [handle] = await getFileSystemWindow().showOpenFilePicker({
          types: [{ description: '3D Studio Project', accept: { 'application/zip': ['.3ds'] } }],
        })
        set({ fileHandle: handle })
        const file = await handle.getFile()
        blob = file
      } else {
        blob = await new Promise<Blob>((resolve, reject) => {
          const input = document.createElement('input')
          input.type = 'file'
          input.accept = '.3ds'
          input.onchange = () => {
            const file = input.files?.[0]
            if (file) resolve(file)
            else reject(new Error('No file selected'))
          }
          input.click()
        })
      }

      const data = await deserializeProject(blob)
      const ctx: ProjectContext = {
        ...data.context,
        isOpen: true,
        status: 'open',
      }
      set({ latestCanvasSnapshot: undefined, latestSceneSnapshot: undefined, latestMaterialLibrary: undefined })
      get()._publishContext(ctx)

      // Restore MFE state from saved snapshots
      bus.emit('project:restore', {
        svgData: data.svgData,
        sceneSnapshot: data.sceneSnapshot,
        materialLibrary: data.materialLibrary,
      })
    } catch (err) {
      console.error('[ProjectManager] Open failed:', err)
      get()._publishContext({ status: 'error' })
    }
  },

  saveProject: async () => {
    const { context, fileHandle, latestCanvasSnapshot, latestSceneSnapshot, latestMaterialLibrary } = get()
    try {
      get()._publishContext({ status: 'saving' })
      const blob = await serializeProject(
        context,
        latestCanvasSnapshot?.svgData,
        latestSceneSnapshot,
        latestMaterialLibrary,
      )

      if (fileHandle && supportsFileSystemAccess) {
        const writable = await fileHandle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        downloadBlob(blob, `${context.name}.3ds`)
      }

      get()._publishContext({
        isDirty: false,
        status: 'open',
        lastSavedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[ProjectManager] Save failed:', err)
      get()._publishContext({ status: 'error' })
    }
  },

  saveProjectAs: async () => {
    const { context, latestCanvasSnapshot, latestSceneSnapshot, latestMaterialLibrary } = get()
    try {
      get()._publishContext({ status: 'saving' })
      const blob = await serializeProject(
        context,
        latestCanvasSnapshot?.svgData,
        latestSceneSnapshot,
        latestMaterialLibrary,
      )

      if (supportsFileSystemAccess) {
        const handle = await getFileSystemWindow().showSaveFilePicker({
          suggestedName: `${context.name}.3ds`,
          types: [{ description: '3D Studio Project', accept: { 'application/zip': ['.3ds'] } }],
        })
        set({ fileHandle: handle })
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else {
        downloadBlob(blob, `${context.name}.3ds`)
      }

      get()._publishContext({
        isDirty: false,
        status: 'open',
        lastSavedAt: new Date().toISOString(),
      })
    } catch (err) {
      console.error('[ProjectManager] Save As failed:', err)
      get()._publishContext({ status: 'error' })
    }
  },

  closeProject: () => {
    set({ fileHandle: undefined, latestCanvasSnapshot: undefined, latestSceneSnapshot: undefined, latestMaterialLibrary: undefined })
    get()._publishContext(EMPTY_PROJECT_CONTEXT)
  },

  setDirty: (isDirty) => {
    get()._publishContext({ isDirty })
  },
}))
