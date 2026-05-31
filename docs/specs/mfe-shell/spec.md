# Spec: MFE-SHELL — Application Shell

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
Application Shell (MFE-SHELL). MFE-SHELL is the host MFE that composes all other microfrontends
into a coherent, navigable workspace and provides global UX guarantees that no individual content MFE
can fulfill on its own.

### 1.2 Scope
- **In scope:**
  - Workspace layout and panel composition
  - Global navigation (menu bar, toolbar, keyboard shortcut infrastructure)
  - Global project status display
  - Error boundaries and failure isolation per panel
  - Application-level loading and initialization sequence
  - Global accessibility baseline (focus management, skip links)
- **Out of scope:**
  - Any editing functionality (2D, 3D, export)
  - Project file I/O (owned by MFE-PROJECT)
  - Rendering (owned by MFE-VIEWER, MFE-EXPORT)
  - Panel-specific toolbars and tool options (owned by respective content MFEs)

### 1.3 Architectural Context
MFE-SHELL acts as the composition layer. It loads, mounts, and manages the lifecycle of all other
MFEs within a dockable panel workspace. It owns no business domain; its sole responsibility is
global UX coherence, layout, and resilience.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: Shell/Platform team
- Dependent teams: All MFE teams (consumers of shell services)
- QA/Validation: Platform QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| Application frame (outermost chrome) | MFE-SHELL | |
| Panel layout and docking | MFE-SHELL | |
| Menu bar | MFE-SHELL | Content items contributed via contract |
| Global keyboard shortcut registry | MFE-SHELL | MFEs register shortcuts; shell dispatches |
| Project name and dirty-state display | MFE-SHELL | Data sourced from MFE-PROJECT |
| Per-panel error boundary | MFE-SHELL | |
| MFE loading / initialization sequence | MFE-SHELL | |
| Browser unload (beforeunload) handler | MFE-SHELL | Registered/deregistered on behalf of MFE-PROJECT based on dirty state |
| Panel-specific toolbars | Respective content MFE | Shell provides mount points only |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user expects a stable, always-responsive application frame that gives access to all editing
capabilities regardless of the state of any individual tool panel.

### 3.2 Key Scenarios
1. **Application startup** — User opens the application URL; all panels load and become interactive.
2. **Panel rearrangement** — User drags, docks, resizes, or detaches panels to suit their workflow.
3. **Panel failure recovery** — One MFE panel crashes; user sees an error state in that panel and can retry without reloading the entire application.
4. **Global action dispatch** — User triggers a save (keyboard shortcut or menu item); MFE-SHELL routes the action to MFE-PROJECT.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 MFE-SHELL Requirements
- MFE-SHELL shall render a persistent application frame that remains visible and interactive at all times, regardless of individual MFE panel states.
- MFE-SHELL shall provide a dockable panel layout supporting at minimum: split views (horizontal and vertical), tabbed panels, and floating panels.
- MFE-SHELL shall allow the user to resize panels by dragging panel boundaries.
- MFE-SHELL shall persist the user's panel layout across browser sessions (e.g., last-used layout restored on next open).
- MFE-SHELL shall render a menu bar containing global actions (File, Edit, View, Help) and shall allow content MFEs to contribute contextual menu items via the Menu Contribution Contract.
- MFE-SHELL shall maintain a global keyboard shortcut registry; content MFEs may register shortcuts via the Shortcut Registration Contract; conflicting shortcuts shall be reported and the later-registered shortcut shall be rejected with a logged warning.
- MFE-SHELL shall display the active project name and dirty state indicator sourced from MFE-PROJECT via the Project Context Contract; if MFE-PROJECT is unavailable, the indicator shall show "Unknown Project".
- MFE-SHELL shall wrap each MFE panel in an error boundary that catches unhandled errors and renders a user-visible error state with a "Retry" action for the affected panel only.
- MFE-SHELL shall display a global loading indicator during initial application startup until all critical MFEs have signaled readiness.
- MFE-SHELL shall provide a "Settings" panel or dialog where the user can configure application-level preferences (e.g., theme, autosave interval).

#### Initialization Sequence
- MFE-SHELL shall complete its own initialization — mounting panel layout and emitting the Shell Readiness Signal — before any content MFE panel is considered active.
- MFE-SHELL shall gate MFE-2D and MFE-3D panel interactivity behind MFE-PROJECT's MFE Ready Signal; those panels shall display a loading state until MFE-PROJECT signals readiness.
- MFE-SHELL shall display the global loading indicator until all critical MFEs (MFE-PROJECT, MFE-2D, MFE-3D) have signaled readiness or the ten-second timeout has elapsed.
- MFE-VIEWER and MFE-EXPORT panels shall become interactive independently and shall not block the global loading indicator.
- MFE-SHELL shall register a browser `beforeunload` handler when notified by MFE-PROJECT that the project is dirty, and shall deregister it when the project is saved or closed.

