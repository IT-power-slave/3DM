# Constitution — 3D Studio Web Application

## Purpose
This constitution defines non-negotiable rules for writing and executing specifications across all
microfrontends (MFEs) of the 3D Studio browser-based application. It supplements the base
constitution at `docs/templates/constitution.md` and takes precedence in any conflict.

---

## Microfrontend Registry

| MFE ID | Display Name | Primary Responsibility |
|---|---|---|
| MFE-SHELL | Application Shell | Workspace layout, panel composition, global navigation |
| MFE-PROJECT | Project Manager | Project lifecycle: create, open, save, save-as, close |
| MFE-2D | 2D Editor | Vector shape creation and editing |
| MFE-3D | 3D Editor | 3D scene and model authoring |
| MFE-VIEWER | 3D Quick Viewer | Real-time 3D preview with configurable lights and cameras |
| MFE-EXPORT | Render & Export | Non-destructive scene rendering and file export |
| MFE-MATERIALS *(planned)* | Material Designer | Visual material definition |
| MFE-TEXTURES *(planned)* | Texture Designer | Raster texture loading and editing |

---

## Domain-Specific Non-Negotiable Principles

### 1. Single Active Project Context
- The system shall support exactly one active project at a time.
- Project context (name, file location, dirty/clean state, version) shall be owned exclusively by **MFE-PROJECT**.
- All other MFEs requiring project context shall consume it via the Project Context Contract only.

### 2. Scene Graph Authority
- The authoritative 3D scene state (objects, hierarchy, transforms, material references) shall be owned by **MFE-3D**.
- MFE-VIEWER and MFE-EXPORT shall consume scene state as a read-only snapshot. They shall never mutate scene state directly.

### 3. 2D-to-3D Pipeline Integrity
- 2D shape data produced by MFE-2D shall be expressed as a versioned, self-contained **Shape Descriptor**.
- MFE-3D is the sole consumer responsible for interpreting Shape Descriptors and converting them into 3D geometry.
- No other MFE shall interpret, transform, or persist raw 2D geometry.

### 4. Export Non-Destructiveness
- MFE-EXPORT shall not modify scene state, project state, or the active file during any render or export operation.
- All export operations shall complete without side effects observable by other MFEs or by the user's project state.

### 5. File System Boundary
- All interactions with browser file system APIs and in-browser persistent storage (autosave, project files) shall be mediated exclusively by **MFE-PROJECT**.
- No other MFE shall directly access file system APIs, `localStorage`, `IndexedDB`, or equivalent persistent browser storage.

### 6. Failure Containment
- A failure in any content MFE (MFE-2D, MFE-3D, MFE-VIEWER, MFE-EXPORT) shall not corrupt project state or prevent MFE-SHELL from remaining navigable.
- Error states shall be presented within the failing MFE's UI region and shall not propagate to the global application frame.

### 7. Future Extension Contracts
- MFE-MATERIALS and MFE-TEXTURES are recognized as planned extensions.
- Before any adjacent MFE ships functionality that depends on material or texture data, a stub contract for the relevant planned MFE shall be documented and reviewed.
- Planned MFE stubs shall be treated as external dependencies with no assumed delivery date.

---

## Spec Workflow
Work proceeds in order: **spec.md → plan.md → tasks.md**.

- Any change to cross-MFE contracts shall be reflected in the relevant `spec.md` before implementation begins.
- Changes to the Microfrontend Registry require a constitution amendment with explicit ownership review.

---

## Definition of Done (Domain Addendum)
In addition to the base template's definition of done:
- Every cross-MFE data format shall include a `schemaVersion` field and a versioning scheme.
- All render and export operations shall define expected output quality and fidelity constraints as explicit acceptance criteria.
- New planned MFEs shall have at least a stub contract documented before adjacent MFEs ship dependent functionality.
- All file system interactions shall define both the primary API path and a required graceful fallback.

---

## System Scope Assumptions

- The application targets **desktop browser environments only**. Mobile and tablet devices are out of scope for all MFEs in this version.
- Touch-based gestures (e.g., pinch-to-zoom in MFE-VIEWER) described in individual specs are optional enhancements for touch-enabled desktop devices (e.g., Surface); they do not imply mobile browser support.
- No mobile-specific performance thresholds, responsive layout breakpoints, or touch-first UX patterns are required.
