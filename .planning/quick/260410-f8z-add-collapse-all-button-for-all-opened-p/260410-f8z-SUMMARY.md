---
quick_id: 260410-f8z
slug: add-collapse-all-button-for-all-opened-p
date: 2026-04-10
status: complete
---

# Collapse/Expand-All Button for Projects

## What was built

Toolbar row at the top of the Projects tab with a single icon button that toggles all project sections between collapsed and expanded.

- **When at least one project is expanded:** the button shows an inward-chevron icon and collapses all projects on click.
- **When all projects are collapsed:** the button shows an outward-chevron icon and expands all projects on click.

## Files modified

- `src/components/sidebar/ProjectsList.tsx` — added a toolbar row above the sortable list and a `handleCollapseOrExpandAll` callback that operates on the existing `expanded` Set state

## Verification

- `npx tsc --noEmit` passes
