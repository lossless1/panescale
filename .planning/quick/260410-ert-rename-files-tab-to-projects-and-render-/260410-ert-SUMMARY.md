---
quick_id: 260410-ert
slug: rename-files-tab-to-projects-and-render-
date: 2026-04-10
status: complete
---

# Projects Tab Refactor

## What was built

Renamed the Files tab to **Projects** and moved the project picker out of the header dropdown into the tab itself. Each open project now appears as a collapsible section inside the Projects tab — click the chevron to expand/collapse, and the project's file tree renders nested underneath.

## Files modified

- `src/lib/i18n.ts` — renamed `sidebar.files` → `sidebar.projects` across all 7 locales
- `src/components/sidebar/SidebarTabs.tsx` — `TabId` union now `"projects" | "terminals" | "git"`
- `src/components/sidebar/ProjectFileTree.tsx` (new) — standalone file tree rooted at a given `projectPath`, maintains its own expanded-dirs cache
- `src/components/sidebar/ProjectsList.tsx` (new) — loops over `useProjectStore.projects`, renders each as a collapsible header (chevron + active-dot + name + hover-close) with a nested `ProjectFileTree` when expanded
- `src/components/layout/Sidebar.tsx` — replaced the header project selector dropdown + view-mode toggle with a single `<ProjectsList />` render; dropped unused imports (`FileTree`, `RemoteFileTree`, `ChronologicalFeed`) and unused store selectors (`projects`, `activeProject`, `setActiveProject`, `closeProject`, `viewMode`, `setViewMode`)

## Key decisions

- **Project header click** both toggles expansion AND sets the project as active, so the rest of the app (git panel, SSH file browser) tracks correctly.
- **Expanded-by-default for the active project** on first mount — users see familiar content without an extra click.
- **Remote projects** show a placeholder message inside the expanded section ("Select this project to browse remote files") instead of attempting to reuse the existing `RemoteFileTree` (which is still single-active-project scoped). A future task can lift that into `ProjectFileTree`.
- **View-mode toggle (Tree/Recent) removed** — chronological feed no longer makes sense with multiple nested project trees.
- **Header now has a flex spacer** where the old project dropdown was, keeping the SSH + Open-Folder buttons right-aligned.

## Verification

- `npx tsc --noEmit` passes
