# Spec: MFE-MATERIALS — Material Designer

## 1. Introduction

### 1.1 Purpose
This specification defines the functional requirements, contracts, and acceptance criteria for the
Material Designer (MFE-MATERIALS). MFE-MATERIALS is the authoritative owner of all material
definitions within the 3D Studio application. It provides tools for creating, editing, and assigning
surface materials to 3D scene objects, and publishes material definitions consumed by MFE-3D,
MFE-VIEWER, and MFE-EXPORT.

### 1.2 Scope
- **In scope:**
  - Material authoring for the following shading models: Diffuse (Lambert) and Specular (Phong / Blinn-Phong)
  - Material property editing: diffuse color, specular color, shininess exponent, and opacity
  - Material library management: create, rename, duplicate, and delete named material definitions
  - Material assignment to scene objects via a request-response interaction with MFE-3D
  - Material definition persistence as part of the active project via MFE-PROJECT
  - Material Reference publication to MFE-3D, MFE-VIEWER, and MFE-EXPORT
- **Out of scope:**
  - Physically-based rendering (PBR) material models (metalness/roughness workflow) — deferred to v2
  - Texture authoring or texture map assignment — owned by MFE-TEXTURES (planned)
  - Volume or subsurface scattering materials — deferred to v2
  - Light baking or pre-computed irradiance — deferred to v2
  - Rendering execution — owned by MFE-EXPORT
  - Scene graph management — owned by MFE-3D

### 1.3 Architectural Context
MFE-MATERIALS is an independently owned, independently releasable microfrontend. It is an optional
dependency for the system: all downstream MFEs (MFE-3D, MFE-VIEWER, MFE-EXPORT) operate with a
default material when MFE-MATERIALS is absent or unavailable. MFE-MATERIALS does not own scene
objects; it authors material definitions and assigns them to objects via the Material Assignment
Contract with MFE-3D. Persistence is delegated to MFE-PROJECT via the State Contribution and
State Restoration Contracts.

---

## 2. Stakeholders & Ownership

### 2.1 Stakeholders
- Product owner: TBD
- Engineering owner: Materials team
- Dependent teams: MFE-3D team (material assignment consumer), MFE-VIEWER team (material rendering), MFE-EXPORT team (material rendering)
- QA/Validation: Materials QA

### 2.2 Ownership Map

| Capability / UI Region | Owner | Notes |
|---|---|---|
| Material library panel | MFE-MATERIALS | Lists all named material definitions in the active project |
| Material property editor | MFE-MATERIALS | Edits shading model and property values for the selected material |
| Shading model selector | MFE-MATERIALS | Selects between Diffuse (Lambert) and Specular (Phong / Blinn-Phong) |
| Diffuse color picker | MFE-MATERIALS | |
| Specular color picker | MFE-MATERIALS | Visible only when shading model is Specular |
| Shininess / glossiness control | MFE-MATERIALS | Visible only when shading model is Specular |
| Opacity control | MFE-MATERIALS | Applies to all shading models |
| Material assignment to object | MFE-MATERIALS | Issued as a request to MFE-3D; MFE-3D applies the assignment |
| Material persistence (save/load) | MFE-MATERIALS | Contributed to / restored from MFE-PROJECT |
| Material Reference publication | MFE-MATERIALS | Consumed by MFE-3D, MFE-VIEWER, MFE-EXPORT |

---

## 3. User Journey / Narrative

### 3.1 Primary User Goal
The user authors named surface material definitions and assigns them to 3D scene objects to control
how those objects appear under lighting, both in the editing viewport and in final exports.

### 3.2 Key Scenarios

1. **Create a diffuse material** — User opens the Material Designer, creates a new material named "Clay", selects the Diffuse (Lambert) shading model, sets the diffuse color to a terracotta hue, and assigns the material to a sphere in the 3D scene. The sphere renders without any specular highlight in the viewer.

2. **Create a specular material** — User creates a new material named "Gloss Plastic", selects the Specular (Blinn-Phong) shading model, configures a white diffuse color, a bright specular highlight color, and a high shininess value (128). Assigns the material to a box. The box displays a sharp, bright specular highlight in the viewer under the scene's directional light.

