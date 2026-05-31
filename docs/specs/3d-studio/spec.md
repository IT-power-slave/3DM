# Spec: 3D Studio — System Overview

## 1. Introduction

### 1.1 Purpose
This specification defines the system-level functional requirements, MFE ownership map, cross-cutting
contracts, and acceptance criteria for the 3D Studio browser-based application. It serves as the
authoritative reference for the complete user-facing product and is the parent document for all
individual MFE specifications.

### 1.2 Scope
- **In scope:**
  - All seven shipping MFEs: MFE-SHELL, MFE-PROJECT, MFE-2D, MFE-3D, MFE-VIEWER, MFE-EXPORT, MFE-MATERIALS
  - Cross-MFE contracts and observable integration behavior
  - System-level non-functional requirements
  - Placeholder contracts for planned MFEs: MFE-TEXTURES
- **Out of scope:**
  - Internal implementation detail of any individual MFE
  - Build pipeline, runtime hosting, or deployment topology
  - Texture authoring workflows (deferred to planned MFE-TEXTURES)
  - Server-side rendering or collaboration features

### 1.3 Architectural Context
The system is composed of independently owned, independently releasable microfrontends (MFEs)
orchestrated by an application shell (MFE-SHELL). Each MFE owns a specific functional domain.
Cross-MFE communication occurs exclusively via defined contracts: navigation, shared events/messages,
and shared state consumed through published interfaces. The application runs entirely in the browser;
no server is required for core editing functionality.

---

## 2. Definitions and Context

### 2.1 Key Terms

| Term | Definition |
|---|---|
| **Project** | A named, persistable workspace containing a 2D canvas state, a 3D scene state, a material library, and associated metadata. |
| **Shape Descriptor** | A versioned, self-contained data structure representing a 2D vector shape produced by MFE-2D and consumable by MFE-3D. |
| **Scene Snapshot** | A read-only, versioned representation of the current 3D scene state, consumed by MFE-VIEWER and MFE-EXPORT. |
| **Project Context** | A shared, read-only representation of the active project's identity and status, produced by MFE-PROJECT. |
| **Export** | The act of rendering scene or canvas content to an output file (PNG, SVG) on the user's device. |
| **Merged Object** | A scene object of type `merged-mesh` produced by the Object Merge operation in MFE-3D. It contains the concatenated vertex and triangle data of two or more source mesh objects, with all source geometry baked into a common world space and re-expressed relative to the merged object's transform origin. Interior surfaces are not removed; this is a geometric combination, not a CSG Boolean operation. |
| **Active Project** | The single project currently open in the application. Only one may be active at a time. |
| **Dirty State** | A project whose in-memory state has been modified since the last save. |
| **2D Canvas** | The vector editing surface managed by MFE-2D. |
| **3D Scene** | The hierarchical collection of objects, lights, and cameras managed by MFE-3D. |
| **Material Definition** | A named, versioned data record authored in MFE-MATERIALS that describes the shading model and visual properties of a surface, referenced by one or more scene objects. |
| **Material Reference** | A published payload produced by MFE-MATERIALS and consumed by MFE-3D, MFE-VIEWER, and MFE-EXPORT, identifying a material definition by its stable `materialId` and carrying its full property set. |
| **Default Material** | The fallback surface appearance applied by MFE-3D, MFE-VIEWER, and MFE-EXPORT to any scene object that carries no valid material reference. Visually equivalent to a Diffuse (Lambert) material with neutral gray diffuse color and full opacity. |
| **Diffuse (Lambert) Material** | A shading model in which surface color is uniformly scattered regardless of the viewing angle, producing no specular highlight. |
| **Specular (Phong / Blinn-Phong) Material** | A shading model that combines a diffuse component with a view-dependent specular highlight, whose width and intensity are controlled by the Shininess property. |

### 2.2 Microfrontend Roles

