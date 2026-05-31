# Spec: MFE-2D — 2D Editor

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
2D Editor (MFE-2D). MFE-2D provides a vector-based canvas for creating and editing 2D shapes, and
acts as the source of 2D shape data consumed by the 3D Editor (MFE-3D).

### 1.2 Scope
- **In scope:**
  - Vector canvas management (viewport, zoom, pan)
  - Shape creation tools: rectangle, ellipse, polygon, freehand path, line segment
  - Shape editing: node editing, transform (move, rotate, scale)
  - Shape organization: layers, grouping, z-ordering
  - Boolean operations on shapes (union, subtract, intersect)
  - Selection and multi-selection
  - SVG import onto the canvas
  - Shape Descriptor publication to MFE-3D
  - Canvas state contribution to MFE-PROJECT (for save/load)
- **Out of scope:**
  - Raster/pixel editing (deferred to MFE-TEXTURES, planned)
  - Text rendering beyond basic shape labels
  - 3D operations (owned by MFE-3D)
  - File export (owned by MFE-EXPORT)
  - DXF import/export (see Open Questions)

### 1.3 Architectural Context
MFE-2D is a self-contained editing microfrontend. It publishes Shape Descriptors to MFE-3D via the
2D→3D contract and contributes its canvas state to MFE-PROJECT via the State Contribution Contract.
It communicates with MFE-EXPORT exclusively via the Canvas Snapshot Contract, wherein MFE-EXPORT
requests and MFE-2D provides a read-only snapshot of the current canvas content. It does not
directly access the file system or communicate with MFE-VIEWER.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: 2D team
- Dependent teams: MFE-3D team (Shape Descriptor consumer), MFE-EXPORT team (canvas snapshot consumer)
- QA/Validation: 2D QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| 2D canvas viewport | MFE-2D | |
| Drawing tools panel | MFE-2D | |
| Shape properties inspector | MFE-2D | |
| Layers panel | MFE-2D | |
| Shape Descriptor publication | MFE-2D | Consumed by MFE-3D |
| Canvas state (save/load) | MFE-2D | Contributed to / restored from MFE-PROJECT |
| SVG import onto canvas | MFE-2D | |
| Canvas snapshot for export | MFE-2D | Consumed by MFE-EXPORT |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user creates accurate 2D vector shapes that can be edited freely and optionally promoted into
the 3D editing environment as a foundation for 3D geometry.

### 3.2 Key Scenarios
1. **Shape creation** — User selects the ellipse tool, draws a circle, adjusts its dimensions via the properties inspector, and changes its stroke and fill.
2. **Path editing** — User creates a freehand path, then enters node-edit mode to reposition individual anchor points and adjust curve handles.
3. **Boolean operation** — User selects two overlapping shapes and applies a boolean subtraction to create a composite shape.
4. **Publish to 3D** — User selects a closed shape and publishes it to MFE-3D as a Shape Descriptor for extrusion.
5. **SVG import** — User imports an SVG file; its paths appear on the canvas as editable vector shapes.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-2D Requirements

#### Canvas & Viewport
- MFE-2D shall render a vector canvas with an infinite (or very large) coordinate space.
- MFE-2D shall support continuous zoom (zoom in / zoom out) and pan navigation of the canvas.
- MFE-2D shall display a configurable grid with optional snap-to-grid behavior.
- MFE-2D shall display rulers along the canvas edges showing the current unit (pixels, millimeters, or points).
- MFE-2D shall allow the user to switch between canvas units.

#### Drawing Tools
- MFE-2D shall provide a rectangle tool for drawing axis-aligned and rotated rectangles.
- MFE-2D shall provide an ellipse tool for drawing ellipses and circles.
- MFE-2D shall provide a regular polygon tool supporting configurable side count (3–12).
- MFE-2D shall provide a freehand path tool for drawing open and closed Bézier paths.
- MFE-2D shall provide a line segment tool for drawing straight-line polylines.
- MFE-2D shall provide a pen tool for placing anchor points and defining curve handles (Bézier).

#### Shape Editing
- MFE-2D shall allow the user to select individual shapes or groups of shapes via click and marquee selection.
- MFE-2D shall allow the user to move, rotate, and scale selected shapes via on-canvas handles and a properties inspector.
- MFE-2D shall allow the user to enter node-edit mode for any path shape, enabling repositioning of anchor points and adjustment of curve handles.
- MFE-2D shall allow the user to add and delete anchor points on existing paths.
- MFE-2D shall allow the user to close an open path or open a closed path.
- MFE-2D shall support numeric input for position, size, and rotation in the properties inspector.
- MFE-2D shall apply snap-to-object behavior (snap to edges, centers, and anchor points of other shapes) when snap is enabled.

#### Shape Properties
- MFE-2D shall allow the user to set fill color (solid, none) for any shape.
- MFE-2D shall allow the user to set stroke color, stroke width, and dash pattern for any shape.
- MFE-2D shall allow the user to set opacity for any shape.