3. **Adjust shininess** — User selects the existing "Gloss Plastic" material and lowers the shininess value from 128 to 16. The viewer immediately updates to display a broader, softer specular highlight on the assigned object.

4. **Duplicate and modify** — User duplicates the "Gloss Plastic" material, renames the copy "Matte Plastic", switches its shading model to Diffuse (Lambert), and assigns it to a second object.

5. **Assign material to multiple objects** — User selects three objects in MFE-3D, returns to the Material Designer, and assigns the "Clay" material. All three objects update to use the same material reference.

6. **Project save and restore** — User saves the project. On reload, all authored materials and their assignments to scene objects are restored exactly.

---

## 4. Functional Requirements (Boundary-Oriented)

### 4.1 Material Library Management

- MFE-MATERIALS shall maintain a project-scoped library of named material definitions.
- MFE-MATERIALS shall allow the user to create a new material definition. Newly created materials shall use Diffuse (Lambert) as the default shading model with a neutral gray diffuse color.
- MFE-MATERIALS shall allow the user to rename any material definition. Renamed materials shall retain all property values and existing object assignments.
- MFE-MATERIALS shall allow the user to duplicate any material definition. The duplicate shall be an independent copy with a system-generated unique name.
- MFE-MATERIALS shall allow the user to delete a material definition. If the deleted material is currently assigned to one or more objects, those objects shall revert to the default material; MFE-MATERIALS shall display a confirmation prompt identifying the number of affected objects before the deletion is executed.
- MFE-MATERIALS shall display the full list of materials in the active project's library in the material library panel, with each entry showing: material name, shading model type, and a visual preview swatch.
- MFE-MATERIALS shall allow the user to select a material in the library for editing in the material property editor.

### 4.2 Diffuse (Lambert) Material

- MFE-MATERIALS shall support a **Diffuse (Lambert)** shading model.
- The Diffuse (Lambert) model shall expose the following editable properties:

  | Property | Type | Range | Default |
  |---|---|---|---|
  | Diffuse Color | RGB color | [0,0,0] – [255,255,255] | `[204, 204, 204]` (neutral gray) |
  | Opacity | Numeric | 0.0 – 1.0 | `1.0` (fully opaque) |

- A material using the Diffuse (Lambert) model shall produce no specular highlight component in any rendering context.
- MFE-MATERIALS shall not expose specular-related properties when the Diffuse (Lambert) model is selected.

### 4.3 Specular (Phong / Blinn-Phong) Material

- MFE-MATERIALS shall support a **Specular** shading model implementing Phong and Blinn-Phong reflectance.
- The Specular model shall expose the following editable properties:

  | Property | Type | Range | Default |
  |---|---|---|---|
  | Diffuse Color | RGB color | [0,0,0] – [255,255,255] | `[204, 204, 204]` (neutral gray) |
  | Specular Color | RGB color | [0,0,0] – [255,255,255] | `[255, 255, 255]` (white) |
  | Shininess (Glossiness Exponent) | Numeric integer | 1 – 256 | `32` |
  | Opacity | Numeric | 0.0 – 1.0 | `1.0` (fully opaque) |

- The Shininess property shall control the width and intensity of the specular highlight: a value of 1 shall produce a wide, soft highlight; a value of 256 shall produce a narrow, sharp highlight.
- Both Phong and Blinn-Phong sub-variants shall use the same property set. The choice of Phong vs. Blinn-Phong reflectance computation is a rendering concern delegated to MFE-VIEWER and MFE-EXPORT; MFE-MATERIALS shall not expose this sub-variant as a user-configurable option.
- MFE-MATERIALS shall display specular color and shininess controls only when the Specular model is selected.

### 4.4 Shading Model Switching

