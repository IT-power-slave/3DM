// ─────────────────────────────────────────────────────────────────────────────
// Shared Contracts — 3D Studio MFE Architecture
// All cross-MFE event/data types live here.
// ─────────────────────────────────────────────────────────────────────────────

export const SCHEMA_VERSION = '1.0.0'

// ─── Common ──────────────────────────────────────────────────────────────────

export type Vector2 = { x: number; y: number }
export type Vector3 = { x: number; y: number; z: number }
export type Quaternion = { x: number; y: number; z: number; w: number }
export type Color = { r: number; g: number; b: number; a?: number }
export type AABB = { min: Vector3; max: Vector3 }

// ─── Project Context Contract (MFE-PROJECT → all) ────────────────────────────

export type ProjectStatus = 'empty' | 'open' | 'saving' | 'loading' | 'error'

export interface ProjectContext {
  schemaVersion: typeof SCHEMA_VERSION
  projectId: string
  name: string
  /** Absolute path or undefined (download-mode) */
  filePath: string | undefined
  isDirty: boolean
  isOpen: boolean
  status: ProjectStatus
  lastSavedAt: string | undefined
}

export const EMPTY_PROJECT_CONTEXT: ProjectContext = {
  schemaVersion: SCHEMA_VERSION,
  projectId: '',
  name: '',
  filePath: undefined,
  isDirty: false,
  isOpen: false,
  status: 'empty',
  lastSavedAt: undefined,
}

// ─── Dirty-State Signal Contract ─────────────────────────────────────────────

export type DirtyStateSource = 'mfe-2d' | 'mfe-3d' | 'mfe-materials'

export interface DirtyStateSignal {
  schemaVersion: typeof SCHEMA_VERSION
  source: DirtyStateSource
  isDirty: boolean
  /** ISO timestamp */
  timestamp: string
}

// ─── Shell Readiness Signal ───────────────────────────────────────────────────

export interface ShellReadySignal {
  schemaVersion: typeof SCHEMA_VERSION
}

// ─── MFE Ready Signal ─────────────────────────────────────────────────────────

export type MfeId = 'mfe-project' | 'mfe-2d' | 'mfe-3d' | 'mfe-viewer' | 'mfe-export' | 'mfe-materials'
export type MfeCriticality = 'critical' | 'non-critical'

export interface MfeReadySignal {
  schemaVersion: typeof SCHEMA_VERSION
  mfeId: MfeId
  criticality: MfeCriticality
}

// ─── Modal Request Contract ───────────────────────────────────────────────────

export type ModalAction = { label: string; action: string; variant?: 'primary' | 'danger' | 'ghost' }

export interface ModalRequest {
  schemaVersion: typeof SCHEMA_VERSION
  modalId: string
  title: string
  message: string
  actions: ModalAction[]
}

export interface ModalResponse {
  schemaVersion: typeof SCHEMA_VERSION
  modalId: string
  action: string
}

// ─── Shortcut Registration Contract ──────────────────────────────────────────

export interface ShortcutRegistration {
  schemaVersion: typeof SCHEMA_VERSION
  mfeId: MfeId
  shortcuts: Array<{
    keys: string
    description: string
    action: string
  }>
}

// ─── Settings Contract ────────────────────────────────────────────────────────

export interface AppSettings {
  schemaVersion: typeof SCHEMA_VERSION
  theme: 'dark' | 'light'
  language: string
  autosaveIntervalMs: number
  gridVisible: boolean
  snappingEnabled: boolean
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  schemaVersion: SCHEMA_VERSION,
  theme: 'dark',
  language: 'en',
  autosaveIntervalMs: 30_000,
  gridVisible: true,
  snappingEnabled: true,
}

// ─── 2D Shape Descriptor Contract (MFE-2D → MFE-3D) ─────────────────────────

export type ShapeType = 'rect' | 'ellipse' | 'polygon' | 'path' | 'line' | 'text' | 'group'
export type FillRule = 'nonzero' | 'evenodd'

