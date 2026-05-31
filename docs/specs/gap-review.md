# SDD Gap Review — Pre-Development Audit
**Date:** 2026-05-31  
**Scope:** All 8 documents in `docs/specs/`  
**Gap review revision:** 2026-05-31 (all BLOCKING and HIGH gaps resolved in specs)  
**Status:** ✅ BLOCKING gaps resolved — development may begin; HIGH gaps resolved; MEDIUM gaps addressed

---

## Summary

| Severity | Count | Status |
|---|---|---|
| 🔴 BLOCKING | 7 | ✅ All resolved in specs |
| 🟡 HIGH | 8 | ✅ All resolved in specs |
| 🟠 MEDIUM | 7 | ✅ Resolved (ME-01 deferred to viewer persistence decision; ME-07 typo fixed) |
| 🔵 LOW | 3 | 🔵 Pending (LO-01: populate owners; LO-02: plan/tasks files; LO-03: verify `.3dm` extension) |

---

## 🔴 BLOCKING — Development Cannot Start

### BL-01 · Export lighting model is undefined
**Files:** `mfe-export/spec.md §4.1`, `mfe-3d-viewer/spec.md §4.1`, `mfe-3d-editor/spec.md §5.2`

MFE-EXPORT's 3D PNG rendering requirement states it shall "apply the scene's default lighting AND
viewer-configured lights if available." However:
- The Scene Snapshot Contract (produced by MFE-3D) contains only `defaultLights`.
- Viewer-local lights (set in MFE-VIEWER) are explicitly not part of the Scene Snapshot.
- No contract exists for viewer-local lights to reach MFE-EXPORT.

**Required action:** Decide and document one of:
- (a) MFE-EXPORT renders with `defaultLights` from Scene Snapshot only (viewer lights are excluded from export).
- (b) A Viewer Lighting Contract is defined that allows MFE-VIEWER to publish its current light set to MFE-EXPORT.
- (c) MFE-3D owns and includes scene lights in the Scene Snapshot; MFE-VIEWER reads them, the user may override in-viewer only.

This decision gates the MFE-3D Scene Snapshot Contract, MFE-VIEWER's requirements, and MFE-EXPORT's rendering requirements simultaneously.

---

### BL-02 · Camera selection in MFE-EXPORT has no defined data path
**Files:** `mfe-export/spec.md §4.1`, `mfe-3d-viewer/spec.md §4.1`, `mfe-3d-editor/spec.md §5.2`

MFE-EXPORT offers camera selection for 3D PNG exports including "cameras defined locally in MFE-VIEWER
(if viewer state sharing is resolved)." Viewer-local cameras are not in the Scene Snapshot. There is
no contract path for viewer cameras to reach MFE-EXPORT.

If viewer cameras are excluded, MFE-EXPORT can only use cameras authored in MFE-3D and present in the
Scene Snapshot — which the user may not have defined.

**Required action:** Decide camera scope for export:
- (a) Export uses only Scene Snapshot cameras (defined in MFE-3D). Document this as the explicit requirement in MFE-EXPORT.
- (b) Define a contract for viewer-local cameras → MFE-EXPORT.
- (c) MFE-EXPORT renders from the viewer's current active camera, accessed via a direct contract with MFE-VIEWER.

---

### BL-03 · Scene lights ownership is contradicted within MFE-3D
**Files:** `mfe-3d-editor/spec.md §1.2 (Out of scope)`, `mfe-3d-editor/spec.md §5.2 (Scene Snapshot)`

MFE-3D scope declares "Real-time preview lighting controls (owned by MFE-VIEWER)" as out of scope.
Yet the Scene Snapshot produced by MFE-3D contains `defaultLights`. The open question
"Are basic scene lights editable within MFE-3D, or only within MFE-VIEWER?" is unresolved.

This contradiction means no team knows who authors the `defaultLights` field in the Scene Snapshot,
making the contract undevelopable.

**Required action:** Resolve the open question and update both MFE-3D and MFE-VIEWER scopes accordingly.

---

### BL-04 · Dirty-state signaling contract is missing
**Files:** `mfe-project-manager/spec.md §4.1`, `mfe-2d-editor/spec.md`, `mfe-3d-editor/spec.md`