- MFE-MATERIALS shall allow the user to switch the shading model of an existing material between Diffuse (Lambert) and Specular (Phong / Blinn-Phong) at any time.
- When switching from Specular to Diffuse, specular-specific properties (specular color, shininess) shall be discarded from the material definition; the diffuse color and opacity shall be retained.
- When switching from Diffuse to Specular, diffuse color and opacity shall be retained; specular color and shininess shall be initialized to their default values.
- Model switches shall take effect immediately in the material property editor without requiring an explicit save action.

### 4.5 Material Assignment

- MFE-MATERIALS shall allow the user to assign a material definition to one or more 3D scene objects.
- The assignment shall be issued as a Material Assignment Request to MFE-3D. MFE-3D owns the application of assignments to its scene objects.
- MFE-MATERIALS shall display a user-visible confirmation when an assignment has been accepted by MFE-3D and a user-visible error when an assignment has been rejected.
- MFE-MATERIALS shall allow a single material to be assigned to any number of scene objects simultaneously (shared reference, not a copy per object).
- MFE-MATERIALS shall not modify scene object geometry, transforms, or hierarchy. Its scope is limited to material definitions and their associations with object identifiers.

### 4.6 Material Property Live Preview

- When the user modifies any property of a material in the material property editor, MFE-MATERIALS shall publish an updated Material Reference for the affected material. MFE-VIEWER shall reflect the change in the rendering viewport without requiring a separate user action.
- Live preview updates shall be debounced: at most one Material Reference update shall be emitted per 100 ms of continuous property editing activity.

### 4.7 Material Persistence

- MFE-MATERIALS shall contribute its complete material library (all named material definitions and their object assignments) to MFE-PROJECT on request, via the State Contribution Contract.
- MFE-MATERIALS shall restore its material library from the payload provided by MFE-PROJECT on project open, via the State Restoration Contract.
- MFE-MATERIALS shall validate the `schemaVersion` of a restored material library payload; mismatched versions shall result in an empty library and a user-visible error; the rest of the application shall remain functional.

### 4.8 Cross-MFE Observable Behaviors

- When MFE-MATERIALS is unavailable, MFE-3D shall render all objects with the default material; no error shall be surfaced in MFE-3D's panel.
- When a material property is changed, MFE-VIEWER shall update the appearance of all objects that reference that material within the debounce window (see §4.6), without any manual user action.
- When MFE-MATERIALS publishes a Material Reference that a consumer does not recognize, the consumer shall silently apply the default material and shall not error.

---

## 5. Contract Requirements

### 5.1 Material Reference Contract (Producer)

- **Consumers:** MFE-3D, MFE-VIEWER, MFE-EXPORT
- **Trigger:** Material definition created, modified, or deleted; assignment changed
- **Payload semantics per material definition:**

  | Field | Type | Description |
  |---|---|---|
  | `schemaVersion` | String | Contract version identifier |
  | `materialId` | UUID string | Stable unique identifier for this material definition |
  | `name` | String | User-assigned display name |
  | `shadingModel` | Enum | `"lambert"` \| `"phong-blinn"` |
  | `diffuseColor` | `{ r, g, b }` | Normalized floats in range [0.0, 1.0] |
  | `specularColor` | `{ r, g, b }` \| `null` | Present and non-null only when `shadingModel` is `"phong-blinn"` |
  | `shininess` | Integer \| `null` | Range 1–256; present and non-null only when `shadingModel` is `"phong-blinn"` |
  | `opacity` | Float | Range 0.0–1.0; applies to all shading models |

- **Constraints:**
  - Consumers shall treat Material Reference payloads as immutable.
  - Consumers shall fall back to the default material for any `materialId` they cannot resolve.
  - When `shadingModel` is `"lambert"`, consumers shall not apply any specular computation regardless of any specular fields present in the payload.
  - When `shadingModel` is `"phong-blinn"`, consumers shall compute the specular highlight using either the Phong or Blinn-Phong reflectance model; the choice of sub-variant is a consumer rendering concern.

- **Compatibility:** Field additions are strictly additive. Consumers that do not recognize a new field shall ignore it without error. Breaking changes require a `schemaVersion` increment.

