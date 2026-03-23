---
phase: quick
plan: 260322-hsq
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/ipc.ts
  - src/stores/sshStore.ts
  - src/components/sidebar/SshQuickConnect.tsx
autonomous: true
requirements: []
must_haves:
  truths:
    - "SSH connections section is labeled 'Recent' not 'Saved'"
    - "Most recently used SSH connection appears first in the list"
    - "Existing connections without timestamps appear at the bottom"
  artifacts:
    - path: "src/lib/ipc.ts"
      provides: "SshConnectionConfig with lastUsedAt field"
      contains: "lastUsedAt"
    - path: "src/stores/sshStore.ts"
      provides: "Timestamp update on connection use"
    - path: "src/components/sidebar/SshQuickConnect.tsx"
      provides: "Recent label and sorted display"
  key_links:
    - from: "src/components/sidebar/SshQuickConnect.tsx"
      to: "src/stores/sshStore.ts"
      via: "handleSavedConnectionClick updates lastUsedAt"
---

<objective>
Rename "Saved" label to "Recent" in the SSH Quick Connect dropdown, add a `lastUsedAt` timestamp to connections, and sort by most recently used first.

Purpose: User wants to see their most recent SSH connection at the top of the list.
Output: Updated UI label and sorted connection list.
</objective>

<execution_context>
@/Users/volodymyrsaakian/.claude/get-shit-done/workflows/execute-plan.md
@/Users/volodymyrsaakian/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/lib/ipc.ts
@src/stores/sshStore.ts
@src/components/sidebar/SshQuickConnect.tsx
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add lastUsedAt timestamp and sort connections by recency</name>
  <files>src/lib/ipc.ts, src/stores/sshStore.ts, src/components/sidebar/SshQuickConnect.tsx</files>
  <action>
1. In `src/lib/ipc.ts`, add `lastUsedAt?: number` (epoch ms) to the `SshConnectionConfig` interface (after the `group` field).

2. In `src/stores/sshStore.ts`:
   - In `addConnection`, set `lastUsedAt: Date.now()` on the created connection object (line ~59-62, in the `full` object spread).
   - Add a new action `touchConnection: (id: string) => void` to the `SshState` interface that updates `lastUsedAt` to `Date.now()` for the given connection ID and calls `saveToBackend`. Implementation: same pattern as `updateConnection` but only sets `lastUsedAt`.

3. In `src/components/sidebar/SshQuickConnect.tsx`:
   - Import or access `touchConnection` from `useSshStore` (add to the existing destructured selectors near line 159).
   - In `handleSavedConnectionClick` (line ~237), call `useSshStore.getState().touchConnection(conn.id)` right before calling `connectAndBrowse`.
   - Also in `handleFolderSelect` (line ~247), after the `addConnection` block that saves config hosts as connections (~line 253-264), call `useSshStore.getState().touchConnection(hostInfo.id)` to track config host usage too.
   - Change the section label from `Saved` (line 404) to `Recent`.
   - Sort the connections before rendering: replace `{connections.map((conn) => ...}` with `{[...connections].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)).map((conn) => ...}` so most recently used appears first. Connections without a timestamp default to 0 and sink to the bottom.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/panescale && npx tsc --noEmit 2>&1 | head -30</automated>
  </verify>
  <done>
    - The "Saved" label reads "Recent" in the SSH dropdown
    - SshConnectionConfig has a lastUsedAt optional number field
    - Connections are sorted most-recent-first in the dropdown
    - touchConnection updates the timestamp and persists to backend
    - TypeScript compiles without errors
  </done>
</task>

</tasks>

<verification>
- `npx tsc --noEmit` passes
- Grep confirms "Recent" label: `grep -n "Recent" src/components/sidebar/SshQuickConnect.tsx`
- Grep confirms no "Saved" label remains: `grep -n '"Saved"' src/components/sidebar/SshQuickConnect.tsx` returns nothing
- Grep confirms lastUsedAt in ipc.ts: `grep "lastUsedAt" src/lib/ipc.ts`
</verification>

<success_criteria>
- SSH connection dropdown shows "Recent" instead of "Saved"
- Connections sorted by lastUsedAt descending (most recent first)
- Connecting to a saved connection updates its lastUsedAt timestamp
- Browsing a config host and selecting a folder also updates lastUsedAt
- No TypeScript compilation errors
</success_criteria>

<output>
After completion, create `.planning/quick/260322-hsq-rename-saved-connections-to-recent-and-s/260322-hsq-SUMMARY.md`
</output>
