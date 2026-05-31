# Spec: MFE-3D — 3D Editor

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
3D Editor (MFE-3D). MFE-3D is the authoritative owner of the 3D scene: it provides tools for
creating and editing 3D objects (primitives, 2D-derived geometry), manages the scene hierarchy, and
publishes the Scene Snapshot consumed by MFE-VIEWER and MFE-EXPORT.

### 1.2 Scope
- **In scope:**
  - 3D scene graph management (objects, hierarchy, transforms)
  - 3D primitive creation (box, sphere, cylinder, cone, plane, torus)
  - 2D Shape Descriptor import and conversion to 3D geometry (extrude, revolve, sweep)
  - Transform tools: translate, rotate, scale with visual gizmos
  - Selection: single and multi-object
  - Scene hierarchy panel (outliner)
  - Multi-level undo / redo
  - Basic scene lights: ambient and directional lights authored as persistent scene objects, persisted with the scene, and published in the Scene Snapshot as `defaultLights`
  - Scene Snapshot publication to MFE-VIEWER and MFE-EXPORT
  - Scene state contribution to MFE-PROJECT (save/load)
  - Material reference slots (ready for MFE-MATERIALS; default material applied until then)
- **Out of scope:**
  - Material authoring (deferred to MFE-MATERIALS, planned)
  - Texture authoring (deferred to MFE-TEXTURES, planned)
  - Rendering / export (owned by MFE-EXPORT)
  - Point lights and spot lights as scene objects (deferred to v2; MFE-VIEWER may add these as viewer-local preview-only lights)
  - Viewer-local preview light overrides (owned by MFE-VIEWER; these supplement the scene's `defaultLights` for preview purposes only and are not authored in MFE-3D)
  - CSG Boolean mesh operations: subtraction, intersection, and difference (deferred to v2); note: geometric merge — the additive combination of vertex and triangle data from multiple objects into a single mesh without removal of interior surfaces — is not a CSG Boolean operation and is explicitly in scope as of this revision
  - Mesh sculpting or topology editing
  - Animation keyframe authoring

### 1.3 Architectural Context
MFE-3D owns the authoritative 3D scene state. It is the sole consumer of Shape Descriptors from
MFE-2D and the sole publisher of Scene Snapshots to MFE-VIEWER and MFE-EXPORT. It interacts with
MFE-PROJECT exclusively via the State Contribution and State Restoration contracts for persistence.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: 3D team
- Dependent teams: MFE-VIEWER team, MFE-EXPORT team (Scene Snapshot consumers), MFE-2D team (Shape Descriptor producer)
- QA/Validation: 3D QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| 3D viewport (editing view) | MFE-3D | |
| Scene hierarchy panel (outliner) | MFE-3D | |
| Object properties inspector | MFE-3D | |
| Transform gizmos | MFE-3D | |
| 3D primitives creation toolbar | MFE-3D | |
| 2D shape import panel | MFE-3D | Consumes Shape Descriptors from MFE-2D |
| 2D→3D conversion settings (extrude, revolve, sweep) | MFE-3D | |
| Scene Snapshot publication | MFE-3D | Consumed by MFE-VIEWER and MFE-EXPORT |
| Scene state (save/load) | MFE-3D | Contributed to / restored from MFE-PROJECT |
| Material reference slots on objects | MFE-3D | Populated by MFE-MATERIALS (planned) |
| Merge tool (Object Merge dialog and geometry merge operation) | MFE-3D | Requires ≥ 2 unlocked, merge-eligible selected objects; source objects removed or hidden upon confirmation; merged object placed at the geometric centroid of the combined bounding box |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user constructs 3D models and scene compositions using both native 3D primitives and
geometry derived from 2D vector shapes, with full transform control and hierarchical organization.

### 3.2 Key Scenarios
1. **Primitive creation** — User adds a box to the scene, adjusts its dimensions and position via gizmos and the inspector, and groups it with a sphere.
2. **2D→3D extrusion** — User imports a Shape Descriptor published from MFE-2D, specifies an extrusion depth, and obtains an extruded 3D mesh placed in the scene.
3. **2D→3D revolution** — User imports a profile curve from MFE-2D and applies revolve (lathe) around a specified axis to create a rotationally symmetric object.
4. **Scene organization** — User builds a parent/child hierarchy: a wheel hub with spokes as children, so moving the hub moves all spokes.
5. **Undo/redo** — User accidentally deletes an object and restores it via undo without losing any other scene changes.
6. **Object merge** — User selects three mesh objects in the viewport, invokes the Merge Objects action, reviews the pre-filled name ("Merged_" followed by the first source object's name) and the "Keep Source Objects" option in the Merge dialog, confirms the merge, and obtains a single merged-mesh object positioned at the geometric centroid of the combined bounding box of all source objects; the merged object displays a permanent wireframe edge overlay in the editing viewport that is visually distinct from the global wireframe display mode.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-3D Requirements

#### Viewport & Navigation
- MFE-3D shall render an interactive 3D editing viewport.
- MFE-3D shall support orbit, pan, and zoom camera navigation within the editing viewport.
- MFE-3D shall display a viewport orientation indicator (gizmo showing current camera orientation).
- MFE-3D shall support standard orthographic views (front, back, top, bottom, left, right) in addition to the default perspective view.
- MFE-3D shall display a reference grid in the viewport.

#### 3D Primitive Creation
- MFE-3D shall allow the user to add the following primitives to the scene: box, sphere, cylinder, cone, plane, and torus.
- Each primitive shall have configurable dimension parameters (e.g., radius, height, segment counts) accessible via the properties inspector before and after placement.
- Newly created primitives shall be placed at a default position (e.g., world origin or viewport center) and immediately selected.

#### 2D Shape Import & Conversion
- MFE-3D shall receive and queue Shape Descriptors published by MFE-2D.
- MFE-3D shall present received Shape Descriptors in an import panel showing descriptor name, bounding size, and a preview.
- MFE-3D shall allow the user to convert a received Shape Descriptor into a 3D mesh via:
  - **Extrusion**: the shape is extruded along a specified depth; the user configures depth, scale, and bevel settings.
  - **Revolution (lathe)**: the shape profile is revolved around a specified axis by a configurable angle; the user configures axis, angle, and segment count.
  - **Sweep**: the shape is swept along a user-defined path curve; the user defines the path by placing points in the viewport.
- MFE-3D shall apply a default material to the resulting mesh; the material shall be replaceable by MFE-MATERIALS when available.
- MFE-3D shall validate that an imported Shape Descriptor's `schemaVersion` is supported before offering conversion; unsupported versions shall be rejected with a visible error.
- MFE-3D shall discard a queued Shape Descriptor after the user explicitly dismisses it from the import panel.

#### Scene Graph & Hierarchy
- MFE-3D shall maintain a hierarchical scene graph (tree of parent/child object relationships).
- MFE-3D shall display the scene hierarchy in an outliner panel, showing object names and types.
- MFE-3D shall allow the user to rename any scene object.
- MFE-3D shall allow the user to re-parent objects via the outliner (drag and drop).
- MFE-3D shall allow the user to show/hide and lock/unlock individual objects in the viewport.
- MFE-3D shall allow the user to delete selected objects; child objects shall be deleted with their parent unless explicitly detached first.
- MFE-3D shall allow the user to duplicate selected objects.
- MFE-3D shall allow the user to group and ungroup selected objects.

#### Transform Tools
- MFE-3D shall provide a translate gizmo (move) for repositioning selected objects along X, Y, Z axes and on axis-aligned planes.
- MFE-3D shall provide a rotate gizmo for rotating selected objects around X, Y, Z axes.
- MFE-3D shall provide a scale gizmo for uniform and non-uniform scaling of selected objects along X, Y, Z axes.
- MFE-3D shall display exact transform values (position, rotation, scale) in the properties inspector and accept numeric input.
- MFE-3D shall support transform space switching (world space vs. local object space).
- MFE-3D shall support snapping: angle snap for rotation, distance snap for translate, and no-snap mode.

#### Selection
- MFE-3D shall support single-object selection by clicking in the viewport or outliner.
- MFE-3D shall support multi-object selection (shift-click and marquee/box selection in viewport).
- MFE-3D shall display a visual selection indicator on selected objects (e.g., bounding box highlight).

#### Object Merge

- MFE-3D shall provide an Object Merge operation that combines the vertex and triangle data of two or more selected mesh objects into a single new mesh object (the **merged object**).
- The Object Merge operation shall be a geometric combination only: all source geometry data is concatenated as-is into the merged object. Interior surfaces shall not be removed. This operation is not a CSG Boolean operation.
- MFE-3D shall require a minimum of two objects to be selected before the Object Merge operation may be invoked. If fewer than two objects are selected at invocation, MFE-3D shall display a user-visible informational message and shall take no further action; the scene shall remain unchanged.
- MFE-3D shall reject the Object Merge operation if any selected object is locked. The rejection shall produce a user-visible error message identifying each locked object by name. No change to the scene shall occur.
- Only objects whose `type` is `"mesh"` or `"merged-mesh"` shall be eligible as merge sources. If any selected object is of another type (including `"group"`, `"light"`, or `"camera"`), the operation shall be rejected with a user-visible error identifying the ineligible object(s) by name; no change to the scene shall occur.
- MFE-3D shall present a Merge dialog to the user before executing the operation. The Merge dialog shall expose:
  - An editable name field, pre-populated with the string `"Merged_"` followed by the name of the first selected source object in selection order. The user may modify this name before or after confirming the dialog.
  - A **"Keep Source Objects"** toggle, disabled by default.
- MFE-3D shall bake each source object's world transform into its geometry prior to merging: all vertices of each source object shall be expressed in world space, and the resulting combined vertex set shall then be re-expressed relative to the merged object's new local origin.
- The merged object's transform origin shall be placed at the geometric centroid of the combined axis-aligned bounding box of all source objects, computed in world space.
- MFE-3D shall place the merged object as a root-level scene object regardless of the hierarchy positions of the source objects.
- MFE-3D shall assign a default material to the merged object. Material references from source objects shall not be transferred to the merged object.
- When "Keep Source Objects" is disabled (default behavior): MFE-3D shall permanently remove all source objects from the scene upon confirmation of the merge.
- When "Keep Source Objects" is enabled: MFE-3D shall set all source objects to hidden (`visible: false`) rather than deleting them. Their visibility may be restored independently or via undo.
- MFE-3D shall render a permanent wireframe edge overlay on the merged object in the 3D editing viewport. This overlay shall be visually distinct from the global wireframe display mode and shall remain present regardless of the active display mode.
- MFE-3D shall register the entire merge operation — including source object removal or hiding and merged object creation — as a single undoable step in the MFE-3D undo stack.
- Upon undo of a merge operation: the merged object shall be removed, and all source objects shall be restored to their pre-merge state, including their original visibility flags, hierarchy positions, and local transforms.
- MFE-3D shall publish an updated Scene Snapshot immediately upon successful completion of the merge operation.

#### Undo / Redo
- MFE-3D shall maintain a multi-level command history for all scene editing actions.
- Undo and redo shall be available for the lifetime of the editing session.
- The undo stack need not be persisted to the project file; it resets on project open/close.

#### Scene Lights
- MFE-3D shall allow the user to add ambient and directional lights to the scene.
- MFE-3D shall allow the user to configure each scene light's: color, intensity, and direction (for directional lights).
- MFE-3D shall allow the user to enable or disable individual scene lights.
- MFE-3D shall allow the user to remove any scene light.
- Scene lights shall be named objects in the scene hierarchy, selectable and renameable via the outliner.
- Scene lights shall be persisted with the scene state and included in the Scene Snapshot as `defaultLights`.

#### Scene Snapshot Publication
- MFE-3D shall publish an updated Scene Snapshot whenever the scene state changes (object added, modified, or deleted).
- MFE-3D shall publish a Scene Snapshot on demand when requested by MFE-VIEWER or MFE-EXPORT.
- Scene Snapshots shall be consistent (not published mid-operation while an edit is in progress).

#### Scene State Persistence
- MFE-3D shall contribute its full scene state to MFE-PROJECT on request (State Contribution Contract).
- MFE-3D shall restore its scene state from a payload provided by MFE-PROJECT on project open (State Restoration Contract).
- MFE-3D shall validate the `schemaVersion` of a restored state payload; mismatched versions shall result in an empty scene and a visible error.

### 4.2 Cross-MFE Observable Behaviors
- When MFE-2D publishes a Shape Descriptor, MFE-3D shall display a notification in its import panel without disrupting the active editing state.
- When a project is opened, MFE-3D shall restore the scene before MFE-VIEWER renders it; MFE-VIEWER shall not show stale or empty scene content after a project open.
- When MFE-3D is unavailable, MFE-VIEWER shall display an empty scene with a user-visible notice; MFE-2D and MFE-EXPORT shall remain unaffected.

---

## 5. Contract Requirements

### 5.1 Shape Descriptor Contract (Consumer)
- **Producer:** MFE-2D
- **Trigger:** User publishes shape(s) from MFE-2D
- **Consumed fields:** An array of one or more Shape Descriptor objects. Each descriptor contains:
  - `schemaVersion`, `shapeId`, `paths`, `boundingBox`, `transform`, `units`
- **Constraints:**
  - MFE-3D shall validate `schemaVersion` before processing; unsupported versions shall be rejected.
  - MFE-3D shall store received descriptors in a queue visible in the import panel; receipt does not immediately add a mesh to the scene.
- **Acknowledgment:** MFE-3D shall return a synchronous acknowledgment for each descriptor in the batch:
  - `shapeId`: echoed UUID of the processed descriptor
  - `status`: `"accepted"` | `"rejected"`
  - `reason`: human-readable reason present only when `status` is `"rejected"`
  - MFE-3D shall return all acknowledgments before releasing control back to MFE-2D; the contract is synchronous.

### 5.2 Scene Snapshot Contract (Producer)
- **Consumers:** MFE-VIEWER, MFE-EXPORT
- **Trigger:** Scene state changes; also on-demand request from consumers
- **Payload semantics:**
  - `schemaVersion`: snapshot format version
  - `objects`: array of scene objects, each with:
    - `id`: stable UUID
    - `name`: display name
    - `type`: `"mesh"` | `"group"` | `"light"` | `"camera"`
    - `geometryRef`: opaque reference to geometry data (not the raw geometry)
    - `transform`: world transform matrix (4×4)
    - `materialRef`: opaque material reference (may be null / default)
    - `visible`: boolean
  - `hierarchy`: tree of `{ id, children: [] }` reflecting parent/child relationships
  - `cameras`: array of named camera definitions with position, orientation, and field-of-view
  - `defaultLights`: the scene's authored ambient and directional lights; authored in MFE-3D and persisted with the scene (not viewer-local overrides)
- **Constraints:**
  - Snapshots are immutable; consumers shall not attempt to modify them.
  - Geometry data referenced by `geometryRef` shall remain valid until the next snapshot supersedes it.
  - Snapshots shall not embed raw geometry data directly; references are used to avoid large payload copies.

> **Contract addendum — `"merged-mesh"` type and `wireframeEdges` field:**
> The `type` field on entries in the `objects` array shall additionally accept the value `"merged-mesh"`, identifying objects produced by the Object Merge operation. Merged-mesh objects shall carry an optional `wireframeEdges` field alongside the standard object fields. The `wireframeEdges` field contains edge topology data (an ordered set of vertex index pairs defining the edges of the merged mesh) that consumers may use to render the wireframe edge overlay for merged objects. Consumers that do not implement `"merged-mesh"` rendering or that do not read `wireframeEdges` shall silently ignore both the type value and the field without error. This addition is strictly additive; the `schemaVersion` value shall be incremented to reflect this contract extension, and existing consumers supporting the prior version shall remain valid per section 6.1 backward-compatibility constraints.

### 5.3 Scene State Contribution Contract (Producer for MFE-PROJECT)
- **Consumer:** MFE-PROJECT
- **Trigger:** MFE-PROJECT requests state before save
- **Payload semantics:** Full, serializable representation of the scene graph, including geometry, transforms, hierarchy, material references, and camera definitions.
- **Response timeout:** MFE-3D shall respond within five seconds.

### 5.4 Material Reference Contract (Consumer — Planned Stub)
- **Producer:** MFE-MATERIALS (planned)
- **Status:** Stub — not yet implemented.
- **Constraint:** Until MFE-MATERIALS is available, MFE-3D shall apply a default material to all objects. Material reference slots shall be reserved on each object but may be null.

### 5.5 Dirty-State Signal Contract (Producer)
- **Consumer:** MFE-PROJECT
- **Trigger:** Any scene modification: object added, removed, transformed, renamed, or visibility-toggled; conversion applied; hierarchy changed; light added, removed, or configured; merge operation completed (encompassing source object removal or hiding and merged object creation as a single trigger event)
- **Payload semantics:**
  - `mfeId`: `"mfe-3d"`
  - `changedAt`: ISO 8601 timestamp of the change
- **Constraints:**
  - MFE-3D shall debounce signals; at most one signal shall be emitted per 500 ms of continuous editing activity.
  - MFE-3D shall not emit a Dirty-State Signal during State Restoration (project open).

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-3D shall be independently releasable.
- Changes to the Scene Snapshot Contract shall maintain backward compatibility for at least one release cycle; breaking changes require a `schemaVersion` increment.
- Changes to the Shape Descriptor consumption contract shall be coordinated with the MFE-2D team.

### 6.2 Performance (User-Perceived)
- The 3D viewport shall maintain an interactive frame rate (target: 30 fps minimum, 60 fps on capable hardware) for scenes of up to 100,000 triangles.
- Primitive creation and transform operations shall be reflected in the viewport with no perceptible lag.
- 2D→3D conversion (extrude, revolve, sweep) shall complete and display the resulting mesh within three seconds for typical shape complexity.
- Scene Snapshot publication shall not cause a perceptible frame drop in the 3D viewport.

### 6.3 Reliability & Resilience
- MFE-3D shall not crash or lose scene state due to an invalid Shape Descriptor; invalid descriptors shall be rejected with a visible error and the scene left unchanged.
- A scene state that cannot be restored from a project file shall result in an empty scene with a user-visible error; MFE-3D shall not crash.
- Loss of connection to MFE-VIEWER or MFE-EXPORT shall not affect editing functionality in MFE-3D.

### 6.4 Security & Privacy
- Scene geometry and material data shall not leave the browser.
- Raw geometry data referenced in Scene Snapshots shall not be accessible to consumers outside the defined contract.

### 6.5 Accessibility & Compliance
- All object creation and transform actions shall be triggerable via keyboard shortcuts.
- The outliner panel shall be keyboard-navigable with standard tree-navigation patterns.
- Transform gizmos shall have keyboard equivalents (nudge, rotate by configured increment).
- Selection state shall be communicated both visually and via accessible state on interactive elements.

### 6.6 Observability
- MFE-3D shall emit notifications for: Shape Descriptor import success, Shape Descriptor rejection (with reason), 2D→3D conversion success, and 2D→3D conversion failure.
- Scene Snapshot publication failures (consumer unreachable) shall be logged as observable events without disrupting editing.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given an empty scene, when the user adds a box primitive, then a box appears in the viewport, is selected, and its dimensions are shown in the properties inspector.
- Given a Shape Descriptor received from MFE-2D, when the user selects "Extrude" with a depth of 10 units, then a closed extruded mesh appears in the scene with the correct bounding volume.
- Given a scene with three objects, when the user re-parents object C under object B in the outliner, then C's world position appears unchanged and it moves with B thereafter.
- Given three scene edits, when the user performs undo three times, then the scene returns to its state before all three edits.
- Given an active scene, when the project is saved and reopened, then MFE-3D restores the scene with all objects, transforms, hierarchy, and scene lights intact.
- Given an object is selected and the user presses the configured nudge key (e.g., arrow keys), then the object moves by one nudge increment on the expected axis in the viewport.
- Given an object is selected and the user presses the rotate-by-increment shortcut, then the object rotates by the configured angle increment around the active transform axis.
- Given three unlocked mesh objects are selected in the viewport, when the user invokes Object Merge and confirms in the Merge dialog with default settings, then a single merged-mesh object appears at the geometric centroid of the combined bounding box of the source objects, the three source objects are removed from the scene, the merged object displays a permanent wireframe edge overlay in the editing viewport, and an updated Scene Snapshot is published immediately.
- Given the Merge dialog is displayed with the pre-populated name "Merged_ObjectA", when the user replaces it with "CombinedHull" before confirming, then the merged object is created with the name "CombinedHull" and appears under that name in both the viewport and the scene hierarchy outliner.
- Given two mesh objects are selected and the user enables the "Keep Source Objects" toggle before confirming the Merge dialog, when the merge is confirmed, then the merged object is created as a root-level scene object, and both source objects remain present in the scene hierarchy with their `visible` flag set to false; no source object is deleted.

### 7.2 Edge Cases
- Given a Shape Descriptor with `schemaVersion` not supported by MFE-3D, then MFE-3D displays an error in the import panel, does not add the shape to the queue, and sends a rejection acknowledgment to MFE-2D.
- Given a sweep operation where the user-defined path has zero length, then MFE-3D displays an informational error ("invalid path") and does not produce a mesh.
- Given a scene with 200,000 triangles, when the user orbits the camera, then the viewport degrades gracefully (level-of-detail reduction is acceptable) rather than freezing.
- Given exactly one object is selected in the viewport, when the user invokes Object Merge, then MFE-3D displays a user-visible informational message stating that at least two objects must be selected, and no change is made to the scene; the undo stack is not modified.
- Given three objects are selected of which one is locked, when the user invokes Object Merge, then MFE-3D displays a user-visible error message identifying the locked object by name, the merge operation is not performed, and the scene remains unchanged.
- Given a merge has been completed with "Keep Source Objects" disabled (source objects removed), when the user performs a single undo action, then the merged object is removed from the scene, all source objects are restored at their original hierarchy positions with their original transforms and visibility states, and an updated Scene Snapshot reflecting the restored state is published.

### 7.3 Failure & Degraded Experience
- Given MFE-VIEWER is unavailable, then MFE-3D continues to function fully; no error is presented within MFE-3D's panel.
- Given the scene state payload received on project open has an unrecognized `schemaVersion`, then MFE-3D presents an empty scene and a visible version-mismatch error; the application does not crash.

### 7.4 Compatibility
- Given MFE-VIEWER is running an older version of the Scene Snapshot consumer that supports `schemaVersion` "1.0" and MFE-3D publishes version "1.1" snapshots, then the additive fields in "1.1" are ignored by the older consumer without error.

---

## 8. Assumptions
- The 3D coordinate system uses a Y-up, right-handed convention; this shall be consistent with the convention used in Scene Snapshots.
- Geometry data is stored in the browser's GPU-accessible memory during editing sessions; project file serialization converts it to a portable format.
- The undo stack depth is limited by available memory; very long sessions may exhibit reduced undo depth, which is acceptable provided it is communicated to the user.

---

## 9. Open Questions
- [x] Is undo/redo scoped to MFE-3D only, or should it be unified with MFE-2D in a global history? **Resolved: per-MFE. Ctrl+Z / Ctrl+Y are dispatched to the MFE panel that currently holds keyboard focus; they are not registered in the global shortcut registry.**
- [ ] Should camera definitions saved in the scene be separate from viewer-configured cameras, or the same set? (owner: Product, due: TBD)
- [x] Are basic scene lights (ambient, directional) editable within MFE-3D, or only within MFE-VIEWER? **Resolved: ambient and directional lights are scene objects authored in MFE-3D and included in the Scene Snapshot. MFE-VIEWER may add local preview-only overrides that do not affect the scene or export.**
- [ ] Should MFE-3D support GLB/OBJ import of existing 3D models? (owner: Product, due: TBD)
- [ ] What level of mesh decimation or LOD is required for performance at scale? (owner: Engineering, due: TBD)
- [ ] Should the sweep path be definable only by placing points, or also by referencing an existing 2D path from MFE-2D? (owner: Product, due: TBD)
- [ ] What is the authoritative serialization format for the `wireframeEdges` field on merged-mesh objects in the Scene Snapshot? (An ordered array of vertex-index pairs is assumed; the exact encoding and coordinate space must be confirmed before MFE-VIEWER and MFE-EXPORT implement wireframe rendering of merged objects.) (owner: Engineering, due: TBD)
- [ ] Should the Object Merge operation support merging of `"group"` objects by first flattening the group hierarchy, or shall groups remain ineligible as merge sources in all versions? (owner: Product, due: TBD)