MFE-PROJECT "detects when the in-memory project state differs from the last saved state." The State
Contribution Contract is pull-based (MFE-PROJECT requests state only before a save). There is no
defined mechanism for MFE-2D or MFE-3D to notify MFE-PROJECT that their state has changed, which is
required to trigger the dirty indicator in real time.

Without a push-based dirty-state signal, MFE-PROJECT cannot update the dirty indicator in MFE-SHELL
as the user edits — a core UX requirement.

**Required action:** Define a Dirty-State Signal Contract:
- Producer: MFE-2D and MFE-3D (emit on any state change)
- Consumer: MFE-PROJECT
- Payload: `{ mfeId, changedAt: timestamp }`
- Specify debounce behavior (e.g., signal at most once per 500 ms to avoid flooding)

---

### BL-05 · Modal Request Contract is referenced but never specified
**Files:** `mfe-shell/spec.md §4.2`, `mfe-project-manager/spec.md §2.2`

MFE-SHELL §4.2 states: "When a content MFE requests to display a modal dialog, MFE-SHELL shall manage
focus trapping and backdrop presentation." MFE-PROJECT's ownership map says confirmation dialogs
are "Rendered via MFE-SHELL modal contract." This contract has no definition anywhere in the docs.

MFE-PROJECT cannot implement "close without saving" or "overwrite" confirmations without this contract.

**Required action:** Define the Modal Request Contract in `mfe-shell/spec.md §5`:
- Producer: Any content MFE
- Consumer: MFE-SHELL
- Payload: title, message, actions array (label, action identifier, destructive flag), default action
- Behavior: MFE-SHELL renders the modal, manages backdrop/focus, dispatches the chosen action back

---

### BL-06 · MFE readiness signal contract is not specified
**Files:** `mfe-shell/spec.md §4.1`, `mfe-shell/spec.md §5.3 (Shortcut Registration Contract)`

MFE-SHELL §4.1 waits for "critical MFEs to signal readiness" before hiding the loading indicator.
The Shortcut Registration Contract requires registration "after MFE-SHELL signals readiness." Neither
signal's direction, payload, nor the definition of "critical" is contracted.

Development of the initialization sequence is impossible without this.

**Required action:**
1. Define which MFEs are "critical" (must load before the app is usable).
2. Define the Shell Readiness Signal Contract: how MFE-SHELL broadcasts its ready state.
3. Define the MFE Ready Signal Contract: how each content MFE signals readiness back to MFE-SHELL.

---

### BL-07 · First-run / cold-start state is not specified
**Files:** `mfe-project-manager/spec.md §4.1`, `mfe-2d-editor/spec.md §4.1`, `mfe-3d-editor/spec.md §4.1`

No specification defines what happens when the application is opened for the first time with no saved
state, no autosave, and no recent projects. Specific gaps:
- Does MFE-PROJECT auto-create an empty project, or wait for user action?
- Do MFE-2D and MFE-3D initialize in an empty/idle state or block until MFE-PROJECT provides context?
- What is displayed in MFE-SHELL when `isOpen: false` in the Project Context?

MFE-2D and MFE-3D teams cannot implement their initialization logic without this.

**Required action:** Add a "Cold Start" section to `mfe-project-manager/spec.md §4.1` and cross-reference
in MFE-2D and MFE-3D specs. Define the expected observable behavior from the user's perspective on first load.

---

## 🟡 HIGH — Resolve Within First Sprint

### HI-01 · Shape Descriptor acknowledgment return channel is undefined
**Files:** `mfe-2d-editor/spec.md §5.1`, `mfe-3d-editor/spec.md §5.1`

MFE-3D shall "acknowledge receipt (success or error) back to MFE-2D via the contract return channel."
This "return channel" is not specified: it could be a synchronous return value, a separate event, or
a dedicated acknowledgment contract. MFE-2D's display of success/error depends on receiving this.

**Required action:** Specify the acknowledgment mechanism in Shape Descriptor Contract §5.1:
- Define acknowledgment payload: `{ shapeId, status: "accepted" | "rejected", reason?: string }`
- Define whether it is synchronous (return value) or asynchronous (separate signal)
- Define the timeout behavior if MFE-3D does not respond