export interface ShapeStyle {
  fill: string | null
  fillOpacity: number
  stroke: string | null
  strokeWidth: number
  strokeOpacity: number
  fillRule: FillRule
}

export interface BaseShape {
  schemaVersion: typeof SCHEMA_VERSION
  shapeId: string
  type: ShapeType
  name: string
  style: ShapeStyle
  transform: string
  visible: boolean
  locked: boolean
}

export interface RectShape extends BaseShape {
  type: 'rect'
  x: number
  y: number
  width: number
  height: number
  rx?: number
  ry?: number
}

export interface EllipseShape extends BaseShape {
  type: 'ellipse'
  cx: number
  cy: number
  rx: number
  ry: number
}

export interface PolygonShape extends BaseShape {
  type: 'polygon'
  points: Vector2[]
}

export interface PathShape extends BaseShape {
  type: 'path'
  d: string
}

export interface LineShape extends BaseShape {
  type: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
}

export interface GroupShape extends BaseShape {
  type: 'group'
  children: ShapeDescriptor[]
}

export type ShapeDescriptor = RectShape | EllipseShape | PolygonShape | PathShape | LineShape | GroupShape

export interface ShapeDescriptorBatch {
  schemaVersion: typeof SCHEMA_VERSION
  batchId: string
  shapes: ShapeDescriptor[]
}

export interface ShapeDescriptorAck {
  schemaVersion: typeof SCHEMA_VERSION
  batchId: string
  results: Array<{
    shapeId: string
    status: 'accepted' | 'rejected'
    reason?: string
  }>
}

// ─── Canvas Snapshot Contract (MFE-2D → MFE-EXPORT) ─────────────────────────

export interface CanvasSnapshot {
  schemaVersion: typeof SCHEMA_VERSION
  snapshotId: string
  svgData: string
  viewBox: { x: number; y: number; width: number; height: number }
  capturedAt: string
}

// ─── Scene Light Contract (owned by MFE-3D) ──────────────────────────────────

export type LightType = 'ambient' | 'directional' | 'point' | 'spot'

export interface SceneLight {
  lightId: string
  type: LightType
  color: Color
  intensity: number
  position?: Vector3
  target?: Vector3
}

// ─── Scene Camera Contract ────────────────────────────────────────────────────

export interface SceneCamera {
  cameraId: string
  name: string
  position: Vector3
  target: Vector3
  fov: number
  near: number
  far: number
}

// ─── Scene Object (3D) ────────────────────────────────────────────────────────

export type SceneObjectType = 'mesh' | 'group' | 'light' | 'camera' | 'empty' | 'merged-mesh'

export type GeometryType =
  | 'box'
  | 'sphere'
  | 'cylinder'
  | 'cone'
  | 'plane'
  | 'extrude-rect'
  | 'extrude-ellipse'

export interface GeometryParams {
  width?: number
  height?: number
  depth?: number
  radius?: number
  rx?: number
  ry?: number
  radialSegments?: number
  /** SVG path data for extrude-path */
  pathData?: string
}

