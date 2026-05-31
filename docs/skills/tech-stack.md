# Tech Stack Recommendation — Browser‑Only “3D Studio” Web App (3D + 2D Modeling, Local Projects, Import/Export)

## Target outcomes (what this stack optimizes for)
- **Runs 100% in the browser** (no native installer, no server required for core features).
- **Local project save/load** to disk (best UX where supported), with safe fallbacks.
- **Import/Export with the most-used DCC & CAD-adjacent formats** (glTF-first, broad ingestion).
- **2D modeling** (vector + drafting-style), saved as 2D assets and usable as inputs for 3D workflows.
- **High performance** (large meshes, many objects, heavy compute) using Workers + WASM + GPU acceleration.
- **Maintainable product-grade UI** (dockable panels, shortcuts, undo/redo, assets browser).

---

## 1) Core Web App Stack (UI + Build + Types)
### Recommended
- **React + TypeScript**  
  - React for complex editor UI (panels, inspectors, toolbars, dialogs).  
  - TypeScript is essential for correctness across geometry/math/tooling and file formats.
- **Vite** (build tool / dev server)  
  - Fast iteration, excellent WASM + Worker ergonomics, modern bundling.
- **pnpm** (package manager)  
  - Large dependency graphs (3D loaders, wasm libs) stay manageable and fast.

### UI / Styling
Pick one, based on your team preference:
- **Tailwind CSS + Headless UI (or Radix UI)**  
  - Great for “app-like” editor UI and custom components (panels, toolbars, menus).
- **MUI (Material UI)**  
  - Fastest to ship standard UI components; heavier but productive.

### Docking / Layout (critical for “3D Studio” feel)
Choose one:
- **FlexLayout (flexlayout-react)** — modern docking layouts.
- **GoldenLayout** — classic IDE-like docking behavior (battle-tested).

### State & Editor Behaviors (undo/redo, selection, tools)
- **Zustand** (editor state)  
  - Lightweight; excellent for tool state, selection, UI state.
- **Immer** (immutable patches)  
  - Enables robust undo/redo by storing patches/diffs rather than copying large trees.
- **Command pattern / History library** (implementation choice, but keep in mind for undo/redo)
  - In an editor, undo/redo is a first-class requirement; choose tooling that supports patch-based histories.

---

## 2) 3D Rendering & Scene Interaction
### Recommended renderer stack
- **Three.js** (core 3D engine)
  - Best ecosystem for loaders/exporters, community tooling, and wide examples.
- **WebGPU-first when available, WebGL2 fallback**
  - Use WebGPU for modern GPUs; fallback to WebGL2 for compatibility.

### React integration (optional but very productive)
- **@react-three/fiber (R3F)** + **@react-three/drei**
  - R3F simplifies binding scene updates to React UI state.
  - Drei provides helpers (gizmos, controls, environment, etc.).

> If you prefer strict separation between UI and rendering, you can use Three.js directly and keep React only for UI. The stack still stands.

### Interaction essentials (picking, transforms, camera)
- **three-mesh-bvh**  
  - Accelerates raycasting & selection on complex geometry.
- **Gizmo / transform controls**
  - Use Three.js TransformControls or equivalent R3F helpers.
- **Camera controls**
  - Orbit/trackball + FPS/viewport navigation behavior.

---

## 3) Geometry & Modeling (the “editor brain”)
This is where most “3D Studio-like” capability lives. You’ll want both **mesh** and **solid/parametric** options.

### Mesh modeling & processing (must-have)
- **meshoptimizer (meshopt)**  
  - Geometry compression/optimization for fast load and export.
- **Draco** (optional)  
  - Popular compression for glTF pipelines.
- **robust triangulation / tessellation utilities**
  - For converting 2D shapes to triangulated meshes.

### CSG / Boolean operations (must-have for modeling)
Pick one (or both):
- **Manifold (WASM)**
  - High-quality booleans, robust results; good for real modeling tools.
- **BVH-based CSG libraries (Three ecosystem)**
  - Often easier to integrate quickly, but robustness varies.

### CAD-like solids / STEP/IGES (optional, heavy but powerful)
- **OpenCascade via WebAssembly (OCCT / opencascade.js)**
  - Unlocks CAD-style solids, fillets, STEP/IGES import, and precise curves.
  - Adds complexity and bundle size; worth it if CAD import/export is a top requirement.

> Practical advice: ship **mesh modeling first**, add OCCT later if/when CAD interoperability becomes a hard requirement.

---

## 4) Import / Export Formats (3D + 2D)
### The “best default” interchange format
- **glTF 2.0** as your **native** 3D interchange and internal export format  
  - Most modern engines and tools support it well.
  - Works great with PBR materials, animations, and efficient packaging.

### 3D import/export coverage (browser-realistic)
**Import (broad):**
- glTF/GLB (native)
- OBJ
- STL
- PLY
- (Optional) FBX import (commonly requested, but export is problematic in-browser)

**Export (reliable):**
- GLB/glTF (primary)
- OBJ (geometry-only)
- STL (3D printing workflows)
- PLY (scan / point cloud-ish pipelines, depending on use)

**Notes you should factor into stack choice**
- **FBX**: import is feasible via existing JS loaders; **export** is often not realistic/legally clean in pure browser pipelines. Best practice: **convert FBX → glTF internally** and export glTF/GLB instead.
- **USD/USDZ**: possible, but browser tooling is less standardized; treat as “advanced/phase 2”.

