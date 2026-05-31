# Spec: MFE-EXPORT — Render & Export

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
Render & Export MFE (MFE-EXPORT). MFE-EXPORT provides non-destructive rendering and file export
for both 2D canvas content and 3D scene content, delivering output files (PNG, SVG) to the user's
device without modifying any project or scene state.

### 1.2 Scope
- **In scope:**
  - Export of 2D canvas content to PNG and SVG formats
  - Export of 3D scene content to PNG (rendered) and SVG (wireframe / outline projection) formats
  - Export configuration: resolution, background, camera/view selection, format-specific options
  - Progress indication for long-running exports
  - File delivery to user's device (download)
- **Out of scope:**
  - Modification of scene or canvas state (strictly prohibited)
  - Project file save/load (owned by MFE-PROJECT)
  - 3D format export (GLB, OBJ, STL — see Open Questions)
  - Video / animation export
  - Cloud upload or sharing

### 1.3 Architectural Context
MFE-EXPORT is a read-only consumer of two data sources: the Canvas Snapshot (from MFE-2D) and the
Scene Snapshot (from MFE-3D). It renders and packages output entirely within the browser and
delivers it to the user's device via file download. It does not modify any state outside its own
panel.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: Export team
- Dependent teams: MFE-2D team (Canvas Snapshot producer), MFE-3D team (Scene Snapshot producer)
- QA/Validation: Export QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| Export panel UI | MFE-EXPORT | |
| Export configuration controls | MFE-EXPORT | |
| 2D canvas rendering for export | MFE-EXPORT | Input: Canvas Snapshot from MFE-2D |
| 3D scene rendering for export | MFE-EXPORT | Input: Scene Snapshot from MFE-3D |
| File packaging and download delivery | MFE-EXPORT | |
| Export progress indication | MFE-EXPORT | |
| Canvas Snapshot consumption | MFE-EXPORT | Produced by MFE-2D |
| Scene Snapshot consumption | MFE-EXPORT | Produced by MFE-3D |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user produces publication-ready image files from their 2D and 3D work without leaving the
application and without risk of losing or altering their project content.

### 3.2 Key Scenarios
1. **2D SVG export** — User exports the 2D canvas as an SVG file to use in a presentation or further editing in an external tool.
2. **2D PNG export** — User exports the 2D canvas as a high-resolution PNG at a configured pixel density.
3. **3D PNG render** — User selects a named camera, configures lighting context, and exports the 3D scene as a PNG.
4. **3D SVG wireframe export** — User exports the 3D scene as an SVG wireframe projection for technical documentation.
5. **Batch export** — User exports both the 2D canvas and the 3D scene in a single workflow session without re-configuring from scratch.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-EXPORT Requirements

#### Source Selection
- MFE-EXPORT shall allow the user to select the export source: **2D Canvas** or **3D Scene**.
- MFE-EXPORT shall display a live thumbnail preview of the selected source before the user commits to export.
  - For 2D Canvas source: the thumbnail shall be generated from a Canvas Snapshot at reduced scale (maximum 256 × 256 pixels) and shall appear within two seconds of source selection.
  - For 3D Scene source: the thumbnail shall be generated from the most recently cached Scene Snapshot rendered at reduced resolution (maximum 256 × 256 pixels) and shall appear within two seconds of source selection.
  - When the source is unavailable or the thumbnail cannot be generated, MFE-EXPORT shall display a placeholder image with the label "Preview unavailable".
- MFE-EXPORT shall indicate clearly if a selected source is unavailable (e.g., MFE-2D offline, empty canvas).

#### 2D Canvas Export
- MFE-EXPORT shall export the 2D canvas as a valid **SVG** file reproducing all visible shapes at their current state.
- MFE-EXPORT shall export the 2D canvas as a **PNG** file at the user-configured pixel resolution.
- MFE-EXPORT shall allow the user to configure the PNG output resolution (width × height in pixels), with a minimum of 72 DPI equivalent and a maximum of 4× the native canvas pixel density.
- MFE-EXPORT shall allow the user to set the background: transparent (for PNG and SVG where supported), solid color, or white.
- MFE-EXPORT shall allow the user to select whether to export all visible layers or only specific selected layers.

#### 3D Scene Export (PNG)
- MFE-EXPORT shall render the 3D scene to a **PNG** image using the user-selected camera.
- MFE-EXPORT shall allow the user to select from cameras defined in the Scene Snapshot (authored in MFE-3D). Viewer-local cameras (defined in MFE-VIEWER) are not accessible to MFE-EXPORT.
- If the Scene Snapshot contains no cameras, MFE-EXPORT shall apply a default perspective camera and display a non-blocking notice informing the user that no named cameras are defined in the scene.
- MFE-EXPORT shall allow the user to configure the PNG output resolution (width × height in pixels), with a minimum of 72 DPI equivalent and a maximum of 8K (7680 × 4320) pixels.
- MFE-EXPORT shall allow the user to set the background: transparent (alpha channel), solid color, or environment background (if an environment is defined in the scene).
- MFE-EXPORT shall render the scene using the current default materials (with MFE-MATERIALS replacements when available).
- MFE-EXPORT shall apply the scene's `defaultLights` from the Scene Snapshot exclusively. Viewer-local light overrides from MFE-VIEWER are not included in the export render.