| MFE | Role |
|---|---|
| **MFE-SHELL** | Composes all MFEs into a coherent workspace; owns global layout, navigation, and cross-MFE error boundaries. |
| **MFE-PROJECT** | Owns project lifecycle: creation, opening, saving, closing, autosave, and recent projects. |
| **MFE-2D** | Owns 2D vector editing: drawing tools, shape manipulation, canvas state, and Shape Descriptor publication. |
| **MFE-3D** | Owns 3D scene authoring: primitives, 2D→3D conversion, transforms, material reference slots, and scene state. |
| **MFE-VIEWER** | Provides a read-only, real-time preview of the 3D scene with user-configurable lights and cameras; renders objects using received Material References. |
| **MFE-EXPORT** | Provides non-destructive rendering and file export for both 2D and 3D content; renders objects using received Material References. |
| **MFE-MATERIALS** | Owns material definition authoring: creates, edits, and assigns Diffuse (Lambert) and Specular (Phong / Blinn-Phong) materials to scene objects; persists the material library as part of the project. |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
A user creates, edits, saves, and exports 2D vector shapes and 3D models within a single browser-based
creative environment, without requiring installation of any native software.

### 3.2 Key Scenarios

1. **New project** — User creates a new project, draws 2D shapes, publishes them to the 3D editor, extrudes them into 3D objects, assigns a Specular (Phong / Blinn-Phong) material, previews the result in the viewer, and exports the render as a PNG.
2. **Load and continue** — User opens a previously saved project file from disk, resumes editing in either the 2D or 3D editor, and saves changes.
3. **3D-first workflow** — User creates 3D models entirely within the 3D editor using primitives, without using the 2D editor.
4. **Quick preview** — User switches to the viewer, adjusts lighting and camera, and evaluates the scene appearance without modifying the scene.
5. **Export only** — User opens a project and exports 2D shapes to SVG and 3D scene to PNG without further editing.
6. **Material authoring** — User opens the Material Designer, creates a Diffuse (Lambert) material for matte surfaces and a Specular (Phong / Blinn-Phong) material for shiny surfaces, assigns them to different objects, and evaluates the result in the viewer under scene lighting.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-SHELL Requirements
- MFE-SHELL shall render a persistent application frame that hosts all MFE panels simultaneously or on demand.
- MFE-SHELL shall provide a dockable, resizable panel layout that allows the user to arrange and resize MFE panels.
- MFE-SHELL shall display a global project status indicator (project name, dirty state) sourced from MFE-PROJECT via the Project Context Contract.
- MFE-SHELL shall provide a top-level navigation mechanism that allows the user to switch active MFE panels.
- MFE-SHELL shall render an error boundary around each MFE panel, ensuring that a failed MFE does not affect other panels.
- MFE-SHELL shall display a user-visible error state within a failed MFE's panel region with a retry action.

### 4.2 MFE-PROJECT Requirements
- MFE-PROJECT shall allow the user to create a new, empty project.
- MFE-PROJECT shall allow the user to open an existing project file from the local file system.
- MFE-PROJECT shall allow the user to save the active project to its current file location.
- MFE-PROJECT shall allow the user to save the active project to a new file location (save as).
- MFE-PROJECT shall detect dirty state and prompt the user to save before closing or opening another project.
- MFE-PROJECT shall autosave the active project at a configurable interval.
- MFE-PROJECT shall publish the Project Context to other MFEs via the Project Context Contract.
- MFE-PROJECT shall maintain a list of recently opened projects accessible to the user.
- MFE-PROJECT shall support a download/upload file fallback when the browser's file system API is unavailable.

### 4.3 MFE-2D Requirements
- MFE-2D shall provide a 2D canvas on which the user can create and edit vector shapes.
- MFE-2D shall support at minimum: rectangle, ellipse, polygon, freehand path, and line segment tools.
- MFE-2D shall allow the user to select, move, rotate, and scale individual shapes and groups of shapes.
- MFE-2D shall support layered shape organization.
- MFE-2D shall allow the user to publish one or more selected shapes as a Shape Descriptor via the 2D→3D Contract.
- MFE-2D shall persist its canvas state as part of the active project through MFE-PROJECT.
- MFE-2D shall allow the user to import SVG files onto the canvas.