### 4.2 Cross-MFE Behavior Observable at Shell Level
- When the user triggers "Save" via the global menu or keyboard shortcut, MFE-SHELL shall route the action to MFE-PROJECT; the dirty-state indicator shall update in response to MFE-PROJECT's acknowledgment.
- When a content MFE requests to display a modal dialog (e.g., confirmation), MFE-SHELL shall manage focus trapping and backdrop presentation.
- When any MFE publishes a notification (error, warning, success), MFE-SHELL shall display it in a globally consistent notification area using the Notification Contract.

---

## 5. Contract Requirements

### 5.1 Project Context Contract (Consumer)
- MFE-SHELL consumes the Project Context Contract published by MFE-PROJECT.
- MFE-SHELL shall display project name and dirty state reactively; it shall not cache or alter the received values.
- MFE-SHELL shall degrade gracefully (display placeholder text) when no project context is available.

### 5.2 Menu Contribution Contract
- **Producer:** Any content MFE
- **Consumer:** MFE-SHELL
- **Behavior:** A content MFE may register a set of labeled menu items under a declared top-level menu group.
- **Constraints:**
  - Menu items shall include: label, action identifier, optional keyboard shortcut hint, and enabled/disabled state.
  - MFE-SHELL shall de-register contributed items when the contributing MFE unmounts.
  - MFE-SHELL is not responsible for the action logic; it dispatches the action identifier back to the contributing MFE.

### 5.3 Shortcut Registration Contract
- **Producer:** Any content MFE
- **Consumer:** MFE-SHELL
- **Behavior:** A content MFE may register named keyboard shortcuts bound to action identifiers.
- **Constraints:**
  - Shortcut registration must occur after MFE-SHELL signals readiness.
  - Conflicts are rejected; the registering MFE receives a rejection signal.
  - Shortcuts are de-registered when the contributing MFE unmounts.
  - Undo (Ctrl+Z) and Redo (Ctrl+Y / Ctrl+Shift+Z) shall **not** be registered in the global shortcut registry; they shall be dispatched directly to the MFE panel that currently holds keyboard focus.

### 5.4 Notification Contract
- **Producer:** Any MFE
- **Consumer:** MFE-SHELL
- **Payload semantics:**
  - `level`: `"info"` | `"warning"` | `"error"`
  - `message`: human-readable string (max 200 characters)
  - `autoDismissMs`: optional duration in milliseconds; if absent, user must dismiss manually
- **Behavior:** MFE-SHELL renders notifications in a globally consistent notification area (e.g., toast region); it shall stack multiple notifications and dismiss them independently.

### 5.5 Modal Request Contract
- **Producer:** Any content MFE (e.g., MFE-PROJECT for confirmation dialogs)
- **Consumer:** MFE-SHELL
- **Payload semantics:**
  - `title`: brief heading string for the modal dialog
  - `message`: explanatory body text
  - `actions`: ordered array of action objects, each containing:
    - `label`: display text for the action button
    - `actionId`: identifier returned when the user chooses this action
    - `destructive`: boolean — if true, MFE-SHELL shall apply visually distinct destructive styling to the button
  - `defaultAction`: `actionId` of the action to trigger on Enter key or primary keyboard confirmation
- **Behavior:**
  - MFE-SHELL shall render the modal centered over the application frame with a full-viewport backdrop overlay.
  - MFE-SHELL shall trap keyboard focus within the modal until the user selects an action.
  - MFE-SHELL shall return the chosen `actionId` synchronously back to the requesting MFE.
  - Pressing Escape shall trigger the action with `actionId: "cancel"` if present; if no cancel action exists, the modal is dismissed and no action identifier is returned.
  - Only one modal shall be displayed at a time; subsequent requests shall be queued and shown in order after the current modal is dismissed.

### 5.6 Shell Readiness Signal Contract
- **Producer:** MFE-SHELL
- **Consumers:** All content MFEs
- **Trigger:** MFE-SHELL has mounted its panel layout infrastructure and is ready to accept contract registrations (menu contributions, shortcut registrations, modal requests, notifications)
- **Payload semantics:**
  - `timestamp`: ISO 8601 timestamp of readiness
- **Constraints:**
  - MFE-SHELL shall emit this signal exactly once per application load, before any content MFE panel is mounted.
  - Content MFEs shall not attempt to register shortcuts, menu items, or modal requests before receiving this signal.

### 5.7 MFE Ready Signal Contract
- **Producer:** Each content MFE
- **Consumer:** MFE-SHELL
- **Trigger:** The producing MFE has completed its initialization and its panel is interactive
- **Payload semantics:**
  - `mfeId`: identifier of the ready MFE (e.g., `"mfe-project"`, `"mfe-2d"`, `"mfe-3d"`)
  - `timestamp`: ISO 8601 timestamp of readiness