#### Boolean Operations
- MFE-2D shall support boolean union of two or more selected closed shapes.
- MFE-2D shall support boolean subtraction (difference) of two selected closed shapes.
- MFE-2D shall support boolean intersection of two selected closed shapes.
- Boolean operations shall produce a new editable path shape; the source shapes shall be removed.

#### Layers
- MFE-2D shall provide a layer panel allowing the user to create, rename, reorder, show/hide, and lock/unlock layers.
- MFE-2D shall allow the user to assign shapes to layers and move shapes between layers.
- Shapes on locked layers shall not be selectable or editable via canvas interaction.

#### Grouping
- MFE-2D shall allow the user to group two or more selected shapes into a named group.
- MFE-2D shall allow the user to ungroup a selected group, returning member shapes to the parent layer.
- Groups shall be selectable as a unit via canvas click and in the layers panel.
- Individual shapes within a group shall be selectable in isolation via a secondary action (e.g., double-click or equivalent).
- Groups shall be movable, rotatable, and scalable as a unit via canvas handles and the properties inspector.
- Group names shall be renameable via the layers panel.

#### History
- MFE-2D shall support multi-level undo and redo for all editing actions.
- The undo history shall persist for the duration of the editing session; it need not be persisted to the project file.

#### SVG Import
- MFE-2D shall allow the user to import an SVG file; path, shape, and group elements shall appear on the canvas as editable vector shapes.
- SVG elements not representable as editable shapes (e.g., raster image embeds, filters) shall be imported as non-editable reference objects with a user-visible annotation.

#### Shape Descriptor Publication
- MFE-2D shall allow the user to select one or more closed shapes and publish them as a Shape Descriptor to MFE-3D.
- MFE-2D shall validate that all selected shapes are closed paths before publication; open paths shall be excluded with a user-visible warning listing the excluded shapes.
- MFE-2D shall display a confirmation or error notification after a publication attempt, reflecting the result received from MFE-3D.

### 4.2 Cross-MFE Observable Behaviors
- When the user publishes a shape, MFE-3D shall acknowledge receipt; MFE-2D shall display a success notification sourced from MFE-3D's acknowledgment.
- If MFE-3D is unavailable, MFE-2D shall display an error notification and not alter the canvas state.
- Canvas state is included in every project save; after a project open, the canvas restores to the exact state at the time of the last save.

---

## 5. Contract Requirements

### 5.1 Shape Descriptor Contract (Producer)
- **Consumer:** MFE-3D
- **Trigger:** User action "Publish to 3D" within MFE-2D
- **Payload semantics:** An array of one or more Shape Descriptor objects. A single-shape publication shall be sent as an array containing one descriptor. Each descriptor contains:
  - `schemaVersion`: descriptor format version string (same value across all descriptors in the batch)
  - `shapeId`: stable UUID for this shape (reused on re-publication of the same canvas object)
  - `paths`: ordered array of closed path definitions, each containing:
    - `segments`: array of Bézier curve segments (anchor points + control handles)
    - `winding`: fill rule (`"nonzero"` or `"evenodd"`)
  - `boundingBox`: axis-aligned bounding rectangle in canvas units `{ x, y, width, height }`
  - `transform`: 2D affine transform matrix applied at time of publication (6-element array)
  - `units`: canvas unit at time of publication (`"px"` | `"mm"` | `"pt"`)
- **Constraints:**
  - Only closed paths shall be included in the descriptor.
  - MFE-2D shall not transmit fill/stroke visual style within the Shape Descriptor; these are canvas-only properties.
- **Acknowledgment:** MFE-3D returns a synchronous acknowledgment for each descriptor in the batch:
  - `shapeId`: echoed UUID of the processed descriptor
  - `status`: `"accepted"` | `"rejected"`
  - `reason`: human-readable reason present only when `status` is `"rejected"`
  - If no acknowledgment is received within three seconds, MFE-2D shall treat all unacknowledged descriptors as failed and display an error notification.

### 5.2 Canvas State Contribution Contract (Producer)
- **Consumer:** MFE-PROJECT (via State Contribution Contract)
- **Trigger:** MFE-PROJECT requests state before save
- **Payload semantics:**
  - `schemaVersion`: canvas state format version
  - `layers`: ordered array of layer definitions, each containing an ordered array of shape definitions
  - `viewport`: last-used zoom level and pan offset
  - `units`: active canvas unit
- **Response timeout:** MFE-2D shall respond to the state request within five seconds.

### 5.3 Canvas Snapshot Contract (Producer for MFE-EXPORT)
- **Consumer:** MFE-EXPORT
- **Trigger:** MFE-EXPORT requests a canvas snapshot for rendering
- **Payload semantics:**
  - `schemaVersion`: snapshot format version
  - `svgDocument`: complete SVG document string representing the current visible canvas content
  - `boundingBox`: extent of all shapes on the canvas