---

### HI-02 · Communication path between MFE-EXPORT and MFE-2D is architecturally ambiguous
**Files:** `mfe-2d-editor/spec.md §1.3 (Architectural Context)`, `mfe-2d-editor/spec.md §5.3`

MFE-2D §1.3 states: "It does not directly access the file system or communicate with MFE-VIEWER or
MFE-EXPORT." Yet §5.3 defines a Canvas Snapshot Contract where MFE-EXPORT requests a snapshot
directly from MFE-2D.

This is a direct contradiction that will cause an ownership dispute during development.

**Required action:** Choose one resolution:
- (a) The Canvas Snapshot Contract is a direct contract between MFE-2D and MFE-EXPORT (remove the exclusion from §1.3).
- (b) MFE-2D pushes Canvas Snapshots to a shared state/bus that MFE-EXPORT consumes (update MFE-2D §5.3 and MFE-EXPORT §5.1 accordingly).

---

### HI-03 · MFE-2D grouping requirement is in scope but not specified
**Files:** `mfe-2d-editor/spec.md §1.2`, `mfe-2d-editor/spec.md §4.1`

MFE-2D §1.2 includes "grouping" under Shape organization. The functional requirements section
contains no requirement for group/ungroup behavior on the 2D canvas, yet MFE-3D §4.1 includes it.

**Required action:** Add grouping requirements to MFE-2D §4.1:
- User can group two or more selected shapes into a named group.
- User can ungroup a selected group, returning member shapes to the parent layer.
- Groups shall be selectable as a unit; individual shapes within a group shall be selectable in isolation via double-click or equivalent.

---

### HI-04 · 3D Boolean/CSG operations scope exclusion is missing
**Files:** `mfe-3d-editor/spec.md §1.2 (Out of scope)`

MFE-3D's "Out of scope" list does not mention 3D boolean/CSG operations (union, difference,
intersection of meshes). The tech stack document marks these as "must-have for modeling." If they
are intentionally deferred, they must be explicitly excluded to prevent assumption of coverage.

**Required action:** Either:
- (a) Add boolean/CSG operations to MFE-3D §4.1 as functional requirements.
- (b) Explicitly add "Mesh boolean/CSG operations" to MFE-3D §1.2 Out of scope with a note (e.g., "deferred to v2").

---

### HI-05 · Unload / browser tab close ownership is unassigned
**Files:** `3d-studio/spec.md §7.2`, `mfe-project-manager/spec.md`, `mfe-shell/spec.md`

The system acceptance criterion states: "Given the user closes the browser tab with a dirty project,
then the browser's standard unload warning prompts the user." No MFE is assigned ownership of the
`beforeunload` event handler that produces this warning. MFE-PROJECT is the natural owner (dirty
state) but MFE-SHELL manages the global application lifecycle.

**Required action:** Assign ownership in MFE-SHELL §2.2 and MFE-PROJECT §2.2. Add a requirement to
the owning MFE that it shall register a `beforeunload` handler when the project dirty state is true
and deregister it when the project is clean or closed.

---

### HI-06 · Keyboard shortcut arbitration when both MFE-2D and MFE-3D are visible
**Files:** `mfe-shell/spec.md §5.3`, `mfe-2d-editor/spec.md §6.4`, `mfe-3d-editor/spec.md §6.5`

Both MFE-2D and MFE-3D will attempt to register Ctrl+Z (undo) and Ctrl+Y/Ctrl+Shift+Z (redo) as
keyboard shortcuts. The Shortcut Registration Contract rejects conflicting registrations. If the
undo/redo scope is per-MFE, the system will reject one registration, leaving one MFE without
keyboard undo.

**Required action:** Resolve OQ "Is undo/redo per-MFE or unified?" (system spec §9) first, then:
- If per-MFE: specify that Ctrl+Z is dispatched to the MFE that currently holds keyboard focus,
  not via the global shortcut registry.
- If unified: define a Global Undo/Redo Contract owned by MFE-SHELL that routes undo to the
  appropriate MFE based on focus or a unified command stack.

---