### 5.2 Material Assignment Contract (MFE-MATERIALS → MFE-3D)

- **Producer:** MFE-MATERIALS
- **Consumer:** MFE-3D
- **Trigger:** User assigns a material to one or more scene objects from the material library panel
- **Request payload semantics:**
  - `materialId`: UUID of the material to assign
  - `objectIds`: array of one or more scene object UUIDs to which the material shall be applied
- **Response payload semantics:**
  - `accepted`: array of `objectId` values where assignment succeeded
  - `rejected`: array of `{ objectId, reason }` where assignment was refused (e.g., object locked, object no longer exists)
- **Constraint:** MFE-3D shall respond within two seconds. If no response is received within this window, MFE-MATERIALS shall display a timeout error to the user.

### 5.3 State Contribution Contract (Producer for MFE-PROJECT)

- **Consumer:** MFE-PROJECT
- **Trigger:** MFE-PROJECT requests material library state before project save
- **Payload semantics:** Serializable array of all material definitions (full property sets) plus an assignment map: `{ [materialId]: objectId[] }`.
- **Response timeout:** MFE-MATERIALS shall respond within five seconds.

### 5.4 State Restoration Contract (Consumer from MFE-PROJECT)

- **Producer:** MFE-PROJECT
- **Trigger:** Project open — MFE-PROJECT provides previously saved material library state
- **Behavior:**
  - MFE-MATERIALS shall replace its current library with the restored definitions.
  - MFE-MATERIALS shall republish Material References for all restored materials so that MFE-3D, MFE-VIEWER, and MFE-EXPORT reflect the restored appearance.
  - MFE-MATERIALS shall validate `schemaVersion`; mismatched versions shall result in an empty library and a visible error.

---

## 6. Non-Functional Requirements

### 6.1 Independence & Release

- MFE-MATERIALS shall be independently releasable without requiring a synchronized release of any other MFE.
- The system shall remain fully usable when MFE-MATERIALS is absent; all downstream MFEs shall degrade gracefully to default material rendering.

### 6.2 Performance (User-Perceived)

- The material property editor shall reflect property changes (e.g., color picker drag) with no perceptible lag in the UI; the live preview debounce (§4.6) applies only to the outbound Material Reference event, not to the property editor UI.
- Material library operations (create, rename, delete, duplicate) shall complete and reflect in the library panel within 200 ms.

### 6.3 Reliability & Resilience

- Loss of connection to MFE-3D, MFE-VIEWER, or MFE-EXPORT shall not crash or freeze MFE-MATERIALS; it shall display an observable warning and continue to function as a material authoring tool.
- A corrupted or unrecognized material library state payload provided by MFE-PROJECT shall result in an empty library and a user-visible diagnostic message; MFE-MATERIALS shall not crash or affect other MFEs.

### 6.4 Accessibility & Compliance

- All material library actions (create, rename, delete, duplicate, select) shall be keyboard-accessible.
- Color pickers shall not rely solely on color as the mechanism to communicate selected values; numeric or hex value fields shall accompany all color controls.
- All interactive controls in the material property editor shall meet WCAG 2.1 Level AA contrast requirements.

### 6.5 Observability

- MFE-MATERIALS shall emit observable events for: material created, material deleted (with affected object count), material assigned (with target object IDs), assignment rejected (with reason), and Material Reference publication failures.

---

## 7. Acceptance Criteria

### 7.1 Happy Path

- Given the material library is empty, when the user creates a new material, then a material definition named with a system-generated default name appears in the library with the Diffuse (Lambert) shading model and neutral gray diffuse color.
- Given a Diffuse (Lambert) material is selected in the property editor, then no specular color or shininess controls are visible.
- Given a Specular (Phong / Blinn-Phong) material is selected in the property editor, then specular color and shininess controls are visible and editable.
- Given a Specular material with shininess = 128, when the user drags the shininess slider to 16, then the MFE-VIEWER viewport updates within the debounce window to display a visibly broader, softer specular highlight on all objects assigned to that material.
- Given a material is assigned to a scene object, when the project is saved and reopened, then the material definition and its assignment to that object are restored; the object renders with the assigned material in MFE-VIEWER.
- Given the user deletes a material assigned to two scene objects and confirms the deletion prompt, then both objects revert to the default material in MFE-VIEWER and the material no longer appears in the library.

