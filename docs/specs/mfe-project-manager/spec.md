# Spec: MFE-PROJECT — Project Manager

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
Project Manager (MFE-PROJECT). MFE-PROJECT is the sole owner of project lifecycle management: it
controls all file system interactions, project state persistence, autosave, and publishes project
identity to all other MFEs.

### 1.2 Scope
- **In scope:**
  - Project creation, opening, saving (save, save-as), and closing
  - Project file format definition and versioning
  - Autosave to browser-persistent storage
  - Recent projects list
  - File system API interaction and download/upload fallback
  - Project Context publication
  - Dirty-state tracking
- **Out of scope:**
  - Editing any 2D or 3D content (owned by MFE-2D, MFE-3D)
  - Rendering or export (owned by MFE-EXPORT)
  - Panel layout management (owned by MFE-SHELL)
  - Cloud sync or server-side storage

### 1.3 Architectural Context
MFE-PROJECT is the gatekeeper for all file system and browser storage access in the application.
No other MFE may directly access the file system or persistent browser storage. MFE-PROJECT
collects state contributions from MFE-2D and MFE-3D via defined contracts, assembles the complete
project file, and persists or restores it on behalf of the whole application.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: Project/Storage team
- Dependent teams: All MFE teams (consumers of Project Context)
- QA/Validation: Platform QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| Project file format and schema | MFE-PROJECT | |
| File system read/write | MFE-PROJECT | Sole owner; no other MFE may access FS |
| Browser persistent storage (autosave) | MFE-PROJECT | Sole owner |
| Project Context publication | MFE-PROJECT | |
| Dirty-state computation | MFE-PROJECT | Triggered by Dirty-State Signals from MFE-2D and MFE-3D |
| Recent projects list | MFE-PROJECT | Stored in browser persistent storage |
| New/Open/Save/Save As/Close actions | MFE-PROJECT | Dispatched from MFE-SHELL menu |
| Project open/close confirmation dialogs | MFE-PROJECT | Rendered via MFE-SHELL Modal Request Contract |
| Browser unload warning (beforeunload) | MFE-PROJECT | Requests MFE-SHELL to register the handler when dirty; requests deregistration on save or close |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user expects to create, save, and reload projects reliably without losing work, with an
experience that mirrors familiar desktop application patterns (File > New, Open, Save, Save As).

### 3.2 Key Scenarios
1. **New project** — User starts a fresh project, names it, and begins editing.
2. **Save to disk** — User saves the current project to a file; the dirty indicator clears.
3. **Open existing project** — User opens a saved project file; all MFE panels restore to the saved state.
4. **Autosave recovery** — User's browser crashes; on next load, the user is offered the autosaved state.
5. **Save As** — User saves a copy of the project to a new location/filename.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-PROJECT Requirements

#### Project Lifecycle
- MFE-PROJECT shall allow the user to create a new, empty project with a default name.
- MFE-PROJECT shall allow the user to rename the active project before or after saving.
- MFE-PROJECT shall allow the user to open a project file from the local file system via a file picker dialog.
- MFE-PROJECT shall allow the user to save the active project to its current file location.
- MFE-PROJECT shall allow the user to save the active project to a new file location and filename (save as).
- MFE-PROJECT shall detect when the in-memory project state differs from the last saved state (dirty state) and reflect this via the Project Context Contract.
- MFE-PROJECT shall prompt the user to save changes before closing the active project or opening a different one.
- MFE-PROJECT shall allow the user to discard unsaved changes (close without saving) after explicit confirmation.
- When `isDirty` becomes true, MFE-PROJECT shall request MFE-SHELL to register a browser unload warning (`beforeunload`) so the user is prompted if the tab is closed. MFE-PROJECT shall request deregistration when the project is saved or closed.

#### Cold Start / First-Run
- When the application is loaded with no saved project state and no autosave record, MFE-PROJECT shall automatically create and activate a new empty project with a default name (e.g., "Untitled Project").
- The empty project shall be activated silently; no user confirmation shall be required.
- MFE-PROJECT shall publish the Project Context with `isOpen: true` and `isDirty: false` as soon as the empty project is activated.
- MFE-2D and MFE-3D shall receive the Project Context and initialize in their default empty states; no State Restoration payload is sent for a new empty project.
- If an autosave record is detected on load, MFE-PROJECT shall display a recovery prompt before activating any project (see Autosave below).

#### File System & Storage
- MFE-PROJECT shall use the browser's file system API as the primary mechanism for reading and writing project files when that API is available.
- MFE-PROJECT shall fall back to a download/upload workflow (file download on save; file input picker on open) when the file system API is not available.
- MFE-PROJECT shall display a non-blocking notice to the user when operating in download/upload fallback mode.
- MFE-PROJECT shall write project files as a single self-contained file (e.g., a ZIP container) including all scene data, canvas data, and embedded assets.