- **Constraints:**
  - MFE-2D shall include all visible (non-hidden) shapes in the snapshot.
  - The snapshot shall not include layer metadata or editing UI artifacts.

### 5.4 Menu Contribution Contract (Consumer)
- MFE-2D shall register relevant contextual menu items in MFE-SHELL's menu bar (e.g., Edit > Undo, Edit > Redo, Edit > Boolean Operations) via the Menu Contribution Contract.

### 5.5 Dirty-State Signal Contract (Producer)
- **Consumer:** MFE-PROJECT
- **Trigger:** Any canvas modification: shape added, removed, moved, reshaped, or style-changed; layer created or deleted; group created or ungrouped; SVG imported
- **Payload semantics:**
  - `mfeId`: `"mfe-2d"`
  - `changedAt`: ISO 8601 timestamp of the change
- **Constraints:**
  - MFE-2D shall debounce signals; at most one signal shall be emitted per 500 ms of continuous editing activity.
  - MFE-2D shall not emit a Dirty-State Signal during State Restoration (project open).

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-2D shall be independently releasable.
- Changes to the Shape Descriptor Contract shall maintain backward compatibility for at least one release cycle; breaking changes require a `schemaVersion` increment.

### 6.2 Performance (User-Perceived)
- Canvas rendering shall remain interactive (no perceptible lag during pan/zoom) for canvases containing up to 500 simultaneous shapes on modern hardware.
- Boolean operations shall complete and display the result within two seconds for typical shape complexity.
- Shape Descriptor publication shall complete (including acknowledgment from MFE-3D) within three seconds for typical shapes.

### 6.3 Reliability & Resilience
- A failure in MFE-3D (unavailable or unresponsive) shall not prevent the user from editing shapes in MFE-2D.
- A canvas state that cannot be restored from a project file shall result in an empty canvas with a user-visible warning; MFE-2D shall not crash.

### 6.4 Accessibility & Compliance
- All drawing tools shall be activatable via keyboard shortcut.
- The canvas shall support keyboard-based nudge of selected shapes (arrow keys).
- The properties inspector shall be fully keyboard-navigable with appropriate ARIA labeling.
- Color pickers shall not rely solely on color to communicate selection; labels or values shall accompany all color swatches.

### 6.5 Observability
- MFE-2D shall emit a notification for: successful shape publication, failed shape publication (including reason), and SVG import errors.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given the rectangle tool is active, when the user drags on the canvas, then a rectangle shape appears and is immediately selectable and editable.
- Given a closed freehand path, when the user invokes "Publish to 3D" and MFE-3D is available, then MFE-2D displays a success notification and the shape remains unchanged on the canvas.
- Given two overlapping closed shapes selected, when the user applies boolean union, then a single composite closed path replaces the two source shapes.
- Given an SVG file with path and shape elements, when the user imports it, then all path and shape elements appear on the canvas as editable vector shapes.
- Given an active project is saved and reopened, then the canvas state (all shapes, layers, viewport) is restored exactly.

### 7.2 Edge Cases
- Given the user attempts to publish an open path, then MFE-2D excludes it from the publication, displays a warning listing the excluded shape by name/id, and publishes only the valid closed shapes.
- Given a boolean subtraction is applied to two non-overlapping shapes, then MFE-2D displays an informational message ("shapes do not overlap") and does not modify the canvas.

### 7.3 Failure & Degraded Experience
- Given MFE-3D is unavailable when the user triggers "Publish to 3D", then MFE-2D displays an error notification; the canvas state is unchanged.
- Given a canvas state payload from a project file has an unrecognized `schemaVersion`, then MFE-2D displays a version mismatch warning, renders an empty canvas, and does not crash.

### 7.4 Compatibility
- Given a Shape Descriptor with `schemaVersion` "1.0" is consumed by a MFE-3D that supports "1.1", then MFE-3D processes the descriptor without error (additive compatibility).

---

## 8. Assumptions
- The canvas coordinate system uses a Cartesian (Y-up) convention; this is consistent with the SVG export coordinate system.
- Text elements on the canvas are treated as shapes (converted to outlines) for the purposes of Shape Descriptor publication.
- The canvas has no fixed document size; the user defines the working area implicitly via shape placement.

---

## 9. Open Questions
- [ ] Should MFE-2D support DXF import (and/or export) in addition to SVG? (owner: Product, due: TBD)
- [ ] Should SVG non-representable elements (e.g., raster embeds) be silently skipped or rejected with a visible warning? (owner: Product, due: TBD)
- [ ] Is text-as-editable-text (not outlined) required, and if so, what font sourcing mechanism is in scope? (owner: Product, due: TBD)
- [ ] Should snap-to-grid and snap-to-object behaviors be independently togglable? (owner: Product, due: TBD)
- [ ] Should layer visibility be persisted in the project file or treated as session-only state? (owner: Product, due: TBD)