### HI-07 · Multi-shape publication behavior is unspecified
**Files:** `mfe-2d-editor/spec.md §5.1`, `3d-studio/spec.md §5.2`

The Shape Descriptor contract defines fields for a single shape (`shapeId`, `paths`, `boundingBox`,
`transform`). The user can "select one or more closed shapes and publish them" (MFE-2D §4.1).

If multiple shapes are selected, it is unclear whether:
- A single descriptor describes all selected shapes (combined compound path), or
- One descriptor per shape is sent (multiple sequential publications)

Each option has different behavior for MFE-3D's import panel and undo granularity.

**Required action:** Define multi-shape publication behavior in Shape Descriptor Contract. If one
descriptor per shape: specify whether they are sent in batch or sequentially.

---

### HI-08 · Initialization order dependencies are not specified
**Files:** `mfe-shell/spec.md`, `mfe-project-manager/spec.md`, `mfe-2d-editor/spec.md`, `mfe-3d-editor/spec.md`

MFE-PROJECT must be initialized before MFE-2D and MFE-3D can receive state restoration. MFE-SHELL
must mount before any MFE panel can render. These dependency ordering requirements exist but are
not specified as requirements in any document, creating a risk of incorrect initialization behavior.

**Required action:** Add an initialization ordering section to `mfe-shell/spec.md §4.1`:
- Define the required initialization sequence observable behavior (not implementation).
- Specify which MFEs are gated behind which predecessors from the user's perspective.

---

## 🟠 MEDIUM — Resolve Before Affected MFE Ships

### ME-01 · MFE-VIEWER persistence: MFE-PROJECT state collection is incomplete if "yes"
**Files:** `mfe-project-manager/spec.md §4.1 (State Collection)`, `mfe-3d-viewer/spec.md §5.4`

MFE-PROJECT's State Collection section lists only MFE-2D and MFE-3D as contributors. If the
viewer persistence open question is resolved as "yes," MFE-PROJECT must also collect from MFE-VIEWER.
The current spec does not account for this case, creating a gap in the project save coverage.

**Required action:** After resolving the persistence open question, update MFE-PROJECT §4.1 State
Collection to include or explicitly exclude MFE-VIEWER as a contributor.

---

### ME-02 · Performance thresholds are inconsistent between system spec and MFE-EXPORT spec
**Files:** `3d-studio/spec.md §6.2`, `mfe-export/spec.md §6.2`

System spec §6.2: "Export operations shall complete within ten seconds for typical scene/canvas sizes
(up to 4K resolution output)."
MFE-EXPORT spec §6.2: "Standard resolutions (up to 1920×1080) shall complete within five seconds."

For 4K resolution, the system spec says 10 seconds, but MFE-EXPORT places that between the 5s
standard threshold and the 30s maximum (8K). There is no explicit threshold for 4K in MFE-EXPORT.

**Required action:** Add a 4K (3840×2160) performance threshold to MFE-EXPORT §6.2 and align with
or replace the system spec §6.2 figure.

---

### ME-03 · MFE-EXPORT thumbnail preview mechanism is unspecified
**Files:** `mfe-export/spec.md §4.1`

MFE-EXPORT shall display a "live thumbnail preview of the selected source before the user commits."
Neither the data source for this thumbnail nor its delivery mechanism is specified. For 2D content,
this implies an on-demand Canvas Snapshot render; for 3D content, an on-demand low-resolution Scene
Snapshot render. The performance expectation for this preview is also not stated.

**Required action:** Specify thumbnail preview behavior:
- Source for 2D preview (Canvas Snapshot at reduced resolution or scale)
- Source for 3D preview (Scene Snapshot rendered at thumbnail resolution)
- Maximum acceptable delay for thumbnail to appear after source selection
- Behavior when source is unavailable (placeholder image)

---

### ME-04 · MFE-SHELL Settings panel scope is not specified
**Files:** `mfe-shell/spec.md §4.1`

MFE-SHELL shall provide a Settings panel where the user can configure "application-level preferences
(e.g., theme, autosave interval)." Neither the list of configurable settings nor the persistence
mechanism (where settings are stored) is specified. Autosave interval is owned by MFE-PROJECT, yet
it is surfaced in a MFE-SHELL-owned panel — the write path is undefined.