#### Autosave
- MFE-PROJECT shall autosave the active project's state to browser-persistent storage at a configurable interval (default: 60 seconds).
- Autosave operations shall not block or interrupt the user's active editing session.
- MFE-PROJECT shall offer the user the option to recover an autosaved state if the application is loaded and an unrecovered autosave is detected.
- MFE-PROJECT shall clear the autosave record upon a successful manual save.
- Autosave failures shall be surfaced as a non-blocking warning notification without interrupting editing.

#### Recent Projects
- MFE-PROJECT shall maintain a list of recently opened project files (minimum: 10 entries).
- MFE-PROJECT shall display the recent projects list to the user, allowing one-click reopening.
- MFE-PROJECT shall remove stale entries from the recent list when a file can no longer be accessed.

#### State Collection
- MFE-PROJECT shall collect the current 2D canvas state from MFE-2D via the State Contribution Contract before saving.
- MFE-PROJECT shall collect the current 3D scene state from MFE-3D via the State Contribution Contract before saving.
- MFE-PROJECT shall distribute saved 2D canvas state to MFE-2D and 3D scene state to MFE-3D when opening a project.
- MFE-PROJECT shall handle a non-responsive or unavailable MFE-2D or MFE-3D by saving partial state (the available contributions) and warning the user of the omission.

### 4.2 Cross-MFE Observable Behavior
- When a project is successfully saved, the dirty-state indicator in MFE-SHELL clears within one second.
- When a project is opened, MFE-2D and MFE-3D restore their respective states before their panels become interactive.
- When autosave occurs, no visible freeze or panel interruption shall be observable by the user.

---

## 5. Contract Requirements

### 5.1 Project Context Contract (Producer)
- **Consumers:** MFE-SHELL, MFE-2D, MFE-3D, MFE-VIEWER, MFE-EXPORT
- **Published fields (semantics):**
  - `projectName`: display name of the active project (string)
  - `isDirty`: whether the project has unsaved changes (boolean)
  - `schemaVersion`: version of the project file format in use (string)
  - `isOpen`: whether a project is currently active (boolean)
- **Update triggers:** any state change (open, save, rename, dirty-state change)
- **Compatibility:** Additive changes only; removed fields require deprecation notice.

### 5.2 State Contribution Contract
- **Producers:** MFE-2D (canvas state), MFE-3D (scene state)
- **Consumer:** MFE-PROJECT
- **Trigger:** MFE-PROJECT requests state before a save operation
- **Payload semantics:**
  - `mfeId`: identifier of the contributing MFE
  - `schemaVersion`: version of the contributed state format
  - `payload`: opaque binary or JSON blob representing the MFE's full internal state
- **Constraints:**
  - MFE-PROJECT shall treat payloads as opaque; it shall not interpret or transform their content.
  - Each MFE shall respond within a defined timeout (default: five seconds); non-responsive MFEs yield a partial save with warning.

### 5.3 State Restoration Contract
- **Producer:** MFE-PROJECT (on project open)
- **Consumers:** MFE-2D, MFE-3D
- **Trigger:** User opens a project file
- **Payload semantics:** Same shape as State Contribution (mfeId, schemaVersion, payload)
- **Constraints:**
  - Each content MFE shall validate the `schemaVersion` of its received payload before restoring.
  - If a content MFE cannot restore the received state (version mismatch, corrupt data), it shall report a visible error in its panel without causing MFE-PROJECT to fail.

### 5.4 Project File Format Contract
- **Format:** Single ZIP-based container file (recommended extension: `.3dm`)
- **Contents:**
  - `manifest.json`: project name, schema version, creation and modification timestamps
  - `canvas/canvas-state.<version>.bin` or `.json`: MFE-2D state payload
  - `scene/scene-state.<version>.bin` or `.json`: MFE-3D state payload
  - `assets/`: embedded assets referenced by canvas or scene
- **Versioning:** The manifest `schemaVersion` field is incremented on any breaking change to the container format. Non-breaking additions do not require a version bump.
- **Compatibility:** MFE-PROJECT shall support reading project files from the two most recent major schema versions.

### 5.5 Dirty-State Signal Contract (Consumer)
- **Producers:** MFE-2D, MFE-3D
- **Trigger:** A content MFE emits a signal when its editable state has been modified since the last save
- **Payload semantics:**
  - `mfeId`: identifier of the signaling MFE (`"mfe-2d"` or `"mfe-3d"`)
  - `changedAt`: ISO 8601 timestamp of the change