### 7.2 Edge Cases

- Given the user switches a Specular material to Diffuse (Lambert), then the specular color and shininess values are discarded from the definition; the diffuse color and opacity are retained; no specular highlight is visible on assigned objects in MFE-VIEWER.
- Given a material is assigned to an object that has since been deleted from MFE-3D, when the assignment is processed by MFE-3D, then MFE-3D returns a rejection entry for that `objectId` with a descriptive reason; MFE-MATERIALS displays a user-visible error identifying the missing object; the remaining valid assignments proceed.
- Given MFE-VIEWER is unavailable when a material property change is published, then MFE-MATERIALS logs the publication failure as an observable event without displaying an error to the user; it continues to function as a material authoring tool.
- Given a material library payload with an unrecognized `schemaVersion` is received from MFE-PROJECT on project open, then MFE-MATERIALS presents an empty library and a version-mismatch error; MFE-3D, MFE-VIEWER, and MFE-EXPORT render all objects with the default material; no crash occurs.
- Given the shininess slider is set to the minimum value of 1, then MFE-VIEWER renders the assigned object with a maximally wide, diffuse-like specular spread that is visually distinguishable from the Diffuse (Lambert) shading model on the same object under the same lighting.

### 7.3 Failure & Degraded Experience

- Given MFE-MATERIALS fails to load, then MFE-3D, MFE-VIEWER, and MFE-EXPORT render all objects with the default material; no error is surfaced within other MFE panels; the Material Designer panel shows an error state with a retry action.
- Given MFE-3D does not respond to a Material Assignment Request within two seconds, then MFE-MATERIALS displays a timeout error message to the user; no partial assignment is applied.

---

## 8. Assumptions

- The Phong / Blinn-Phong specular model is computed per-fragment in the rendering consumer (MFE-VIEWER, MFE-EXPORT); MFE-MATERIALS is not responsible for the mathematical implementation of any shading model.
- A single material definition may be shared (referenced) by multiple scene objects; each assignment stores a reference to the material by `materialId`, not a copy of the property values.
- The default material applied when no material reference is available shall be visually equivalent to a Diffuse (Lambert) material with neutral gray diffuse color and full opacity. This default is defined by MFE-3D, MFE-VIEWER, and MFE-EXPORT independently; MFE-MATERIALS does not author the default material.
- Opacity values below 1.0 imply transparency; the rendering consumer is responsible for correct transparency sorting and rendering.
- Texture map support (e.g., diffuse texture, specular texture) is a dependency of MFE-TEXTURES (planned); MFE-MATERIALS shall expose texture reference slots as optional fields with null defaults, so that MFE-TEXTURES can populate them in a future release without a contract-breaking change.

---

## 9. Open Questions

- [ ] Should MFE-MATERIALS expose a "preview sphere" or "preview cube" selector in the property editor to allow the user to see the material on different geometry shapes? (owner: Product, due: TBD)
- [ ] Is the shininess range of 1–256 sufficient, or should the upper bound be extended to support very high-gloss materials (e.g., 512 or 1024)? (owner: Product/Engineering, due: TBD)
- [ ] Should material definitions be importable from an external file format (e.g., MTL files from OBJ)? (owner: Product, due: TBD)
- [ ] When the user assigns a material to an object that already has a material assigned, should MFE-MATERIALS prompt for confirmation, or silently replace the existing assignment? (owner: Product, due: TBD)
- [ ] Should MFE-MATERIALS support a "material preset" library (system-provided presets for common surface types) in addition to user-authored materials? (owner: Product, due: TBD)
- [ ] Are opacity values below 1.0 required to trigger a transparent-pass rendering mode in MFE-VIEWER and MFE-EXPORT, or is a fixed rendering order acceptable? (owner: Engineering, due: TBD)
