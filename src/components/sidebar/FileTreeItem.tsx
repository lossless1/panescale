import type { FileEntry } from "../../lib/ipc";

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  onToggle: (path: string) => void;
}

export function FileTreeItem({
  entry,
  depth,
  expanded,
  onToggle,
}: FileTreeItemProps) {
  const paddingLeft = 8 + depth * 16;

  return (
    <div
      onClick={() => {
        if (entry.is_dir) {
          onToggle(entry.path);
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        paddingLeft,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
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
        <span
          style={{
            display: "inline-block",
            width: 16,
            textAlign: "center",
            transition: "transform 0.15s",
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {"\u25B6"}
        </span>
      ) : (
        <span
          style={{
            display: "inline-block",
            width: 16,
            textAlign: "center",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {"\u2022"}
        </span>
      )}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
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
