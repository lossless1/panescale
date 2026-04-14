import { type Highlighter, createHighlighter } from "shiki";

// Extension to language mapping
export const EXT_LANG_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  py: "python",
  rs: "rust",
  go: "go",
  rb: "ruby",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  cs: "csharp",
  swift: "swift",
  kt: "kotlin",
  md: "markdown",
  json: "json",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  html: "html",
  css: "css",
  scss: "scss",
  less: "less",
  xml: "xml",
  sql: "sql",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  fish: "fish",
  ps1: "powershell",
  dockerfile: "dockerfile",
  makefile: "makefile",
  lua: "lua",
  vim: "viml",
  graphql: "graphql",
  php: "php",
  dart: "dart",
  r: "r",
  zig: "zig",
};

// Dotfile name to language mapping
const DOTFILE_LANG_MAP: Record<string, string> = {
  ".bashrc": "bash",
  ".bash_profile": "bash",
  ".bash_aliases": "bash",
  ".zshrc": "bash",
  ".zshenv": "bash",
  ".zprofile": "bash",
  ".profile": "bash",
  ".gitignore": "gitignore",
  ".gitattributes": "gitattributes",
  ".gitmodules": "ini",
  ".gitconfig": "ini",
  ".editorconfig": "ini",
  ".env": "properties",
  ".env.local": "properties",
  ".env.development": "properties",
  ".env.production": "properties",
  ".npmrc": "ini",
  ".yarnrc": "yaml",
  ".prettierrc": "json",
  ".eslintrc": "json",
  ".babelrc": "json",
  ".dockerignore": "gitignore",
  ".htaccess": "apacheconf",
};

export function detectLanguage(fileName: string): string {
  const lower = fileName.toLowerCase();
  // Check dotfile names first
  if (lower.startsWith(".")) {
    const dotLang = DOTFILE_LANG_MAP[lower];
    if (dotLang) return dotLang;
  }
  const parts = fileName.split(".");
  if (parts.length < 2) return "text";
  const ext = parts[parts.length - 1].toLowerCase();
  return EXT_LANG_MAP[ext] || "text";
}

// Common languages to preload
const COMMON_LANGS = [
  "typescript", "javascript", "python", "rust", "bash", "json",
  "tsx", "jsx", "go", "html", "css",
];

// Module-level highlighter cache (single instance shared by all consumers)
let highlighterPromise: Promise<Highlighter> | null = null;
export const loadedLangs = new Set<string>();

export async function getHighlighter(lang: string): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["one-dark-pro", "github-light"],
      langs: COMMON_LANGS,
    });
    for (const l of COMMON_LANGS) {
      loadedLangs.add(l);
    }
  }

  const hl = await highlighterPromise;

  // Dynamically load language if not yet loaded
  if (lang !== "text" && !loadedLangs.has(lang)) {
    try {
      await hl.loadLanguage(lang as Parameters<typeof hl.loadLanguage>[0]);
      loadedLangs.add(lang);
    } catch {
      // Language not available, will fall back to text
    }
  }

  return hl;
}
