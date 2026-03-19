import { useRef, useEffect, useCallback } from "react";
import { EditorView, keymap, lineNumbers, highlightActiveLineGutter, highlightSpecialChars, drawSelection, highlightActiveLine } from "@codemirror/view";
import { EditorState, Compartment } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { syntaxHighlighting, defaultHighlightStyle, indentOnInput, bracketMatching, foldGutter, foldKeymap } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap, autocompletion, completionKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { oneDark } from "@codemirror/theme-one-dark";

// Language imports
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import { sql } from "@codemirror/lang-sql";
import { xml } from "@codemirror/lang-xml";
import { yaml } from "@codemirror/lang-yaml";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  language: string;
  theme: "light" | "dark";
  className?: string;
}

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "typescript":
      return javascript({ jsx: false, typescript: true });
    case "tsx":
      return javascript({ jsx: true, typescript: true });
    case "javascript":
      return javascript({ jsx: false });
    case "jsx":
      return javascript({ jsx: true });
    case "python":
      return python();
    case "rust":
      return rust();
    case "html":
      return html();
    case "css":
    case "scss":
    case "less":
      return css();
    case "json":
      return json();
    case "markdown":
      return markdown();
    case "c":
    case "cpp":
      return cpp();
    case "java":
      return java();
    case "sql":
      return sql();
    case "xml":
      return xml();
    case "yaml":
      return yaml();
    default:
      return [];
  }
}

function getThemeExtension(theme: "light" | "dark") {
  if (theme === "dark") {
    return oneDark;
  }
  // Light mode: use default highlight style with a transparent editor
  return [
    syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
    EditorView.theme({
      "&": { backgroundColor: "transparent" },
      ".cm-gutters": {
        backgroundColor: "var(--bg-primary, #ffffff)",
        borderRight: "1px solid var(--border, #e0e0e0)",
        color: "var(--text-secondary, #999)",
      },
      ".cm-activeLineGutter": {
        backgroundColor: "rgba(0,0,0,0.05)",
      },
      ".cm-activeLine": {
        backgroundColor: "rgba(0,0,0,0.04)",
      },
      ".cm-cursor": {
        borderLeftColor: "var(--text-primary, #333)",
      },
    }, { dark: false }),
  ];
}

export function CodeEditor({ value, onChange, onSave, language, theme, className }: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  const themeCompartment = useRef(new Compartment());
  const isExternalUpdate = useRef(false);
  const onChangeRef = useRef(onChange);
  const onSaveRef = useRef(onSave);

  // Keep refs current
  onChangeRef.current = onChange;
  onSaveRef.current = onSave;

  // Create editor on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const saveKeymap = keymap.of([
      {
        key: "Mod-s",
        run: () => {
          onSaveRef.current();
          return true;
        },
      },
    ]);

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged && !isExternalUpdate.current) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        closeBrackets(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap,
          ...defaultKeymap,
          ...searchKeymap,
          ...historyKeymap,
          ...foldKeymap,
          ...completionKeymap,
          indentWithTab,
        ]),
        saveKeymap,
        langCompartment.current.of(getLanguageExtension(language)),
        themeCompartment.current.of(getThemeExtension(theme)),
        updateListener,
        EditorState.tabSize.of(2),
        EditorView.theme({
          "&": { height: "100%" },
          ".cm-scroller": { overflow: "auto" },
        }),
      ],
    });

    const view = new EditorView({
      state,
      parent: containerRef.current,
    });

    viewRef.current = view;

    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Only run on mount - value/language/theme handled by separate effects
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const currentDoc = view.state.doc.toString();
    if (currentDoc !== value) {
      isExternalUpdate.current = true;
      view.dispatch({
        changes: {
          from: 0,
          to: currentDoc.length,
          insert: value,
        },
      });
      isExternalUpdate.current = false;
    }
  }, [value]);

  // Reconfigure language
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: langCompartment.current.reconfigure(getLanguageExtension(language)),
    });
  }, [language]);

  // Reconfigure theme
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.current.reconfigure(getThemeExtension(theme)),
    });
  }, [theme]);

  // Prevent wheel events from reaching the canvas
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`nodrag nowheel nopan ${className || ""}`}
      onWheel={handleWheel}
      style={{ height: "100%", width: "100%" }}
    />
  );
}
