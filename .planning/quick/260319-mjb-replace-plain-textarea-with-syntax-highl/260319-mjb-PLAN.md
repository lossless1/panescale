---
phase: quick
plan: 260319-mjb
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/canvas/FilePreviewNode.tsx
  - src/components/canvas/CodeEditor.tsx
  - src/styles/codemirror.css
autonomous: true
requirements: []
must_haves:
  truths:
    - "Edit mode shows syntax-highlighted code matching preview mode appearance"
    - "User can type and edit code with live syntax highlighting"
    - "Cmd/Ctrl+S saves the file from the editor"
    - "Theme switches between light and dark correctly in edit mode"
    - "Editor does not interfere with canvas drag/zoom interactions"
  artifacts:
    - path: "src/components/canvas/CodeEditor.tsx"
      provides: "CodeMirror 6 wrapper component for file editing"
    - path: "src/components/canvas/FilePreviewNode.tsx"
      provides: "Updated to use CodeEditor instead of textarea in edit mode"
  key_links:
    - from: "src/components/canvas/CodeEditor.tsx"
      to: "FilePreviewNode.tsx"
      via: "React component import"
      pattern: "import.*CodeEditor"
---

<objective>
Replace the plain textarea in FilePreviewNode edit mode with a CodeMirror 6 editor that provides syntax highlighting while editing. Currently, edit mode shows unstyled monospace text while preview mode shows beautifully highlighted code via shiki -- this creates a jarring UX gap.

Purpose: Give users syntax-highlighted code editing that visually matches the preview mode, eliminating the need to toggle between modes just to read highlighted code.
Output: A CodeMirror 6 editor component integrated into FilePreviewNode's edit mode with language detection, theme-aware highlighting, and keyboard save support.
</objective>

<execution_context>
@/Users/volodymyrsaakian/.claude/get-shit-done/workflows/execute-plan.md
@/Users/volodymyrsaakian/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/components/canvas/FilePreviewNode.tsx
@src/lib/shikiHighlighter.ts

<interfaces>
From src/lib/shikiHighlighter.ts:
```typescript
export function detectLanguage(fileName: string): string;
// Returns language ID like "typescript", "rust", "python", "text"
```