### 4.4 MFE-3D Requirements
- MFE-3D shall provide a 3D scene editor in which the user can create, select, transform, and delete objects.
- MFE-3D shall support creation of basic 3D primitives: box, sphere, cylinder, cone, plane, and torus.
- MFE-3D shall allow the user to import a Shape Descriptor from MFE-2D and convert it to a 3D object via extrusion, revolution (lathe), or sweep.
- MFE-3D shall provide transform tools (translate, rotate, scale) with visual gizmos.
- MFE-3D shall maintain a scene hierarchy (parent/child object relationships).
- MFE-3D shall support multi-level undo and redo for all editing actions.
- MFE-3D shall publish a Scene Snapshot for consumption by MFE-VIEWER and MFE-EXPORT via the Scene Snapshot Contract.
- MFE-3D shall persist its scene state as part of the active project through MFE-PROJECT.
- MFE-3D shall provide an Object Merge operation that combines the geometry of two or more selected, unlocked mesh objects into a single merged-mesh object, registers the entire operation as one undoable step, and publishes an updated Scene Snapshot upon completion.

### 4.5 MFE-VIEWER Requirements
- MFE-VIEWER shall render the current 3D scene in real time using the Scene Snapshot.
- MFE-VIEWER shall allow the user to orbit, pan, and zoom the camera.
- MFE-VIEWER shall allow the user to configure scene lighting: add, remove, and adjust ambient, directional, point, and spot lights.
- MFE-VIEWER shall allow the user to configure one or more named cameras and switch between them.
- MFE-VIEWER shall support at minimum the following viewport display modes: solid shaded, wireframe, and rendered preview.
- MFE-VIEWER shall update its render in response to Scene Snapshot updates without requiring manual user action.
- MFE-VIEWER shall not modify scene state; all viewer-specific settings (lights, camera positions) are local to MFE-VIEWER.

### 4.6 MFE-EXPORT Requirements
- MFE-EXPORT shall allow the user to export the 2D canvas content as a PNG file.
- MFE-EXPORT shall allow the user to export the 2D canvas content as an SVG file.
- MFE-EXPORT shall allow the user to export the 3D scene as a PNG image.
- MFE-EXPORT shall allow the user to export the 3D scene as an SVG vector image (wireframe or outline projection).
- MFE-EXPORT shall allow the user to configure export parameters: output resolution (for PNG), background color/transparency, and camera/view selection.
- MFE-EXPORT shall perform all export operations without modifying the active project or scene state.
- MFE-EXPORT shall provide progress indication for operations that may take longer than two seconds.
- MFE-EXPORT shall apply the received Material References to objects during 3D render and export; when no Material Reference is available for a given object, MFE-EXPORT shall render that object with the default material.

### 4.7 MFE-MATERIALS Requirements
- MFE-MATERIALS shall provide a material library panel listing all named material definitions in the active project.
- MFE-MATERIALS shall allow the user to create, rename, duplicate, and delete material definitions.
- MFE-MATERIALS shall support the **Diffuse (Lambert)** shading model with the following editable properties: diffuse color (RGB) and opacity.
- MFE-MATERIALS shall support the **Specular (Phong / Blinn-Phong)** shading model with the following editable properties: diffuse color (RGB), specular color (RGB), shininess exponent (integer 1–256), and opacity.
- MFE-MATERIALS shall allow the user to switch the shading model of any material between Diffuse (Lambert) and Specular (Phong / Blinn-Phong) at any time.
- MFE-MATERIALS shall allow the user to assign any material definition to one or more scene objects in MFE-3D via the Material Assignment Contract.
- MFE-MATERIALS shall publish Material References to MFE-3D, MFE-VIEWER, and MFE-EXPORT whenever a material definition is created, modified, or deleted.
- MFE-MATERIALS shall debounce Material Reference publication during continuous property editing: at most one publication per 100 ms of continuous editing activity.
- MFE-MATERIALS shall persist its material library as part of the active project through MFE-PROJECT.
- When MFE-MATERIALS is unavailable, all other MFEs shall remain fully functional; scene objects shall render with the default material.