#### 3D Scene Export (SVG)
- MFE-EXPORT shall export the 3D scene as an **SVG** file representing a projected view (silhouette outlines and/or visible wireframe edges) from the user-selected camera.
- MFE-EXPORT shall allow the user to select between: **silhouette only**, **wireframe (all edges)**, and **visible edges only** (hidden lines removed).
- MFE-EXPORT shall allow the user to configure stroke color, stroke width, and background for the SVG output.

#### Export Configuration
- MFE-EXPORT shall present export configuration options before the user commits to exporting.
- MFE-EXPORT shall remember the last-used configuration per export type (2D/PNG, 2D/SVG, 3D/PNG, 3D/SVG) for the duration of the browser session.
- MFE-EXPORT shall display the estimated output file size before the user confirms the export where it can be computed in advance.

#### Export Execution & Delivery
- MFE-EXPORT shall perform all rendering operations off the main UI thread to avoid blocking the application frame.
- MFE-EXPORT shall display a progress indicator for any export operation that takes longer than two seconds to complete.
- MFE-EXPORT shall allow the user to cancel an in-progress export.
- MFE-EXPORT shall deliver the completed export file to the user as a browser download, using a filename derived from the project name, source type, format, and timestamp.
- MFE-EXPORT shall display a success notification upon file delivery and an error notification on failure.

#### Non-Destructiveness
- MFE-EXPORT shall not modify the canvas state, the scene state, the project state, or any persistent storage at any point during or after an export operation.
- MFE-EXPORT shall treat all received snapshots as immutable; it shall not write back to MFE-2D, MFE-3D, or MFE-PROJECT.

### 4.2 Cross-MFE Observable Behaviors
- When a user triggers export from MFE-SHELL (File > Export), MFE-EXPORT shall open its configuration panel in a focused state.
- When MFE-2D is unavailable, the 2D Canvas export option shall be disabled with a user-visible reason; 3D export options shall remain accessible.
- When MFE-3D is unavailable, the 3D Scene export options shall be disabled with a user-visible reason; 2D export options shall remain accessible.
- The project state shall not change as a result of any export operation (confirmed by the dirty-state indicator remaining unchanged).

---

## 5. Contract Requirements

### 5.1 Canvas Snapshot Contract (Consumer)
- **Producer:** MFE-2D
- **Trigger:** MFE-EXPORT requests a snapshot on export initiation
- **Consumed fields:**
  - `schemaVersion`, `svgDocument` (complete SVG string), `boundingBox`
- **Constraints:**
  - MFE-EXPORT shall treat the SVG document as the definitive source for 2D export; it shall not re-request canvas state from MFE-PROJECT.
  - If MFE-2D does not respond within ten seconds, MFE-EXPORT shall display a timeout error and cancel the export attempt.
  - MFE-EXPORT shall validate `schemaVersion`; unrecognized versions shall cause an error notification rather than a silent failure.

### 5.2 Scene Snapshot Contract (Consumer)
- **Producer:** MFE-3D
- **Trigger:** MFE-EXPORT requests a snapshot on export initiation (or consumes the latest cached snapshot)
- **Consumed fields:**
  - `schemaVersion`, `objects`, `hierarchy`, `cameras`, `defaultLights`
- **Constraints:**
  - MFE-EXPORT shall treat the snapshot as immutable.
  - MFE-EXPORT shall handle an empty scene snapshot (no objects) by rendering a blank image with the configured background; this is not an error condition.
  - Unrecognized `schemaVersion` values shall produce a visible error and cancel the export.

### 5.3 Export Trigger Contract (Consumer)
- **Producer:** MFE-SHELL (on behalf of user action)
- **Consumed fields:**
  - `sourceType`: `"2d"` | `"3d"` — preselects the export source tab
  - `formatHint`: optional `"png"` | `"svg"` — preselects the format
- **Constraints:**
  - MFE-EXPORT shall open its panel in a configured state based on these hints; the user retains the ability to change any setting before confirming.
  - If `sourceType` is omitted, MFE-EXPORT shall default to the last-used source type.

### 5.4 Notification Contract (Producer)
- MFE-EXPORT shall emit notifications to MFE-SHELL for: export started, export success (including filename), export failure (including reason), and export cancelled by user.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-EXPORT shall be independently releasable.
- Changes to the Canvas Snapshot and Scene Snapshot consumption behavior shall support the two most recent schema versions.

### 6.2 Performance (User-Perceived)
- Export operations at standard resolutions (up to 1920 × 1080 for 3D PNG; native size for 2D SVG) shall complete within five seconds for typical scenes and canvases.
- Export at 4K resolution (3840 × 2160 for 3D PNG) shall complete within ten seconds on modern hardware.
- Export at maximum resolution (8K PNG — 7680 × 4320, 3D) shall complete within thirty seconds on modern hardware.
- The progress indicator shall appear within one second of export initiation for any operation exceeding two seconds.
- Rendering for export shall not cause any perceptible degradation in the editing panels (MFE-2D, MFE-3D, MFE-VIEWER).