- **Critical MFEs** (the global loading indicator waits for all of these): MFE-PROJECT, MFE-2D, MFE-3D
- **Non-critical MFEs** (loading indicator does not wait): MFE-VIEWER, MFE-EXPORT
- **Constraints:**
  - If a critical MFE has not signaled readiness within ten seconds of MFE-SHELL's Shell Readiness Signal, MFE-SHELL shall display an error state in that MFE's panel, remove it from the loading wait set, and proceed.
  - MFE-SHELL shall hide the global loading indicator once all critical MFEs that have not timed out have signaled readiness.

### 5.8 Settings Contract
- **Producer:** MFE-SHELL (Settings panel owns the UI)
- **Consumers:** Respective setting-owner MFEs
- **Setting ownership:**

  | Setting | Owner MFE | Persistence |
  |---|---|---|
  | Application theme (light / dark) | MFE-SHELL | MFE-SHELL browser storage |
  | Default panel layout | MFE-SHELL | MFE-SHELL browser storage |
  | Autosave interval | MFE-PROJECT | Dispatched to MFE-PROJECT; persisted by MFE-PROJECT |
  | Default canvas units | MFE-2D | Dispatched to MFE-2D; applied on next project create |

- **Constraints:**
  - MFE-SHELL shall not persist settings owned by other MFEs; it dispatches setting changes and each MFE persists its own value.
  - MFE-SHELL's Settings panel shall display the value received from the owning MFE, not a locally cached copy.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release
- MFE-SHELL shall be releasable independently. Changes to MFE-SHELL shall not require synchronized releases of content MFEs provided contracts are maintained.
- Contract changes (Menu Contribution, Shortcut Registration, Notification) shall maintain backward compatibility for at least one minor release cycle.

### 6.2 Performance (User-Perceived)
- MFE-SHELL's own application frame (chrome, menu bar, panel structure) shall be interactive within one second of page load, before content MFEs finish initializing.
- Panel rearrangement interactions (drag, resize) shall be visually smooth with no perceptible lag on modern hardware.

### 6.3 Reliability & Resilience
- A failure in any content MFE panel shall not affect other panels or the application frame.
- MFE-SHELL shall not crash due to an unhandled error in a content MFE. Error boundaries are mandatory for all MFE mount points.
- If the Project Context Contract is unavailable, MFE-SHELL shall display a fallback state and continue operating.

### 6.4 Accessibility & Compliance
- MFE-SHELL shall provide skip navigation links allowing keyboard users to bypass the menu bar and reach the active panel directly.
- Focus shall be managed correctly across panel switches: when the user activates a panel, focus shall move to the panel's primary interactive region.
- The dirty-state indicator shall not rely on color alone; it shall include a textual or symbolic indicator (e.g., an asterisk).
- All MFE-SHELL-owned controls shall meet WCAG 2.1 Level AA.

### 6.5 Observability
- MFE-SHELL shall surface a visible panel-level error state that distinguishes between: MFE failed to load, MFE threw a runtime error, and MFE is loading.
- MFE-SHELL shall emit a global notification when a content MFE enters or recovers from an error state.

---

## 7. Acceptance Criteria

### 7.1 Happy Path
- Given the application URL is loaded, when all MFEs initialize successfully, then the application frame, all panels, and the menu bar are fully interactive within three seconds.
- Given a default panel layout, when the user drags a panel to a new position, then the layout updates immediately and the new arrangement is persisted for the next session.
- Given a dirty project, when the project name is shown in MFE-SHELL, then an asterisk or equivalent indicator appears next to the project name.

### 7.2 Edge Cases
- Given two content MFEs attempt to register the same keyboard shortcut, then the second registration is silently rejected and the first registration remains active.
- Given the panel layout stored in browser state is corrupt, then MFE-SHELL falls back to the default layout and displays a non-blocking notice to the user.

### 7.3 Failure & Degraded Experience
- Given MFE-3D fails to load, then its panel displays an error state with a "Retry" button; all other panels (MFE-2D, MFE-VIEWER, MFE-EXPORT) remain operational.
- Given MFE-PROJECT is unavailable, then MFE-SHELL displays "Unknown Project" in the project status area and the File menu items that require a project context are disabled.
- Given any content MFE throws an uncaught exception, then MFE-SHELL catches it at the error boundary, logs it as an observable error signal, and presents a "Reload panel" action to the user without affecting other panels.

### 7.4 Compatibility
- Given a content MFE registers a menu contribution using an older version of the Menu Contribution Contract, then MFE-SHELL processes the registration without error and applies default values for any missing optional fields.

---

## 8. Assumptions
- Content MFEs expose a defined mount/unmount lifecycle that MFE-SHELL can observe.
- All content MFEs are loaded within the same browser origin; cross-origin panel mounting is out of scope.
- Panel layout persistence uses browser session/local storage; cloud sync of layout is out of scope.

---

## 9. Open Questions
- [ ] Should MFE-SHELL support multiple layout presets (e.g., "2D focused", "3D focused") that the user can switch between? (owner: Product, due: TBD)
- [ ] Which MFE owns the "About" dialog and version information display? (owner: Platform team, due: TBD)
- [ ] Should floating/detached panels support being moved to a second browser window? (owner: Product, due: TBD)
