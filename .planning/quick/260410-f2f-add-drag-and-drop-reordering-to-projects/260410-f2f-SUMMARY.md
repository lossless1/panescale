---
quick_id: 260410-f2f
slug: add-drag-and-drop-reordering-to-projects
date: 2026-04-10
status: complete
---

# Projects List Drag-and-Drop

## What was built

Projects in the sidebar Projects tab can now be reordered by drag-and-drop. Uses the same `@dnd-kit` setup as the terminal piles list for consistency. The new order persists via the existing `panescale-projects` localStorage key.

## Files modified

- `src/stores/projectStore.ts` — new `reorderProjects(fromPath, toPath)` action that splices the projects array and preserves the active-project reference by path
- `src/components/sidebar/ProjectsList.tsx` — extracted `SortableProjectRow` using `useSortable({ id: project.path })`, wrapped the list in `DndContext + SortableContext`, added vertical-only modifier, 5px activation distance

## Key decisions

- **Sort by `project.path`** as the stable id (paths are unique and persistent)
- **5px activation distance** — prevents single clicks (for toggling expansion) from being interpreted as drags
- **Close button stops pointer propagation** so clicking x never starts a drag
- **Vertical-only modifier** matches the pile list behavior

## Verification

- `npx tsc --noEmit` passes
