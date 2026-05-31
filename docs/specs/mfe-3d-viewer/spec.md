# Spec: MFE-VIEWER — 3D Quick Viewer

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
3D Quick Viewer (MFE-VIEWER). MFE-VIEWER provides a real-time, non-destructive preview of the
3D scene with user-configurable lighting and camera controls. It is a read-only consumer of scene
data and does not participate in scene authoring.

### 1.2 Scope
- **In scope:**
  - Real-time 3D scene rendering from Scene Snapshots (read-only)
  - Camera navigation: orbit, pan, zoom
  - Named camera management: define, save (locally), switch between cameras
  - Lighting configuration: add, remove, adjust ambient, directional, point, and spot lights
  - Viewport display modes: solid shaded, wireframe, rendered preview
  - Environment settings: background color, ambient environment intensity
  - Viewer-local settings persistence (lights, cameras, display mode) as session or project-scoped state
- **Out of scope:**
  - Modifying scene objects or their properties (owned by MFE-3D)
  - Scene authoring, selection, or transform tools
  - File export or rendering to file (owned by MFE-EXPORT)
  - Material authoring (deferred to MFE-MATERIALS)
  - Animation playback

### 1.3 Architectural Context
MFE-VIEWER is a read-only consumer of the Scene Snapshot produced by MFE-3D. It maintains its own
viewer-local state (lights, cameras, display mode) separately from the scene state. It does not
write to MFE-PROJECT or communicate with MFE-2D or MFE-EXPORT.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: 3D Viewer team
- Dependent teams: MFE-3D team (Scene Snapshot producer), MFE-EXPORT team (shares lighting/camera concepts)
- QA/Validation: 3D Viewer QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| Viewer viewport (render canvas) | MFE-VIEWER | |
| Camera navigation controls | MFE-VIEWER | |
| Named camera panel | MFE-VIEWER | Viewer-local; not persisted to scene |
| Lighting panel | MFE-VIEWER | Viewer-local; not persisted to scene |
| Display mode selector | MFE-VIEWER | |
| Environment settings | MFE-VIEWER | |
| Scene Snapshot consumption | MFE-VIEWER | Read-only; produced by MFE-3D |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user evaluates the visual appearance of the 3D scene under different lighting and camera
conditions without leaving the application or interrupting the editing workflow in MFE-3D.

### 3.2 Key Scenarios
1. **Live preview** — User edits an object in MFE-3D; the viewer updates the render automatically.
2. **Lighting setup** — User adds a spot light, adjusts its color and intensity, and repositions it to achieve a desired look.
3. **Camera comparison** — User defines two named cameras (e.g., "Front" and "Top-Angle"), switches between them to compare composition.
4. **Display mode switch** — User toggles from solid shaded to wireframe mode to inspect mesh topology.
5. **Background setup** — User sets a solid background color for the viewer before requesting an export from MFE-EXPORT.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-VIEWER Requirements

#### Scene Rendering
- MFE-VIEWER shall render the current 3D scene in real time using the most recently received Scene Snapshot from MFE-3D.
- MFE-VIEWER shall update its render automatically when a new Scene Snapshot is received without requiring any user action.
- MFE-VIEWER shall display a loading indicator while the initial Scene Snapshot is being received.
- MFE-VIEWER shall display an empty scene state (e.g., "No scene content") when the received Scene Snapshot contains no objects.
- MFE-VIEWER shall render objects using the materials referenced in the Scene Snapshot; when no material is assigned, a default neutral material shall be applied.

#### Camera Navigation
- MFE-VIEWER shall support orbit navigation (rotate the camera around the scene center) via mouse/touch drag.
- MFE-VIEWER shall support pan navigation (translate the camera parallel to the view plane) via middle-mouse drag or modifier+drag.
- MFE-VIEWER shall support zoom (dolly) via scroll wheel or pinch gesture.
- MFE-VIEWER shall allow the user to reset the camera to a default "fit all" position that frames all visible objects.

#### Named Cameras
- MFE-VIEWER shall allow the user to save the current camera position and orientation as a named camera.
- MFE-VIEWER shall display a list of saved named cameras and allow the user to switch between them.
- MFE-VIEWER shall allow the user to rename and delete named cameras.
- Named cameras shall be treated as viewer-local state; they shall not be included in the Scene Snapshot or persisted to the project file unless an explicit open question below is resolved in favor of persistence.
- MFE-VIEWER shall display named cameras defined in the Scene Snapshot (authored in MFE-3D) as read-only entries in the camera list, distinguishable from viewer-local cameras.