### 4.8 Cross-MFE Observable Behaviors
- When a user saves the project, all MFE panel states (2D canvas, 3D scene, and material library) shall be included in the saved file.
- When a user opens a project, MFE-2D, MFE-3D, and MFE-MATERIALS shall restore their respective states from the project data.
- When a user publishes a shape from MFE-2D, the shape shall appear as an importable asset within MFE-3D without requiring the user to navigate away from MFE-3D.
- When a material property is changed in MFE-MATERIALS, MFE-VIEWER shall update the rendered appearance of all objects referencing that material without any manual user action.
- If MFE-3D is unavailable, MFE-2D shall remain fully functional and the publication action shall display a user-visible error.
- If MFE-VIEWER is unavailable, MFE-3D shall remain fully functional.
- If MFE-EXPORT is unavailable, the user shall be informed via a visible error within MFE-EXPORT's panel; all other MFEs shall remain unaffected.
- If MFE-MATERIALS is unavailable, MFE-3D, MFE-VIEWER, and MFE-EXPORT shall render all objects with the default material; no error shall be surfaced within those MFE panels.

---

## 5. Contract Requirements (Microfrontend Interfaces)

### 5.1 Project Context Contract
- **Producer:** MFE-PROJECT
- **Consumers:** MFE-SHELL, MFE-2D, MFE-3D, MFE-VIEWER, MFE-EXPORT, MFE-MATERIALS
- **Published fields (semantics):**
  - Active project name (display string)
  - Active project dirty/clean state (boolean)
  - Active project schema version
  - Project open/closed status
- **Constraints:**
  - Consumers shall treat this as read-only.
  - Consumers shall handle the "no active project" state gracefully.
- **Compatibility:** Additive changes only; removed fields require a deprecation period spanning at least one minor release.

### 5.2 Shape Descriptor Contract (2D → 3D)
- **Producer:** MFE-2D
- **Consumer:** MFE-3D
- **Trigger:** User action "Publish to 3D" within MFE-2D
- **Payload semantics:**
  - `schemaVersion`: descriptor format version
  - `shapeId`: stable identifier for this shape
  - `paths`: ordered collection of closed or open vector paths with curve data
  - `boundingBox`: axis-aligned bounding rectangle in canvas units
  - `transform`: 2D transform matrix applied to the shape at time of publication
- **Ordering:** MFE-3D shall accept the most recent descriptor for a given `shapeId`; earlier versions may be discarded.
- **Failure behavior:** If MFE-3D cannot process the descriptor, the user shall see a visible error within MFE-3D's panel; MFE-2D shall remain in its pre-publication state.

### 5.3 Scene Snapshot Contract (3D → Viewer / Export)
- **Producer:** MFE-3D
- **Consumers:** MFE-VIEWER, MFE-EXPORT
- **Trigger:** Any user edit in MFE-3D that modifies scene state; also published on demand by consumers.
- **Payload semantics:**
  - `schemaVersion`: snapshot format version
  - `objects`: collection of scene objects with geometry references, transforms, and material references
  - `hierarchy`: parent/child relationship tree of objects
  - `lights`: default scene lights at time of snapshot
  - `cameras`: named camera definitions with position and orientation
- **Constraints:**
  - Consumers shall treat the snapshot as immutable.
  - Consumers shall handle partial or empty scene snapshots without error.
- **Compatibility:** Additive changes only; breaking changes require version increment and consumer migration guidance.

> **Contract addendum — `"merged-mesh"` type and `wireframeEdges` field:** The `objects` collection within the Scene Snapshot shall support the value `"merged-mesh"` for the object `type` field, in addition to the existing values `"mesh"`, `"group"`, `"light"`, and `"camera"`. Objects of type `"merged-mesh"` shall carry an optional `wireframeEdges` field containing edge topology data. Both additions are strictly additive and shall not require immediate updates to existing consumers; consumers shall not error upon encountering the `"merged-mesh"` type value or the `wireframeEdges` field. The authoritative field-level definitions are maintained in the MFE-3D specification, section 5.2.