**Required action:** Add a Settings Contract specifying:
- Which MFE owns each setting (e.g., autosave interval → MFE-PROJECT, theme → MFE-SHELL)
- How MFE-SHELL writes setting changes back to the owning MFE
- Where the settings are persisted (browser storage via MFE-PROJECT? MFE-SHELL-owned storage?)

---

### ME-05 · Mobile / touch performance is not addressed
**Files:** `mfe-3d-viewer/spec.md §6.2`, `mfe-3d-editor/spec.md §6.2`, `3d-studio/spec.md §8`

The system assumption states the application targets "modern, evergreen browsers." Mobile browsers
are modern and evergreen, but the touch-specific input (pinch-to-zoom, touch drag) specified for
MFE-VIEWER has no corresponding performance threshold or minimum hardware baseline for mobile.

**Required action:** Either:
- (a) Add an assumption to `constitution.md` that mobile devices are out of scope (desktop browser only).
- (b) Add mobile performance NFRs to MFE-VIEWER §6.2 and MFE-3D §6.2.

---

### ME-06 · Acceptance criteria for keyboard-based 3D transform are missing
**Files:** `mfe-3d-editor/spec.md §6.5`, `mfe-3d-editor/spec.md §7`

MFE-3D §6.5 requires keyboard equivalents for transform gizmos, but §7 (Acceptance Criteria) has no
test criterion validating this behavior. Per the constitution's Definition of Done, requirements
must be unambiguous and testable.

**Required action:** Add to MFE-3D §7.1 or §7.2:
- "Given an object is selected, when the user presses the configured nudge key (e.g., arrow keys),
  then the object moves by one nudge increment on the expected axis."
- "Given an object is selected, when the user presses the rotate-by-increment shortcut, then the
  object rotates by the configured angle increment around the active axis."

---

### ME-07 · Notification Contract has a typo rendering it ambiguous
**Files:** `mfe-shell/spec.md §5.4`

The field `autoDissmissMs` contains a double 's' in "Dismiss." Because contract field names are
used as exact identifiers in implementations, this typo will cause integration issues between MFEs
that implement different spellings.

**Required action:** Correct to `autoDismissMs` in MFE-SHELL §5.4 and verify no other document
references the misspelled form.

---

## 🔵 LOW — May Resolve During Development

### LO-01 · Stakeholder ownership fields are all TBD
**Files:** All MFE specs §2.1

All Product owner and Engineering owner fields are marked "TBD." The constitution's Definition of
Done requires "Ownership is clear for every behavior." While team names may genuinely be unassigned
this early, at minimum the owning team role should be named.

**Required action:** Before each MFE's development sprint begins, populate §2.1 with team names.

---

### LO-02 · plan.md and tasks.md files do not yet exist
**Files:** `docs/specs/*/`

Per the constitution Spec Workflow, `plan.md` and `tasks.md` follow `spec.md`. All six MFE
directories contain only `spec.md`.

**Required action:** Create `plan.md` for each MFE before development sprint planning, and
`tasks.md` before task assignment. This is expected at this stage and is not a blocker.

---

### LO-03 · MFE-PROJECT file format extension conflict risk
**Files:** `mfe-project-manager/spec.md §5.4`

The project file uses extension `.3dm`, which is already in use by the Rhinoceros 3D proprietary
file format. Users attempting to open project files with Rhino (or any tool that registers `.3dm`)
may experience confusion.

**Required action:** Verify the extension choice is intentional and document the rationale, or
change to a less conflicting extension (e.g., `.3dstudio`, `.3dsp`).

---

## Contract Integrity Matrix

Cross-check of every contract: is it defined on both the producer and consumer side?