### Libraries (Three.js ecosystem)
- Three.js loaders/exporters for: glTF, OBJ, STL, PLY, FBX (import-focused).
- For “many formats” ingestion in-browser:
  - **Assimp compiled to WASM** (Assimp-WASM / assimpjs variants)  
    - Useful as a “universal importer” fallback when native loaders don’t exist.

---

## 5) 2D Modeling Stack (vector + drafting) + 2D→3D workflows
### 2D representation (recommended)
- **SVG** as the primary 2D exchange + editing format  
  - Easy to store, diff, and render; fits browser naturally.

### 2D canvas/editor
Pick one based on your needs:
- **Paper.js** — strong for vector geometry editing workflows.
- **Fabric.js** — great for interactive canvas objects, UI-like editing.
- **Konva.js** — good performance for complex 2D scenes.

### 2D file formats
**Import/Export**
- **SVG** (primary)
- **DXF** (important for many 2D CAD-like flows)  
  - Use a DXF parser + writer library.
- **PDF export** (optional)  
  - For sharing/printing, use a PDF generation library (client-side).

### 2D → 3D usage (what your stack must support)
- **Shape to mesh**: triangulation (fill) + outline stroking for profiles.
- **Extrude / Lathe / Sweep**:
  - Extrusion from 2D paths to solids/meshes.
  - Revolve (lathe) around an axis.
  - Sweep along a path (advanced).

> Your stack should explicitly include a reliable triangulation/tessellation utility to convert SVG/DXF paths into meshes.

---

## 6) Project Files: Save/Load on Local Disk (Browser-Only)
### Best UX (when supported)
- **File System Access API**
  - Enables “Save”, “Save As…”, overwrite, and re-open without re-selecting files repeatedly.

### Universal fallback (works everywhere)
- **Download/upload workflow**
  - Export project as a single file (e.g., `.myproject`), user downloads it.
  - Load via `<input type="file">` or drag & drop.

### Packaging format (recommended)
- **ZIP container** (e.g., via JSZip)
  - Contains:
    - `project.json` (scene graph, tool state, metadata)
    - `assets/…` (textures, imported models, thumbnails)
    - `models/…` (glb + 2d svg/dxf)
- **Binary-first** for heavy geometry
  - Store meshes as GLB, not as huge JSON arrays.

### Local caching (optional but very useful)
- **IndexedDB** (Dexie.js recommended)
  - Autosave snapshots, recovery, versioning.
  - Prevents data loss if a tab crashes.

---

## 7) Performance & Compute Stack (critical for real editors)
### Parallelism
- **Web Workers** for heavy tasks:
  - Import parsing (FBX/OBJ/STEP), triangulation, boolean ops, mesh optimization.
- **Comlink**
  - Clean Worker APIs without manual message boilerplate.

### WASM toolchain
- **Emscripten** (general C/C++ → WASM)  
  - For OpenCascade, mesh processing libs, etc.
- **wasm-pack** (Rust → WASM)  
  - Great for custom geometry kernels, fast math, robust algorithms.

### Optional “pro” performance features
- **SharedArrayBuffer + WASM threads**
  - Requires cross-origin isolation headers (COOP/COEP) — great for heavy kernels.

---

## 8) QA, Testing, and Reliability (editor apps need this early)
- **Vitest** (unit tests for geometry utilities, serialization, state)
- **Playwright** (E2E tests for “import → edit → export → reload” workflows)
- **ESLint + Prettier** (consistency)
- **Sentry** (optional) for runtime error tracking (especially important with WASM + GPU variability)

---

## 9) Recommended “Best” Combined Stack (one-line version)
- **React + TypeScript + Vite + pnpm**
- **Three.js (+ optional @react-three/fiber) with WebGPU→WebGL2 fallback**
- **three-mesh-bvh for picking/selection performance**
- **Manifold (WASM) for robust booleans/CSG**
- **glTF/GLB as the native 3D interchange**
- **Three.js loaders/exporters + Assimp-WASM as a “universal importer” fallback**
- **Paper.js/Fabric.js + SVG (+ DXF) for 2D modeling**
- **ZIP-based project format + File System Access API + IndexedDB autosave**
- **Web Workers + Comlink + WASM toolchain (Emscripten / wasm-pack)**
- **Vitest + Playwright + ESLint/Prettier (+ optional Sentry)**

---

## 10) Format Support Matrix (practical expectation)
### 3D
- ✅ Best first-class: **GLB/glTF**
- ✅ Common: **OBJ, STL, PLY**
- ⚠️ Often requested: **FBX** (import yes; export usually “convert to glTF”)
- ⚠️ Advanced: **STEP/IGES** (best with OCCT-WASM; heavy)
- ⚠️ Advanced: **USD/USDZ** (phase 2)

### 2D
- ✅ Best first-class: **SVG**
- ✅ Common engineering: **DXF**
- ✅ Sharing: **PDF export** (optional)

---

## 11) What makes this stack “best” for your requirements
- It’s **browser-realistic**: everything listed can run client-side without a backend.
- It’s **interoperable**: glTF-first export plus broad import coverage.
- It’s **editor-friendly**: docking UI, undo/redo foundations, selection performance, and robust geometry operations.
- It’s **scalable**: Workers + WASM prevent the UI from freezing as models get heavy.
- It supports a true **2D→3D pipeline**: SVG/DXF → triangulate/extrude/sweep → mesh/solid.

---

### (One optional follow-up, only if you want me to refine this further)