### 5.4 Export Trigger Contract (Shell / User → Export)
- **Producer:** MFE-SHELL (via user navigation) or any MFE (via export shortcut action)
- **Consumer:** MFE-EXPORT
- **Trigger:** User invokes an export action (menu item, toolbar button, keyboard shortcut)
- **Payload semantics:**
  - `sourceType`: `"2d"` or `"3d"` — determines which content to render
  - `formatHint`: optional preferred output format (`"png"` | `"svg"`)
- **Failure behavior:** If export is triggered while no project is active, MFE-EXPORT shall display a user-visible informational message and take no further action.

### 5.5 Material Reference Contract (MFE-MATERIALS → MFE-3D, MFE-VIEWER, MFE-EXPORT)

- **Producer:** MFE-MATERIALS
- **Consumers:** MFE-3D (stores material reference on scene objects), MFE-VIEWER (renders assigned materials), MFE-EXPORT (renders assigned materials)
- **Trigger:** Material definition created, modified, or deleted in MFE-MATERIALS; or project restored.
- **Supported shading models:**
  - `"lambert"` — Diffuse (Lambert): no specular component. Properties: `diffuseColor`, `opacity`.
  - `"phong-blinn"` — Specular (Phong / Blinn-Phong): diffuse plus view-dependent specular highlight. Properties: `diffuseColor`, `specularColor`, `shininess` (integer 1–256), `opacity`.
- **Key payload fields:** `schemaVersion`, `materialId` (stable UUID), `name`, `shadingModel`, `diffuseColor { r,g,b }`, `specularColor { r,g,b } | null`, `shininess integer | null`, `opacity`.
- **Constraints:**
  - Consumers shall treat payload as immutable.
  - When `shadingModel` is `"lambert"`, consumers shall apply no specular computation regardless of any specular fields present.
  - Consumers shall fall back to the default material for any unresolvable `materialId`.
  - MFE-3D, MFE-VIEWER, and MFE-EXPORT shall render objects with the default material when MFE-MATERIALS is absent or unavailable.
- **Compatibility:** Additive changes only; breaking changes require `schemaVersion` increment.
- **Authoritative detail:** See `docs/specs/mfe-materials/spec.md`, section 5.1.

### 5.6 Material Assignment Contract (MFE-MATERIALS → MFE-3D)

- **Producer:** MFE-MATERIALS
- **Consumer:** MFE-3D
- **Trigger:** User assigns a material to one or more scene objects from MFE-MATERIALS
- **Request payload:** `materialId` (UUID), `objectIds` (array of scene object UUIDs)
- **Response payload:** `accepted` (array of `objectId`), `rejected` (array of `{ objectId, reason }`)
- **Constraint:** MFE-3D shall respond within two seconds; MFE-MATERIALS shall display a timeout error if no response is received.
- **Authoritative detail:** See `docs/specs/mfe-materials/spec.md`, section 5.2.

### 5.7 Planned MFE Stub Contracts

#### 5.7.1 Texture Reference Contract (MFE-TEXTURES → MFE-MATERIALS)
- **Status:** Stub — not yet implemented.
- **Expected payload semantics:** Texture identifier, texture format, resolution metadata.
- **Constraint:** MFE-MATERIALS shall treat texture references as optional; material definitions shall function without texture references.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- Each MFE shall be independently releasable without requiring a synchronized release of any other MFE.
- The system shall remain usable during mixed-version operation across MFEs, provided no breaking contract changes have been introduced.

### 6.2 Performance (User-Perceived)
- MFE-SHELL shall display a usable application frame within three seconds of initial page load on a modern browser and average hardware.
- MFE-3D and MFE-VIEWER shall maintain an interactive frame rate for scenes of up to 100,000 triangles on average consumer hardware.
- Export operations shall complete and deliver the file to the user within ten seconds for typical scene/canvas sizes (up to 4K resolution output).
- Autosave shall complete without causing a user-perceptible freeze or interruption to editing operations.

