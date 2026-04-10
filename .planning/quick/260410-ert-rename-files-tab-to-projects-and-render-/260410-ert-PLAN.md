---
phase: quick-260410-ert
plan: 01
type: execute
files_modified:
  - src/lib/i18n.ts
  - src/components/sidebar/SidebarTabs.tsx
  - src/components/sidebar/ProjectFileTree.tsx
  - src/components/sidebar/ProjectsList.tsx
  - src/components/layout/Sidebar.tsx
autonomous: true
---

<objective>
Rename the Files tab to Projects and render ALL open projects as collapsible sections within the tab. Each project shows its name as a header row with a chevron, and expanding it reveals that project's file tree rooted at the project path. Remove the project selector dropdown from the sidebar header — the tab itself is now the project picker.
</objective>

<tasks>

<task>
  <name>Task 1: i18n rename + tab id rename</name>
  <action>
    - In src/lib/i18n.ts, rename "sidebar.files" → "sidebar.projects" across all 7 locales (en/uk/de/fr/es/ja/zh) with localized "Projects" translations.
    - In src/components/sidebar/SidebarTabs.tsx, change TabId type from "files" → "projects" and update the tabKeys entry.
  </action>
  <done>i18n key renamed across all locales; SidebarTabs TabId union uses "projects"</done>
</task>

<task>
  <name>Task 2: ProjectFileTree component</name>
  <action>
    Create src/components/sidebar/ProjectFileTree.tsx — a standalone file tree rooted at a given projectPath prop (with optional baseDepth). Maintains its own expandedDirs/dirContents state. Reuses FileTreeItem + ContextMenu. No longer depends on useProjectStore.activeProject — takes projectPath directly so multiple instances can coexist.
  </action>
  <done>ProjectFileTree component exists and renders a file tree for any given path</done>
</task>

<task>
  <name>Task 3: ProjectsList component</name>
  <action>
    Create src/components/sidebar/ProjectsList.tsx — loops over useProjectStore.projects and renders each as a collapsible section: chevron + active-dot + project name (uppercase, small letter-spacing) + close-x on hover. Clicking the header toggles expansion AND sets the project as active. Expanded projects render ProjectFileTree inside. Empty-state UI shows "No projects open" + "Open Folder" button when projects list is empty.
  </action>
  <done>ProjectsList component exists with collapsible project headers and nested file trees</done>
</task>

<task>
  <name>Task 4: Sidebar integration</name>
  <action>
    - Update src/components/layout/Sidebar.tsx to import ProjectsList instead of FileTree/RemoteFileTree/ChronologicalFeed.
    - Change activeTab state type from "files" to "projects" and default to "projects".
    - Remove the old project selector dropdown (showProjects state, projectsRef, the entire absolute-positioned project dropdown panel, related effects).
    - Remove the Tree/Recent view mode toggle (no longer applicable when projects are nested).
    - Replace the files-tab content block with a single `<ProjectsList />` render.
    - Keep the workspaces dropdown, SSH button, Open Folder button in the header.
    - Drop unused imports: FileTree, RemoteFileTree, ChronologicalFeed. Drop unused store selectors: projects, setActiveProject, closeProject, viewMode, setViewMode.
  </action>
  <done>
    Sidebar renders ProjectsList under the Projects tab; project dropdown removed from header;
    tsc passes.
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Visual: Projects tab shows all open projects as collapsible rows, expanding reveals file tree
- Clicking a project header makes it the active project (affects git panel, etc.)
- Closing a project via the x button removes it from the list
</verification>

<output>
After completion, create .planning/quick/260410-ert-rename-files-tab-to-projects-and-render-/260410-ert-SUMMARY.md
</output>