#### Lighting Configuration
- MFE-VIEWER shall display the scene's `defaultLights` from the Scene Snapshot as the baseline lighting for the preview render; these lights are authored in MFE-3D and are read-only within MFE-VIEWER.
- MFE-VIEWER shall allow the user to add, remove, and configure local preview lights (ambient, directional, point, and spot) that visually supplement or override the scene's `defaultLights` for preview purposes within MFE-VIEWER only.
- MFE-VIEWER shall allow the user to configure each local preview light's: color, intensity, position (for point and spot), direction (for directional and spot), angle (for spot), and on/off toggle.
- Viewer-local preview lights are not scene objects; they shall not modify the Scene Snapshot, the scene in MFE-3D, or be included in any export render.

#### Display Modes
- MFE-VIEWER shall support the following viewport display modes:
  - **Solid shaded**: objects rendered with surface shading and lighting.
  - **Wireframe**: objects rendered as wireframe edges only.
  - **Rendered preview**: objects rendered with material properties and full lighting (including shadows where supported by the rendering path).
- MFE-VIEWER shall allow the user to switch between display modes at any time without reloading the scene.

#### Environment Settings
- MFE-VIEWER shall allow the user to set the background color of the viewer (solid color or transparent).
- MFE-VIEWER shall allow the user to set an ambient environment intensity multiplier.

### 4.2 Cross-MFE Observable Behaviors
- When MFE-3D publishes an updated Scene Snapshot (e.g., after a user adds an object), MFE-VIEWER shall reflect the update within two seconds without user intervention.
- When MFE-3D is unavailable, MFE-VIEWER shall display its last-received scene (if any) or an empty scene with a user-visible notice ("Scene source unavailable").
- When MFE-VIEWER is unavailable or fails to load, MFE-3D shall not be affected.

---

## 5. Contract Requirements

### 5.1 Scene Snapshot Contract (Consumer)
- **Producer:** MFE-3D
- **Consumed fields:**
  - `schemaVersion`, `objects` (id, name, type, geometryRef, transform, materialRef, visible), `hierarchy`, `cameras`, `defaultLights`
- **Constraints:**
  - MFE-VIEWER shall treat the snapshot as immutable; it shall not attempt to modify any snapshot field.
  - MFE-VIEWER shall validate `schemaVersion` on receipt; unsupported versions shall result in an empty scene display and a visible error notification.
  - MFE-VIEWER shall handle missing or null optional fields (`materialRef`, `defaultLights`) gracefully by applying defaults.
  - MFE-VIEWER shall discard snapshots that arrive out of order if a newer snapshot has already been applied.

### 5.2 Scene Snapshot Request (Consumer → Producer)
- MFE-VIEWER shall be capable of requesting the current Scene Snapshot from MFE-3D on initial load or after recovering from an error state.
- If MFE-3D does not respond to a snapshot request within five seconds, MFE-VIEWER shall display an empty scene with a user-visible timeout notice and offer a "Retry" action.

### 5.3 Notification Contract (Producer)
- MFE-VIEWER shall emit notifications to MFE-SHELL for: Scene Snapshot version mismatch, scene source unavailable, and render errors (e.g., GPU context lost).

### 5.4 Viewer State Contribution (Optional — Open Question)
- If viewer-local light and camera configurations are to be persisted in the project file, MFE-VIEWER shall contribute them to MFE-PROJECT via the State Contribution Contract.
- This behavior is subject to the resolution of the open question regarding viewer state persistence scope.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-VIEWER shall be independently releasable.
- Changes to the Scene Snapshot consumption behavior shall be backward-compatible with the two most recent Scene Snapshot schema versions.

### 6.2 Performance (User-Perceived)
- MFE-VIEWER shall maintain a minimum of 30 frames per second during orbit, pan, and zoom operations for scenes of up to 100,000 triangles on modern consumer hardware.
- MFE-VIEWER shall reflect a Scene Snapshot update (new objects, transforms) within two seconds of receiving the snapshot.
- Switching between display modes shall complete within one second.
- Switching between named cameras shall complete within one second.