### 6.3 Reliability & Resilience
- If any content MFE fails to load, MFE-SHELL shall display the remaining MFEs without interruption.
- Autosave failures shall surface a non-blocking, user-visible warning without interrupting the active editing session.
- Project file corruption during load shall result in a user-visible diagnostic message; the application shall not crash.

### 6.4 Security & Privacy
- No project data, file contents, or user inputs shall be transmitted to any external server without explicit user consent.
- File system access shall require explicit user gesture (file picker dialog); no background file access shall occur.

### 6.5 Accessibility & Compliance
- All interactive controls within each MFE shall be keyboard-navigable.
- Color usage in the UI shall not be the sole means of conveying state (dirty indicator, selection, error).
- All MFEs shall meet WCAG 2.1 Level AA for interactive controls and informational content.

### 6.6 Observability
- Each MFE shall emit user-visible error states distinguishable from each other.
- The application shall allow the user to distinguish between: a project load failure, a rendering/compute failure, and an export failure.
- MFE-SHELL shall display which MFE panels are operational and which are in an error state.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given a new browser session, when the user loads the application, then MFE-SHELL presents a usable workspace with all MFE panels accessible within three seconds.
- Given an active project, when the user creates a shape in MFE-2D and publishes it, then an importable asset representing that shape appears in MFE-3D without navigating away from MFE-3D.
- Given a 3D scene with objects, when the user opens MFE-VIEWER, then the viewer displays those objects in real time without any user refresh action.
- Given an active project with 3D content, when the user requests a PNG export, then the file is delivered to the user's device as a download within ten seconds.
- Given a saved project file, when the user opens it, then MFE-2D and MFE-3D restore their states exactly as saved.

### 7.2 Edge Cases
- Given a project with an empty 2D canvas, when the user requests a 2D SVG export, then MFE-EXPORT produces a valid, empty SVG document rather than an error.
- Given a Shape Descriptor with a `schemaVersion` newer than MFE-3D supports, then MFE-3D displays a version mismatch warning and declines to import, without crashing.
- Given the user closes the browser tab with a dirty project, then the browser's standard unload warning prompts the user before the tab closes.

### 7.3 Failure & Degraded Experience
- Given MFE-3D fails to load, then MFE-SHELL, MFE-PROJECT, MFE-2D, MFE-VIEWER, and MFE-EXPORT continue to function; the 3D editor panel displays an error state with a retry action.
- Given MFE-EXPORT is unavailable, then all editing MFEs remain functional and the export panel displays an error; no project data is lost.
- Given the browser does not support the file system API, then MFE-PROJECT falls back to download/upload workflow transparently, with a user-visible notice.

### 7.4 Compatibility
- Given a project file saved with schema version N is opened by an application where MFE-PROJECT supports schema version N+1, then the project opens successfully and is migrated to the new schema on the next save.

---

## 8. Assumptions
- The application targets modern, evergreen browsers (Chromium-based, Firefox, Safari) released within the prior 24 months.
- No server-side component is required for any core feature described in this specification.
- A single user works on one project at a time; real-time collaboration is out of scope.
- The browser's file system API is the preferred save/load mechanism; download/upload is the required fallback.
- Hardware-accelerated graphics (GPU) is available on the target devices; the system may decline to run on software-only rendering paths.

---

## 9. Open Questions
- [ ] What is the maximum supported project file size? (owner: Product, due: TBD)
- [ ] Should the viewer's light and camera configurations be persisted as part of the project, or are they viewer-only session state? (owner: Product, due: TBD)
- [ ] Is SVG export of 3D content a silhouette/outline render or a projected wireframe? (owner: Product, due: TBD)
- [ ] What is the expected MFE-MATERIALS delivery timeline, and which MFE features should be gated behind its availability? (owner: Product/Engineering, due: TBD)
- [ ] Is undo/redo scoped per-MFE (separate histories for 2D and 3D) or unified across the application? (owner: Product, due: TBD)
- [ ] Should MFE-2D support importing DXF format in addition to SVG? (owner: Product, due: TBD)
