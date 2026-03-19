import { useCallback, useRef } from "react";
import type { FileEntry } from "../../lib/ipc";
import { useFileDragStore } from "../../stores/fileDragStore";

/** Map file extensions to simple text icons with colors */
function fileIcon(name: string): { icon: string; color: string } {
  const ext = name.includes(".") ? name.split(".").pop()?.toLowerCase() : "";
  switch (ext) {
    case "ts": case "tsx": return { icon: "TS", color: "#3178c6" };
    case "js": case "jsx": return { icon: "JS", color: "#f0db4f" };
    case "json": return { icon: "{}", color: "#a0a0a0" };
    case "md": case "mdx": return { icon: "M", color: "#519aba" };
    case "css": case "scss": return { icon: "#", color: "#563d7c" };
    case "html": return { icon: "<>", color: "#e34c26" };
    case "rs": return { icon: "Rs", color: "#dea584" };
    case "toml": return { icon: "T", color: "#9c4221" };
    case "yml": case "yaml": return { icon: "Y", color: "#cb171e" };
    case "png": case "jpg": case "jpeg": case "gif": case "svg": case "webp":
      return { icon: "Im", color: "#a0a0a0" };
    case "lock": return { icon: "Lk", color: "#666" };
    case "gitignore": return { icon: "G", color: "#f05032" };
    default: return { icon: "\u2022", color: "var(--text-secondary)" };
  }
}

/** Inline SVG chevron for folders */
function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transition: "transform 0.15s",
        transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
        flexShrink: 0,
      }}
    >
      <path
        d="M6 4l4 4-4 4"
        stroke="var(--text-secondary)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Inline SVG folder icon */
function FolderIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      {expanded ? (
        <path
          d="M1.5 3.5A1 1 0 012.5 2.5h3.172a1 1 0 01.707.293L7.5 3.914a1 1 0 00.707.293H13.5a1 1 0 011 1V5H3l-1.5 7V3.5z M3 5h11.5l-1.5 7.5h-10L1.5 5H3z"
          fill="#dcb67a"
        />
      ) : (
        <path
          d="M1.5 3.5A1 1 0 012.5 2.5h3.172a1 1 0 01.707.293L7.5 3.914a1 1 0 00.707.293H13.5a1 1 0 011 1v7a1 1 0 01-1 1h-12a1 1 0 01-1-1v-8z"
          fill="#dcb67a"
        />
      )}
    </svg>
  );
}

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  onToggle: (path: string) => void;
  onRightClick?: (event: React.MouseEvent, entry: FileEntry) => void;
}

const DRAG_THRESHOLD = 5; // pixels before drag starts

export function FileTreeItem({
  entry,
  depth,
  expanded,
  onToggle,
  onRightClick,
}: FileTreeItemProps) {
  const paddingLeft = 8 + depth * 16;
  const isFile = !entry.is_dir;
  const startDrag = useFileDragStore((s) => s.startDrag);
  const mouseDownPos = useRef<{ x: number; y: number } | null>(null);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!isFile || e.button !== 0) return;
      mouseDownPos.current = { x: e.clientX, y: e.clientY };

      function onMouseMove(ev: MouseEvent) {
        if (!mouseDownPos.current) return;
        const dx = ev.clientX - mouseDownPos.current.x;
        const dy = ev.clientY - mouseDownPos.current.y;
        if (Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) {
          // Start custom drag
          const ext = entry.name.includes(".")
            ? "." + entry.name.split(".").pop()
            : "";
          startDrag({ path: entry.path, name: entry.name, ext }, ev.clientX, ev.clientY);
          mouseDownPos.current = null;
          cleanup();
        }
      }

      function onMouseUp() {
        mouseDownPos.current = null;
        cleanup();
      }

      function cleanup() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }

      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [isFile, entry, startDrag],
  );

  return (
    <div
      onMouseDown={handleMouseDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onRightClick?.(e, entry);
      }}
      onClick={() => {
        if (entry.is_dir) {
          onToggle(entry.path);
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        paddingLeft,
        paddingRight: 8,
        paddingTop: 3,
        paddingBottom: 3,
        fontSize: 13,
        cursor: entry.is_dir ? "pointer" : "default",
        userSelect: "none",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor =
          "var(--bg-secondary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.backgroundColor = "transparent";
      }}
    >
      {entry.is_dir ? (
        <>
          <ChevronIcon expanded={expanded} />
          <FolderIcon expanded={expanded} />
        </>
      ) : (
        <>
          <span style={{ width: 16, flexShrink: 0 }} />
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              fontSize: 9,
              fontWeight: 700,
              color: fileIcon(entry.name).color,
              flexShrink: 0,
            }}
          >
            {fileIcon(entry.name).icon}
          </span>
        </>
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginLeft: 4,
          color: entry.is_dir
            ? "var(--text-primary)"
            : "var(--text-secondary)",
        }}
      >
        {entry.name}
      </span>
    </div>
  );
}