- **Behavior:**
  - On receipt of a Dirty-State Signal, MFE-PROJECT shall set `isDirty: true` in the Project Context if not already set.
  - MFE-PROJECT shall not request state collection from the signaling MFE on receipt of this signal; state collection occurs only before a save operation.
- **Constraints:**
  - MFE-PROJECT shall process signals from MFE-2D and MFE-3D independently; a signal from one MFE does not suppress signals from the other.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-PROJECT shall be independently releasable.
- Changes to the State Contribution Contract or State Restoration Contract shall maintain backward compatibility for at least one release cycle with explicit migration guidance.

### 6.2 Performance (User-Perceived)
- A Save operation shall complete within three seconds for typical project sizes (scenes up to 100 MB of combined state).
- An Open operation shall deliver restored state to MFE-2D and MFE-3D within five seconds for typical project sizes.
- Autosave shall not cause any user-perceptible latency in editing interactions.

### 6.3 Reliability & Resilience
- MFE-PROJECT shall never overwrite a saved project file with a partial or corrupt state; it shall write to a temporary location and replace atomically (or equivalent browser-safe pattern).
- If a project file cannot be read (corrupt, incompatible version), MFE-PROJECT shall display a descriptive error message and leave the previous project state intact.
- Autosave data shall survive browser tab crashes and be available on next application load.

### 6.4 Security & Privacy
- Project files shall only be read or written in response to explicit user gestures (file picker, save shortcut).
- No project content shall be transmitted outside the browser without explicit user action.
- Autosave data stored in browser-persistent storage shall not be accessible to other origins.

### 6.5 Accessibility & Compliance
- All file picker interactions shall be triggerable via keyboard.
- Confirmation dialogs (close without saving, overwrite) shall be keyboard-navigable with a safe default action (cancel/do not overwrite).

### 6.6 Observability
- MFE-PROJECT shall emit a notification (via MFE-SHELL Notification Contract) for each of the following events: save success, save failure, open success, open failure, autosave success, autosave failure.
- Each notification shall include enough context for the user to understand what happened and what action (if any) is required.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given a new project with 2D and 3D content, when the user triggers Save, then a project file is written to the user's chosen location, the dirty indicator clears, and the user receives a success notification.
- Given a saved project file, when the user opens it, then MFE-2D and MFE-3D restore exactly the state present at the time of the last save.
- Given the application is loaded after a crash, when an autosaved state is detected, then the user is offered a dialog to recover the autosaved state or start fresh.
- Given the browser does not support the file system API, when the user saves, then the project file is downloaded as an attachment, and a notice informs the user of the fallback behavior.

### 7.2 Edge Cases
- Given the user attempts to open a project file with a schema version newer than MFE-PROJECT supports, then MFE-PROJECT displays a descriptive version mismatch error and does not modify the current project state.
- Given MFE-2D does not respond to a state collection request within the timeout, then MFE-PROJECT saves the 3D state only, displays a warning notification naming MFE-2D as the unresponsive contributor, and does not fail silently.

### 7.3 Failure & Degraded Experience
- Given a disk write error occurs during Save (e.g., insufficient storage), then MFE-PROJECT displays a user-visible error with a suggested action (free space, choose new location); the project state in memory remains intact.
- Given the autosave write fails three consecutive times, then MFE-PROJECT surfaces a persistent warning notification requiring user acknowledgment.

### 7.4 Compatibility
- Given a project file saved with schema version N is opened by an MFE-PROJECT that supports version N+1, then the project is migrated in memory on open; the migrated state is not written to disk until the user explicitly saves.

---

## 8. Assumptions
- The browser-persistent storage available for autosave (e.g., IndexedDB) provides at least 50 MB of usable capacity for typical projects.
- The file system API is the preferred path; the download/upload fallback is always required but may offer reduced UX convenience.
- Project files do not exceed 500 MB; behavior with files exceeding this limit is undefined.
- Only one browser tab runs the application at a time; multi-tab project editing is out of scope.

---

## 9. Open Questions
- [ ] What is the maximum supported project file size, and what happens at the limit? (owner: Product, due: TBD)
- [ ] Should the recent projects list persist file handles (file system API) to allow re-opening without a new file picker? (owner: Engineering, due: TBD)
- [ ] Should MFE-PROJECT support project templates (e.g., preset scene or canvas layouts on New Project)? (owner: Product, due: TBD)
- [ ] Is the autosave interval user-configurable, and if so, what is the valid range? (owner: Product, due: TBD)
- [ ] Should project export (GLB, OBJ) be owned by MFE-PROJECT or MFE-EXPORT? (owner: Product/Engineering, due: TBD)
