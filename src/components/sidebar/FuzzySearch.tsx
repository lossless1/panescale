import { useCallback, useEffect, useRef, useState } from "react";
import { useProjectStore } from "../../stores/projectStore";
import { fsReadDir } from "../../lib/ipc";
import { fuzzyFilter } from "../../lib/fuzzyMatch";

const MAX_RESULTS = 20;
const SKIP_DIRS = new Set(["node_modules", ".git", "target", "dist", ".next", "__pycache__"]);

interface FuzzySearchProps {
  onNavigateToFile?: (filePath: string) => void;
}

export function FuzzySearch({ onNavigateToFile }: FuzzySearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const activeProject = useProjectStore((s) => s.activeProject());

  // Register Cmd+K global shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, []);

  // Collect all files when opening
  useEffect(() => {
    if (!open || !activeProject) return;

    setQuery("");
    setSelectedIndex(0);
    setLoading(true);

    let cancelled = false;

    async function collectFiles(dirPath: string): Promise<string[]> {
      try {
        const entries = await fsReadDir(dirPath);
        const files: string[] = [];
        const subdirPromises: Promise<string[]>[] = [];

        for (const entry of entries) {
          if (entry.is_dir) {
            if (!SKIP_DIRS.has(entry.name)) {
              subdirPromises.push(collectFiles(entry.path));
            }
          } else {
            files.push(entry.path);
          }
        }

        const subdirResults = await Promise.all(subdirPromises);
        return files.concat(...subdirResults);
      } catch {
        return [];
      }
    }

    collectFiles(activeProject.path).then((files) => {
      if (!cancelled) {
        setAllFiles(files);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [open, activeProject?.path]);

  // Focus input when opened
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const projectRoot = activeProject?.path ?? "";

  // Get relative path for display
  const getRelativePath = useCallback(
    (fullPath: string) => {
      if (projectRoot && fullPath.startsWith(projectRoot)) {
        return fullPath.slice(projectRoot.length + 1);
      }
      return fullPath;
    },
    [projectRoot],
  );

  // Filter results
  const filtered = fuzzyFilter(allFiles, query, (path) =>
    getRelativePath(path),
  ).slice(0, MAX_RESULTS);

  // Reset selection when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = useCallback(
    (filePath: string) => {
      onNavigateToFile?.(filePath);
      handleClose();
    },
    [onNavigateToFile, handleClose],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex]);
      }
    },
    [filtered, selectedIndex, handleClose, handleSelect],
  );

  if (!open) return null;

  return (
    <div
      onClick={handleClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "15vh",
        zIndex: 10000,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 500,
          maxWidth: "90vw",
          backgroundColor: "var(--bg-primary)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={loading ? "Loading files..." : "Search files..."}
            style={{
              width: "100%",
              padding: "8px 12px",
              fontSize: 14,
              background: "var(--bg-secondary)",
              color: "var(--text-primary)",
              border: "1px solid var(--border)",
              borderRadius: 6,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: "auto" }}>
          {filtered.length === 0 && query.length > 0 && !loading && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                fontSize: 13,
                color: "var(--text-secondary)",
              }}
            >
              No matching files
            </div>
          )}
          {filtered.map((filePath, i) => (
            <div
              key={filePath}
              onClick={() => handleSelect(filePath)}
              style={{
                padding: "8px 16px",
                fontSize: 13,
                cursor: "pointer",
                backgroundColor:
                  i === selectedIndex ? "var(--accent)" : "transparent",
                color:
                  i === selectedIndex ? "#fff" : "var(--text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              {getRelativePath(filePath)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
