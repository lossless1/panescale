---
phase: quick-260410-dzc
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ipc.ts
  - src/lib/persistence.ts
  - src/stores/workspacesStore.ts
  - src/stores/canvasStore.ts
  - src/components/layout/Sidebar.tsx
  - src/App.tsx
autonomous: false
requirements:
  - QUICK-260410-DZC
must_haves:
  truths:
    - "User sees a workspaces dropdown in the sidebar header (next to project selector / near traffic lights area)"
    - "User can create a new workspace via the dropdown; the canvas clears to an empty state (no nodes, default viewport)"
    - "User can switch between workspaces via the dropdown; each workspace preserves its own nodes, viewport, maxZIndex, and pileOrder independently"
    - "Switching workspaces saves the current workspace's canvas state, then loads the target workspace's canvas state"
    - "Workspaces and the active workspace selection persist across app restarts (re-launching the app restores the last active workspace and all workspace states)"
    - "Existing canvas-state.json is migrated on first launch into a default workspace (no data loss for existing users)"
  artifacts:
    - path: "src/stores/workspacesStore.ts"
      provides: "Zustand store managing workspace list, active workspace id, create/switch/rename/delete operations"
      exports: ["useWorkspacesStore"]
    - path: "src/lib/persistence.ts"
      provides: "Workspace-scoped save/load: writes current canvas snapshot into the active workspace slot inside a top-level WorkspacesFile structure"
    - path: "src/lib/ipc.ts"
      provides: "WorkspacesFile type (version, activeWorkspaceId, workspaces map) wrapping CanvasSnapshot"
    - path: "src/components/layout/Sidebar.tsx"
      provides: "WorkspacesDropdown rendered in sidebar header, matching existing project selector dropdown styling"
  key_links:
    - from: "src/components/layout/Sidebar.tsx (dropdown)"
      to: "useWorkspacesStore.switchWorkspace / createWorkspace"
      via: "onClick handlers"
      pattern: "switchWorkspace|createWorkspace"
    - from: "src/stores/workspacesStore.ts"
      to: "canvasStore (set nodes/viewport/maxZIndex/pileOrder) + forceSave"
      via: "switchWorkspace saves current then loads target via stateSave/stateLoad against WorkspacesFile"
      pattern: "useCanvasStore\\.setState|forceSave"
    - from: "src/App.tsx hydration"
      to: "useWorkspacesStore.hydrate() before canvasStore.loadFromDisk() (or integrated inside)"
      via: "loadFromDisk reads WorkspacesFile, picks activeWorkspaceId snapshot"
      pattern: "loadFromDisk|hydrate"
---

<objective>
Add a workspaces feature to Panescale. Each workspace is an independent canvas (nodes, viewport, maxZIndex, pileOrder). Users create and switch workspaces from a dropdown in the sidebar header. All workspace states + the active workspace id persist across restarts via the existing `canvas-state.json` file (wrapped in a new top-level `WorkspacesFile` structure with an automatic migration path for existing users).

Purpose: Let users keep multiple separate canvas layouts (e.g., one per project context) without clobbering state.
Output: Workspaces dropdown UI + workspaces store + workspace-scoped persistence + migration from legacy single-canvas format.
</objective>

<context>
@.planning/STATE.md
@src/stores/canvasStore.ts
@src/lib/persistence.ts
@src/lib/ipc.ts
@src/components/layout/Sidebar.tsx
@src/App.tsx
@src-tauri/src/state/persistence.rs

<interfaces>
<!-- Current persisted shape (src/lib/ipc.ts) -->
```typescript
export interface CanvasSnapshot {
  nodes: SerializedNode[];
  viewport: { x: number; y: number; zoom: number };
  maxZIndex: number;
}
export async function stateSave(snapshot: CanvasSnapshot): Promise<void>;
export async function stateLoad(): Promise<CanvasSnapshot | null>;
```

<!-- New wrapper to introduce -->
```typescript
export interface Workspace {
  id: string;           // crypto.randomUUID()
  name: string;         // user-facing label, e.g. "Workspace 1"
  snapshot: CanvasSnapshot;
  pileOrder: string[];  // moved into per-workspace state
  createdAt: number;
}
export interface WorkspacesFile {
  version: 2;
  activeWorkspaceId: string;
  workspaces: Workspace[];
}
```

<!-- canvasStore fields that belong to a workspace snapshot -->
nodes, viewport, maxZIndex, pileOrder
</interfaces>

<!-- Rust backend (src-tauri/src/state/persistence.rs) is format-agnostic: it stores a single
     JSON string at ~/.../excalicode/canvas-state.json. No Rust changes required — the WRAPPER
     is entirely a frontend concern. -->