export interface SceneObject {
  objectId: string
  type: SceneObjectType
  name: string
  parentId: string | null
  position: Vector3
  rotation: Quaternion
  scale: Vector3
  visible: boolean
  castShadow: boolean
  receiveShadow: boolean
  /** Geometry classification for reconstruction in viewer/export */
  geometryType?: GeometryType
  geometryParams?: GeometryParams
  /** Hex color string, e.g. '#3b82f6' */
  color?: string
  /** References a MaterialDefinition.materialId; downstream consumers apply visual material properties */
  materialRef?: string
  /**
   * Edge topology for wireframe rendering on merged-mesh objects.
   * Flat array of vertex-index pairs: [i0, i1, i2, i3, ...] where each pair defines one edge.
   */
  wireframeEdges?: number[]
  /**
   * Serialized THREE.BufferGeometry JSON for 'merged-mesh' objects.
   * Reconstructed in the viewer via BufferGeometryLoader.parse().
   * Only present when type === 'merged-mesh'.
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geometryJSON?: Record<string, any>
}

// ─── Scene Snapshot Contract (MFE-3D → MFE-VIEWER, MFE-EXPORT) ───────────────

export interface SceneSnapshot {
  schemaVersion: typeof SCHEMA_VERSION
  snapshotId: string
  objects: SceneObject[]
  defaultLights: SceneLight[]
  cameras: SceneCamera[]
  capturedAt: string
}

// ─── Export Request / Progress Contracts ────────────────────────────────────

export type ExportFormat = 'png' | 'svg'
export type ExportSource = '2d' | '3d'

export interface ExportRequest {
  schemaVersion: typeof SCHEMA_VERSION
  requestId: string
  source: ExportSource
  format: ExportFormat
  width: number
  height: number
  /** cameraId from SceneSnapshot (3D exports only) */
  cameraId?: string
}

export interface ExportProgress {
  schemaVersion: typeof SCHEMA_VERSION
  requestId: string
  progress: number
  status: 'pending' | 'rendering' | 'done' | 'error'
  errorMessage?: string
  /** Data URL of the result (status === 'done') */
  resultDataUrl?: string
}

// ─── Panel Activation Event ───────────────────────────────────────────────────

export interface PanelActivatedEvent {
  panelId: string
}

// ─── Project Restore Event ────────────────────────────────────────────────────

export interface ProjectRestoreEvent {
  /** SVG string from 2D canvas (null = no 2D state) */
  svgData?: string
  /** Full scene snapshot to restore 3D scene (undefined = no 3D state) */
  sceneSnapshot?: SceneSnapshot
  /** Material library to restore in MFE-MATERIALS (undefined = clear to empty) */
  materialLibrary?: MaterialDefinition[]
}

// ─── Project Command Event ────────────────────────────────────────────────────

export type ProjectCommandType = 'new' | 'open' | 'save' | 'save-as' | 'close'

export interface ProjectCommandEvent {
  command: ProjectCommandType
}

// ─── Material Contracts (MFE-MATERIALS) ───────────────────────────────────────

export type MaterialShadingModel = 'lambert' | 'phong-blinn'

export interface MaterialDefinition {
  materialId: string
  name: string
  shadingModel: MaterialShadingModel
  /** Normalized floats [0.0, 1.0] */
  diffuseColor: { r: number; g: number; b: number }
  /** Normalized floats [0.0, 1.0]; null when shadingModel is 'lambert' */
  specularColor: { r: number; g: number; b: number } | null
  /** Integer 1–256; null when shadingModel is 'lambert' */
  shininess: number | null
  /** 0.0 (transparent) – 1.0 (fully opaque) */
  opacity: number
}

export interface MaterialReference {
  schemaVersion: typeof SCHEMA_VERSION
  material: MaterialDefinition
  /** 'upsert' = created or updated; 'deleted' = remove all references to this material */
  action: 'upsert' | 'deleted'
}

export interface MaterialAssignmentRequest {
  schemaVersion: typeof SCHEMA_VERSION
  requestId: string
  materialId: string
  /** Scene object IDs to assign the material to. Empty array = use current selection in MFE-3D */
  objectIds: string[]
}

export interface MaterialAssignmentResponse {
  schemaVersion: typeof SCHEMA_VERSION
  requestId: string
  accepted: string[]
  rejected: Array<{ objectId: string; reason: string }>
}

export interface MaterialLibraryEvent {
  schemaVersion: typeof SCHEMA_VERSION
  materials: MaterialDefinition[]
}

export interface SceneSelection {
  schemaVersion: typeof SCHEMA_VERSION
  /** IDs of objects currently selected in MFE-3D */
  objectIds: string[]
}