| Contract | Defined by Producer | Defined by Consumer | Status |
|---|---|---|---|
| Project Context | MFE-PROJECT §5.1 ✅ | MFE-SHELL §5.1, MFE-2D (implicit), MFE-3D (implicit) | ⚠️ Only MFE-SHELL explicitly consumes; MFE-2D and MFE-3D have no contract section for it |
| Shape Descriptor | MFE-2D §5.1 ✅ | MFE-3D §5.1 ✅ | ✅ Consistent |
| Shape Descriptor Acknowledgment | MFE-3D §5.1 (mentioned) | MFE-2D §4.2 (mentioned) | 🔴 Not formally specified — see HI-01 |
| Scene Snapshot | MFE-3D §5.2 ✅ | MFE-VIEWER §5.1 ✅, MFE-EXPORT §5.2 ✅ | ✅ Consistent |
| Canvas Snapshot | MFE-2D §5.3 ✅ | MFE-EXPORT §5.1 ✅ | ⚠️ Communication direction contradicts MFE-2D §1.3 — see HI-02 |
| State Contribution | MFE-PROJECT §5.2 ✅ | MFE-2D §5.2 ✅, MFE-3D §5.3 ✅ | ✅ Consistent |
| State Restoration | MFE-PROJECT §5.3 ✅ | MFE-2D (referenced) ✅, MFE-3D (referenced) ✅ | ✅ Consistent |
| Dirty-State Signal | Not defined | Not defined | 🔴 Missing — see BL-04 |
| Modal Request | Referenced in SHELL §4.2 | MFE-PROJECT §2.2 | 🔴 Not specified — see BL-05 |
| Menu Contribution | MFE-SHELL §5.2 ✅ | MFE-2D §5.4 (consumer) ✅ | ✅ Consistent |
| Shortcut Registration | MFE-SHELL §5.3 ✅ | Producers: any MFE (implicit) | ⚠️ No explicit consumer section in any content MFE spec |
| Notification | MFE-SHELL §5.4 ✅ | All MFEs (producers) — MFE-PROJECT §6.6, MFE-EXPORT §5.4 ✅ | ✅ Reasonably consistent |
| Export Trigger | MFE-SHELL §5.4 (system) ✅ | MFE-EXPORT §5.3 ✅ | ✅ Consistent |
| Shell Readiness Signal | Not defined | Not defined | 🔴 Missing — see BL-06 |
| Viewer Lighting → Export | Not defined | Not defined | 🔴 Missing — see BL-01 |
| Viewer Cameras → Export | Not defined | Not defined | 🔴 Missing — see BL-02 |
| MFE-MATERIALS stub | MFE-3D §5.4 (stub) ✅ | System §5.5.1 ✅ | ✅ Consistent |
| MFE-TEXTURES stub | System §5.5.2 (stub) ✅ | — | ✅ Acceptable as stub |

---

## Open Questions Requiring Immediate Product Decision

The following open questions from the specs are prerequisite to resolving BLOCKING items above.
They are listed here with their cross-reference to the blocking gap:

| OQ | Source | Blocks |
|---|---|---|
| Is undo/redo per-MFE or unified? | system §9, 3D §9 | HI-06 |
| Are scene lights editable in MFE-3D or only MFE-VIEWER? | 3D §9 | BL-01, BL-03 |
| Should viewer lights be available in 3D exports? | export §9, viewer §9 | BL-01 |
| Should viewer cameras be available in 3D exports? | export §9 | BL-02 |
| Should viewer state be persisted in the project file? | viewer §9, system §9 | ME-01 |
| What is the first-run / cold-start experience? | (implied, no OQ) | BL-07 |
| Should 3D export formats (GLB/OBJ) be in scope, and for which MFE? | export §9, project §9 | scope clarification |

---

## Recommended Immediate Actions (Ordered)

1. **Hold a Product + Engineering alignment session** to resolve the 7 open questions above.
2. **Resolve BL-03 first** (lights ownership) — it unblocks BL-01, which unblocks MFE-EXPORT entirely.
3. **Resolve BL-06** (readiness signal) — it unblocks all MFE initialization work.
4. **Resolve BL-07** (cold start) — it unblocks MFE-PROJECT, MFE-2D, and MFE-3D initialization paths.
5. **Define BL-05** (Modal Contract) — it unblocks MFE-PROJECT's dialog behavior.
6. **Define BL-04** (Dirty-State Signal) — it unblocks the real-time dirty indicator across all MFEs.
7. **Fix ME-07** (typo in Notification Contract) — zero-cost, high-impact, fix before any team reads it.
8. After the above: address HI items before first implementation sprint ends.