<!-- Existing sidebar dropdown pattern to mirror for styling/UX consistency:
     Sidebar.tsx lines 249-408 (project selector with showProjects state, outside-click close,
     absolute-positioned dropdown with var(--bg-primary) / var(--border) / 8px radius, list items
     with active dot, divider, and a "+ Open Folder" action at the bottom). -->
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Add WorkspacesFile type + workspace-scoped persistence with legacy migration</name>
  <files>
    src/lib/ipc.ts,
    src/lib/persistence.ts,
    src/stores/workspacesStore.ts,
    src/stores/canvasStore.ts
  </files>
  <action>
    1. In `src/lib/ipc.ts`, add new exported types BELOW the existing `CanvasSnapshot`:
       ```typescript
       export interface Workspace {
         id: string;
         name: string;
         snapshot: CanvasSnapshot;
         pileOrder: string[];
         createdAt: number;
       }
       export interface WorkspacesFile {
         version: 2;
         activeWorkspaceId: string;
         workspaces: Workspace[];
       }
       ```
       Do NOT change the signatures of `stateSave(snapshot)` / `stateLoad()`. They remain
       the low-level Rust bridge. We will reinterpret the JSON string they carry.

       Add two new helpers in `src/lib/ipc.ts`:
       ```typescript
       export async function workspacesFileSave(file: WorkspacesFile): Promise<void> {
         return invoke("state_save", { canvas: JSON.stringify(file) });
       }
       export async function workspacesFileLoad(): Promise<WorkspacesFile | null> {
         const raw = await invoke<string | null>("state_load");
         if (!raw) return null;
         try { return JSON.parse(raw) as WorkspacesFile; } catch { return null; }
       }
       ```

    2. Create `src/stores/workspacesStore.ts` (new file) — a Zustand store with NO persist
       middleware (it owns the canvas-state.json file directly via workspacesFileSave/Load):
       ```typescript
       import { create } from "zustand";
       import { workspacesFileSave, workspacesFileLoad, type Workspace, type WorkspacesFile, type CanvasSnapshot } from "../lib/ipc";
       import { useCanvasStore } from "./canvasStore";
       import { serializeCanvas, deserializeCanvas } from "../lib/persistence";

       interface WorkspacesState {
         workspaces: Workspace[];
         activeWorkspaceId: string | null;
         hydrated: boolean;
         hydrate: () => Promise<void>;
         createWorkspace: (name?: string) => Promise<void>;
         switchWorkspace: (id: string) => Promise<void>;
         renameWorkspace: (id: string, name: string) => Promise<void>;
         deleteWorkspace: (id: string) => Promise<void>;
         persistActiveSnapshot: () => Promise<void>; // called by persistence layer on every auto-save
       }
       ```
       Implementation rules:
       - `hydrate()`: calls `workspacesFileLoad()`.
         * If `file?.version === 2`: set workspaces + activeWorkspaceId; find active workspace
           and populate canvasStore via `useCanvasStore.setState({ nodes, viewport, maxZIndex, pileOrder, hydrated: true })` using `deserializeCanvas(active.snapshot)`.
         * If `file` is null: create a fresh default workspace `{ id, name: "Workspace 1", snapshot: empty, pileOrder: [], createdAt: Date.now() }`, save it, mark canvasStore hydrated with empty nodes.
         * MIGRATION: If `file` is non-null but has no `version` field (legacy shape = CanvasSnapshot),
           wrap it: `{ version: 2, activeWorkspaceId: newId, workspaces: [{ id: newId, name: "Workspace 1", snapshot: file, pileOrder: [], createdAt: Date.now() }] }`, save it, then hydrate canvasStore from that snapshot. Log `[workspaces] migrated legacy canvas-state.json`.
       - `createWorkspace(name?)`: first `await get().persistActiveSnapshot()` to save current, then build a new empty workspace, set it active, save file, and reset canvasStore to empty via `useCanvasStore.setState({ nodes: [], viewport: { x: 0, y: 0, zoom: 1 }, maxZIndex: 0, pileOrder: [], bellActiveNodes: new Map() })`. Name defaults to `Workspace ${workspaces.length + 1}`.
       - `switchWorkspace(id)`: if `id === activeWorkspaceId` return. First `await get().persistActiveSnapshot()`. Then find target workspace, deserialize its snapshot, and `useCanvasStore.setState({ nodes, viewport, maxZIndex, pileOrder, bellActiveNodes: new Map() })`. Update activeWorkspaceId and save file.
       - `renameWorkspace(id, name)`: update in array, save file.
       - `deleteWorkspace(id)`: refuse if `workspaces.length <= 1`. If deleting active, switch to the first remaining workspace first. Then remove and save file.
       - `persistActiveSnapshot()`: read current `useCanvasStore.getState()`, serialize via `serializeCanvas(state)`, update the matching workspace's `snapshot` and `pileOrder` (state.pileOrder) in the workspaces array, and call `workspacesFileSave(...)`.

       Export `useWorkspacesStore`.

    3. Modify `src/lib/persistence.ts`:
       - `forceSave()` and the debounced `initPersistence()` subscriber must now write via the
         workspaces store, NOT call `stateSave(snapshot)` directly. Change both to call
         `useWorkspacesStore.getState().persistActiveSnapshot()`. (Import `useWorkspacesStore`.)
       - Keep `serializeCanvas` / `deserializeCanvas` exported unchanged — workspacesStore uses them.
       - If `useWorkspacesStore.getState().activeWorkspaceId` is null (not hydrated yet), skip the save (return resolved promise) to avoid racing hydration.

    4. Modify `src/stores/canvasStore.ts`:
       - Replace the body of `loadFromDisk` with a single line that delegates to workspaces:
         `await useWorkspacesStore.getState().hydrate();`
         (Import `useWorkspacesStore` at the top with a dynamic import OR a top-of-file import — prefer top-of-file; there is no circular hazard because workspacesStore only imports canvasStore lazily via `useCanvasStore.setState` which is a static method reference.)
         Inside hydrate, workspacesStore is responsible for calling `useCanvasStore.setState({ ..., hydrated: true })`.
       - Leave every other action untouched. `forceSave()` calls in existing actions continue
         working — they now route through persistActiveSnapshot automatically.

    Avoid: do NOT persist `bellActiveNodes`, `snapLines`, or `panToNodeId` — those are transient
    and already excluded from `serializeCanvas`. When switching workspaces, explicitly reset
    `bellActiveNodes` to `new Map()` so bells from the previous workspace don't bleed over.

    Avoid: do NOT touch `src-tauri/src/state/persistence.rs` — the Rust side stays format-agnostic.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
    Also run: `npm run lint` if a lint script exists, and manually confirm `workspacesFileLoad`
    returns `null` on a fresh install path (handled by `file === null` branch).
  </verify>
  <done>
    - `src/lib/ipc.ts` exports `Workspace`, `WorkspacesFile`, `workspacesFileSave`, `workspacesFileLoad`
    - `src/stores/workspacesStore.ts` exists and compiles with all methods listed above
    - `src/lib/persistence.ts`'s `forceSave` and debounced subscriber delegate to `persistActiveSnapshot()`
    - `canvasStore.loadFromDisk` delegates to `useWorkspacesStore.getState().hydrate()`
    - Legacy `canvas-state.json` (no `version` field) is migrated on load into a default workspace
    - `npx tsc --noEmit` passes
  </done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Add WorkspacesDropdown UI to Sidebar header</name>
  <files>
    src/components/layout/Sidebar.tsx
  </files>
  <action>
    Add a new workspaces dropdown BEFORE the existing project selector dropdown in the sidebar
    header (so it sits in the top-left near the traffic lights area). Match the existing
    project-dropdown styling pattern exactly (lines ~249-408 in current Sidebar.tsx) so it feels
    native.

    1. Import at top of file:
       ```typescript
       import { useWorkspacesStore } from "../../stores/workspacesStore";
       ```

    2. Inside the `Sidebar` component, add state + refs near the existing `showProjects` block:
       ```typescript
       const workspaces = useWorkspacesStore((s) => s.workspaces);
       const activeWorkspaceId = useWorkspacesStore((s) => s.activeWorkspaceId);
       const createWorkspace = useWorkspacesStore((s) => s.createWorkspace);
       const switchWorkspace = useWorkspacesStore((s) => s.switchWorkspace);
       const renameWorkspace = useWorkspacesStore((s) => s.renameWorkspace);
       const deleteWorkspace = useWorkspacesStore((s) => s.deleteWorkspace);
       const [showWorkspaces, setShowWorkspaces] = useState(false);
       const workspacesRef = useRef<HTMLDivElement>(null);
       ```

    3. Add an outside-click effect mirroring the `showProjects` one:
       ```typescript
       useEffect(() => {
         if (!showWorkspaces) return;
         const close = (e: MouseEvent) => {
           if (workspacesRef.current && !workspacesRef.current.contains(e.target as Node)) {
             setShowWorkspaces(false);
           }
         };
         document.addEventListener("mousedown", close);
         return () => document.removeEventListener("mousedown", close);
       }, [showWorkspaces]);
       ```

    4. Inside the sidebar header `<div>` (the one with `padding: "8px 8px 8px 16px"` and
       `paddingTop: collapsed ? 8 : 40`), insert the workspaces dropdown as the FIRST child —
       BEFORE the existing project-selector `<div style={{ position: "relative" }} ref={projectsRef}>`.
       Render style: small pill button with a "squares" icon (use 4-square SVG below), current
       workspace name, chevron down. Use the EXACT same background/hover/color/font-size/border
       as the project selector button. Give it `marginRight: 6` and a max-width of ~120px with
       ellipsis for long names.

       Icon SVG (4 squares = "workspaces"):
       ```jsx
       <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, opacity: 0.5 }}>
         <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
         <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
         <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
         <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
       </svg>
       ```

       Dropdown panel (absolute positioned, same styling as project selector dropdown):
       - List each workspace as a button row: active dot (var(--accent) if active), workspace name
         (bold if active), and a trailing "x" close icon (only show if `workspaces.length > 1`)
         that calls `deleteWorkspace(w.id)` on click with `stopPropagation()`. Double-click the
         name to rename via `window.prompt("Rename workspace", w.name)` then `renameWorkspace`.
       - Button onClick: `switchWorkspace(w.id); setShowWorkspaces(false);`
       - Divider (1px, var(--border), margin "4px 8px")
       - "+ New Workspace" action row at the bottom, styled identically to the
         "Open Folder" row in the project dropdown. onClick:
         `await createWorkspace(); setShowWorkspaces(false);`

    5. The active workspace display name on the trigger button: compute
       `const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId);` and show
       `activeWorkspace?.name ?? "Workspace"`.

    Avoid: do NOT use any external icon library — use inline SVGs, matching existing convention.
    Avoid: do NOT place the dropdown inside the project selector — it must be a sibling, rendered
    FIRST so it visually sits closest to the traffic lights area on macOS.
    Avoid: do NOT block the `data-tauri-drag-region` on the header — the buttons already opt out
    naturally because they are interactive children.
  </action>
  <verify>
    <automated>npx tsc --noEmit</automated>
  </verify>
  <done>
    - Sidebar.tsx renders a workspaces dropdown as the first element in the header row
    - Dropdown lists all workspaces, highlights active, allows switch on click, rename on dblclick,
      delete on "x" (when more than 1), and create via "+ New Workspace"
    - Styling matches project selector (background, border, radius, fonts, hover)
    - `npx tsc --noEmit` passes
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 3: Manual verification of workspace create/switch/persist flow</name>
  <what-built>
    Workspaces dropdown in sidebar header + workspace-scoped persistence with legacy migration.
  </what-built>
  <how-to-verify>
    1. Run `npm run tauri dev`.
    2. EXISTING-USER MIGRATION: If you already have a canvas with tiles, confirm the dropdown
       shows "Workspace 1" and your existing tiles are intact.
    3. Add 2-3 terminal nodes to the current workspace. Pan/zoom to a noticeable viewport.
    4. Open the workspaces dropdown (top-left of sidebar). Click "+ New Workspace".
       Expected: canvas is empty, viewport reset, dropdown now shows "Workspace 2" as active.
    5. Add 1 different terminal node to Workspace 2.
    6. Open the dropdown, click "Workspace 1".
       Expected: your 2-3 original nodes + original viewport are restored exactly.
    7. Switch back to "Workspace 2" — confirm its single node + viewport come back.
    8. Double-click a workspace name in the dropdown, rename it, confirm rename persists.
    9. Click the "x" on a non-active workspace — confirm it's deleted. Confirm "x" does NOT
       appear when only one workspace remains.
    10. Quit the app entirely (Cmd+Q) and relaunch.
        Expected: the last-active workspace loads with its full state. Open dropdown — all
        remaining workspaces still present.
    11. Inspect the file at `~/Library/Application Support/excalicode/canvas-state.json` —
        should contain `{ "version": 2, "activeWorkspaceId": "...", "workspaces": [...] }`.
  </how-to-verify>
  <resume-signal>Type "approved" or describe any issues (migration, switching, persistence, UI)</resume-signal>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Manual checkpoint in Task 3 passes for create, switch, rename, delete, and restart persistence
- Legacy users opening the new build see their existing canvas inside a migrated "Workspace 1"
</verification>

<success_criteria>
- Workspaces dropdown present in sidebar header near traffic lights
- Creating a new workspace yields an empty canvas
- Switching preserves per-workspace nodes, viewport, maxZIndex, pileOrder independently
- All workspaces + active workspace id persist across app restart
- No data loss for existing users (legacy canvas-state.json auto-migrates)
</success_criteria>

<output>
After completion, create `.planning/quick/260410-dzc-add-workspaces-dropdown-with-new-workspa/260410-dzc-SUMMARY.md`
</output>