### 6.3 Reliability & Resilience
- A rendering failure during export (e.g., GPU context error, out of memory) shall result in a user-visible error notification; no partial file shall be delivered.
- Export cancellation shall terminate all rendering work and release associated resources within three seconds.
- MFE-EXPORT failures shall not affect MFE-SHELL, MFE-2D, MFE-3D, or MFE-VIEWER.

### 6.4 Security & Privacy
- Rendered output shall not be transmitted to any external server; delivery is exclusively via browser download.
- MFE-EXPORT shall access scene and canvas data only through the defined contracts; it shall not access MFE-PROJECT's storage directly.

### 6.5 Accessibility & Compliance
- All export configuration controls shall be keyboard-navigable.
- The progress indicator shall include a text-based percentage or status message, not only a visual progress bar.
- Export success and error notifications shall be announced to screen readers.
- The cancel action during export shall be reachable via keyboard.

### 6.6 Observability
- MFE-EXPORT shall clearly distinguish in its UI between: awaiting snapshot, rendering, writing file, and error states.
- Each error notification shall include the export source type, format, and a human-readable failure reason.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given a 2D canvas with three shapes, when the user exports to SVG with default settings, then a valid SVG file reproducing all three shapes is downloaded within five seconds.
- Given a 2D canvas, when the user exports to PNG at 1920 × 1080 with a white background, then a PNG file at exactly 1920 × 1080 pixels with white background is downloaded.
- Given a 3D scene with two objects and a named camera "Top", when the user selects "Top" and exports to PNG at 1080 × 1080, then a PNG rendered from the "Top" camera perspective is downloaded.
- Given a 3D scene, when the user exports to SVG with "silhouette only" mode, then an SVG containing the projected silhouette outlines of visible objects is downloaded.
- Given any export completes successfully, then the project dirty indicator is unchanged (no project state modification occurred).

### 7.2 Edge Cases
- Given a 2D canvas with all layers hidden, when the user exports to SVG, then a valid empty SVG document is delivered (not an error).
- Given the user requests 8K PNG export of a complex scene, then MFE-EXPORT displays a progress indicator within one second of initiation and completes delivery within thirty seconds.
- Given the user cancels an in-progress 3D PNG export, then the download is not initiated, all rendering resources are released, and MFE-EXPORT returns to idle state within three seconds.

### 7.3 Failure & Degraded Experience
- Given MFE-2D is unavailable when the user opens MFE-EXPORT, then the 2D Canvas export option is disabled with the label "2D Editor unavailable"; 3D Scene export remains accessible.
- Given a Canvas Snapshot request times out (MFE-2D unresponsive for >10 seconds), then MFE-EXPORT displays an error notification: "Could not retrieve canvas data. Please retry." No partial file is downloaded.
- Given a GPU rendering error occurs during 3D PNG export, then MFE-EXPORT displays a specific error: "Render failed. Try reducing output resolution." No file is downloaded.
- Given MFE-EXPORT fails to load, then MFE-SHELL, MFE-2D, MFE-3D, and MFE-VIEWER continue to operate; the export panel area displays an error with a reload action.

### 7.4 Compatibility
- Given the Scene Snapshot schema version received by MFE-EXPORT is v1.1 but MFE-EXPORT was built for v1.0, then MFE-EXPORT processes the known v1.0 fields and ignores additive v1.1 fields, completing the export successfully.

---

## 8. Assumptions
- All rendering for export occurs in the browser using the same GPU rendering path available to MFE-VIEWER; server-side rendering is not required.
- The browser's ability to render off-screen (e.g., offscreen canvas, OffscreenCanvas API) is available on target browsers for background rendering without blocking the UI.
- File delivery is exclusively via browser download; no cloud upload path exists in this version.
- MFE-EXPORT renders 3D exports using only the `defaultLights` from the Scene Snapshot. Viewer-local light configurations are preview-only and are not transmitted to MFE-EXPORT.

---

## 9. Open Questions
- [x] Should viewer-configured lights (from MFE-VIEWER) be available for use in 3D PNG exports? **Resolved: No. MFE-EXPORT uses only `defaultLights` from the Scene Snapshot. Viewer-local lights are preview-only.**
- [ ] Should MFE-EXPORT support export of 3D models in 3D formats (GLB, OBJ, STL), or is this owned by MFE-PROJECT? (owner: Product, due: TBD)
- [ ] Is a "batch export" mode (export 2D and 3D in one action as a ZIP) required? (owner: Product, due: TBD)
- [ ] For 3D SVG "visible edges only" mode, what is the acceptable computation time limit before the operation is considered too slow? (owner: Engineering, due: TBD)
- [ ] Should export configuration (resolution, background, camera) be persisted to the project file, or remain session-only? (owner: Product, due: TBD)