From src/components/canvas/FilePreviewNode.tsx:
```typescript
// Edit mode currently at lines 289-316: plain <textarea> with these props:
// - value={editContent}, onChange -> setEditContent
// - onKeyDown: Cmd/Ctrl+S -> handleSave()
// - className="nodrag nowheel nopan"
// - font: JetBrains Mono 12px, lineHeight 1.5, tabSize 2
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Install CodeMirror 6 and create CodeEditor component</name>
  <files>package.json, src/components/canvas/CodeEditor.tsx, src/styles/codemirror.css</files>
  <action>
Install CodeMirror 6 packages:
```
npm install codemirror @codemirror/view @codemirror/state @codemirror/commands @codemirror/language @codemirror/lang-javascript @codemirror/lang-python @codemirror/lang-rust @codemirror/lang-html @codemirror/lang-css @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-cpp @codemirror/lang-java @codemirror/lang-sql @codemirror/lang-xml @codemirror/lang-yaml @codemirror/theme-one-dark
```

Create `src/components/canvas/CodeEditor.tsx` -- a controlled CodeMirror 6 wrapper:

Props interface:
```typescript
interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  language: string;       // from detectLanguage()
  theme: "light" | "dark";
  className?: string;
}
```

Implementation details:
- Use useRef for the EditorView instance and a container div ref
- Create EditorView in useEffect on mount, destroy on unmount
- Use EditorView.updateListener to dispatch onChange when doc changes
- Map language string to CodeMirror language extension using a helper function:
  - "typescript"/"tsx" -> @codemirror/lang-javascript with jsx/typescript options
  - "javascript"/"jsx" -> @codemirror/lang-javascript with jsx option
  - "python" -> @codemirror/lang-python
  - "rust" -> @codemirror/lang-rust
  - "html" -> @codemirror/lang-html
  - "css"/"scss"/"less" -> @codemirror/lang-css
  - "json" -> @codemirror/lang-json
  - "markdown" -> @codemirror/lang-markdown
  - "c"/"cpp" -> @codemirror/lang-cpp
  - "java" -> @codemirror/lang-java
  - "sql" -> @codemirror/lang-sql
  - "xml" -> @codemirror/lang-xml
  - "yaml" -> @codemirror/lang-yaml
  - Others -> no language extension (plain text)
- Theme: use oneDark from @codemirror/theme-one-dark for dark mode, EditorView.baseTheme for light mode (default)
- Register Cmd/Ctrl+S as a keymap using keymap.of([{ key: "Mod-s", run: () => { onSave(); return true; } }])
- Include basicSetup-like extensions: lineNumbers, highlightActiveLineGutter, highlightSpecialChars, history, foldGutter, drawSelection, indentOnInput, bracketMatching, closeBrackets, autocompletion, highlightActiveLine, highlightSelectionMatches, indentWithTab keymap
  Import these individually from @codemirror/view, @codemirror/state, @codemirror/commands, @codemirror/language, @codemirror/autocomplete, @codemirror/search rather than using the "codemirror" basicSetup (to keep control).
  Actually, for simplicity, just import { basicSetup } from "codemirror" and layer the save keymap on top.
- When value prop changes externally (not from editor typing), update the editor doc via view.dispatch with replaceRange. Use a ref to track whether the change originated from the editor to avoid loops.
- When language or theme changes, reconfigure using view.dispatch({ effects: compartment.reconfigure(...) }). Use Compartment from @codemirror/state for language and theme so they can be swapped dynamically.

Style the editor container:
- Font: 'JetBrains Mono', 'Fira Code', monospace at 12px
- Line height: 1.5
- Tab size: 2
- Height: 100% (fill parent)
- Remove CodeMirror default border/outline: .cm-editor { outline: none !important; border: none; }
- .cm-editor, .cm-scroller { height: 100%; }
- Background: transparent (inherit from parent)

Create `src/styles/codemirror.css` with these overrides.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && npx tsc --noEmit --skipLibCheck 2>&1 | head -30</automated>
  </verify>
  <done>CodeEditor.tsx compiles without type errors, CodeMirror packages installed, CSS overrides file exists</done>
</task>

<task type="auto">
  <name>Task 2: Integrate CodeEditor into FilePreviewNode edit mode</name>
  <files>src/components/canvas/FilePreviewNode.tsx</files>
  <action>
In FilePreviewNode.tsx, replace the plain textarea (lines 289-316) with the CodeEditor component:

1. Import CodeEditor and the codemirror CSS:
```typescript
import { CodeEditor } from "./CodeEditor";
import "../../styles/codemirror.css";
```

2. Replace the textarea block in the isEditing ternary branch with:
```tsx
<CodeEditor
  value={editContent}
  onChange={setEditContent}
  onSave={handleSave}
  language={detectLanguage(fileName)}
  theme={resolvedTheme === "light" ? "light" : "dark"}
/>
```

3. The CodeEditor div container should have className="nodrag nowheel nopan" to prevent canvas interaction interference. Either pass this as className prop or ensure CodeEditor wraps its container div with these classes.

4. Remove the now-unused textarea-related imports if any (there are none specific to textarea).

5. The shiki highlighting in preview mode (the highlightedHtml branch) remains unchanged -- only the edit mode changes.

6. Verify the dirty indicator still works: editContent is still tracked via onChange, so the `dirty = editContent !== content` comparison continues to function.
  </action>
  <verify>
    <automated>cd /Users/volodymyrsaakian/Documents/Edu/excalicode && npx tsc --noEmit --skipLibCheck 2>&1 | head -30</automated>
  </verify>
  <done>FilePreviewNode edit mode renders CodeMirror editor with syntax highlighting, Cmd+S saves, theme-aware coloring, no canvas interaction conflicts</done>
</task>

</tasks>

<verification>
- TypeScript compiles without errors: `npx tsc --noEmit --skipLibCheck`
- Dev server starts without errors: `npm run dev` (or equivalent)
- Open a file tile on canvas, click Edit -- code appears with syntax highlighting
- Type in the editor -- changes reflected, dirty indicator shows
- Cmd/Ctrl+S saves the file
- Toggle between light/dark theme -- editor theme updates
- Canvas drag/zoom does not activate when interacting with editor
</verification>

<success_criteria>
- Plain textarea is fully replaced by CodeMirror 6 in edit mode
- Syntax highlighting in edit mode matches the language detected by detectLanguage()
- Theme switches correctly between light (default CM) and dark (oneDark)
- Keyboard save shortcut (Cmd/Ctrl+S) works
- No regressions in preview mode (shiki still used)
- Canvas interactions (drag, zoom, pan) do not fire when editing
</success_criteria>

<output>
After completion, create `.planning/quick/260319-mjb-replace-plain-textarea-with-syntax-highl/260319-mjb-SUMMARY.md`
</output>