### 6.3 Reliability & Resilience
- A GPU context loss (e.g., background tab suspension) shall be recovered automatically where the browser supports it; if recovery fails, MFE-VIEWER shall display a visible error with a "Reload viewer" action.
- A Scene Snapshot with partially invalid geometry references shall render all valid objects; objects with invalid references shall be omitted from the render with a console-level diagnostic.
- MFE-VIEWER shall not crash due to any Scene Snapshot content; unexpected or malformed snapshot fields shall be ignored after a visible notification.

### 6.4 Security & Privacy
- Scene geometry data resolved from `geometryRef` shall not be transmitted outside the browser.
- MFE-VIEWER shall access scene data only through the defined Scene Snapshot Contract.

### 6.5 Accessibility & Compliance
- Camera navigation controls shall have keyboard equivalents (e.g., arrow keys for orbit, +/– for zoom).
- The display mode selector and light controls shall be keyboard-navigable.
- Active display mode and selected camera shall be communicated via accessible state attributes, not color alone.

### 6.6 Observability
- MFE-VIEWER shall display a visible state indicator distinguishing: rendering, loading snapshot, scene source unavailable, and error (GPU or render failure).

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given MFE-3D has a scene with three objects, when MFE-VIEWER loads, then it renders all three objects within two seconds of receiving the initial Scene Snapshot.
- Given the user is orbiting the camera in MFE-VIEWER, when MFE-3D publishes an updated Scene Snapshot (object added), then the new object appears in the viewer within two seconds without interrupting the camera orbit.
- Given the user adds a spot light with red color and medium intensity, then the scene in the viewer immediately reflects the new lighting.
- Given the user saves a named camera "Front View", when the user navigates away and returns, then "Front View" is still listed and restores the camera correctly.
- Given the user switches from solid shaded to wireframe display mode, then the viewport transitions within one second.

### 7.2 Edge Cases
- Given the Scene Snapshot contains zero objects, then MFE-VIEWER displays an empty scene with an informational message and does not display an error.
- Given the user adds 10 viewer-local lights, then MFE-VIEWER renders all of them without crashing (even if performance degrades).
- Given a Scene Snapshot with `schemaVersion` not recognized by MFE-VIEWER, then the viewer displays an empty scene with a version mismatch error and a retry/update prompt; it does not crash.

### 7.3 Failure & Degraded Experience
- Given MFE-3D is unavailable, then MFE-VIEWER shows the last valid render (or an empty scene) with a visible notice: "Scene source unavailable. Retry."
- Given the browser GPU context is lost, then MFE-VIEWER displays "Render context lost. Reloading…" and attempts automatic recovery; if recovery succeeds, the scene is re-rendered; if not, a manual reload action is presented.
- Given MFE-VIEWER fails to load, then MFE-SHELL, MFE-3D, MFE-2D, and MFE-EXPORT continue to operate unaffected.

### 7.4 Compatibility
- Given MFE-VIEWER is running a version that supports Scene Snapshot v1.0, and MFE-3D publishes v1.1 snapshots with additive fields, then MFE-VIEWER processes the snapshot using the v1.0 fields it knows and ignores the additive v1.1 fields without error.

---

## 8. Assumptions
- Viewer-local lights and cameras are session-only state unless the open question on persistence is resolved otherwise.
- The browser's GPU rendering path (WebGL 2 or WebGPU) is available on target hardware; software fallback rendering is not required.
- Named cameras defined in MFE-3D's Scene Snapshot and named cameras saved locally in MFE-VIEWER are distinct entities; they do not merge.

---

## 9. Open Questions
- [ ] Should viewer-local light and camera configurations be persisted in the project file (via MFE-PROJECT) or remain session-only? (owner: Product, due: TBD)
- [ ] Should MFE-VIEWER support an environment HDR/IBL background (image-based lighting), and if so, how is the environment image provided? (owner: Product, due: TBD)
- [ ] Should MFE-VIEWER support shadow rendering in "rendered preview" mode, and what is the expected quality/performance trade-off? (owner: Product/Engineering, due: TBD)
- [ ] Should MFE-VIEWER expose a "Share view" action that generates a permalink or screenshot? (owner: Product, due: TBD)
- [ ] Should the viewer support multiple simultaneous viewports (e.g., front/side/top/perspective quad view)? (owner: Product, due: TBD)
