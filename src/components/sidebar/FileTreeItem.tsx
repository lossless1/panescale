import type { FileEntry } from "../../lib/ipc";

interface FileTreeItemProps {
  entry: FileEntry;
  depth: number;
  expanded: boolean;
  onToggle: (path: string) => void;
  onRightClick?: (event: React.MouseEvent, entry: FileEntry) => void;
}

export function FileTreeItem({
  entry,
  depth,
  expanded,
  onToggle,
  onRightClick,
}: FileTreeItemProps) {
  const paddingLeft = 8 + depth * 16;
  const isFile = !entry.is_dir;

  return (
    <div
      draggable={isFile}
      onDragStart={(e) => {
        if (entry.is_dir) {
          e.preventDefault();
          return;
        }
        const ext = entry.name.includes('.')
          ? '.' + entry.name.split('.').pop()
          : '';
        e.dataTransfer.setData(
          'application/excalicode-file',
          JSON.stringify({
            path: entry.path,
            name: entry.name,
            ext,
          }),
        );
        e.dataTransfer.effectAllowed = 'copy';
      }}
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
        gap: 4,
        paddingLeft,
        paddingRight: 8,
        paddingTop: 4,
        paddingBottom: 4,
        fontSize: 13,
        cursor: entry.is_dir ? "pointer" : isFile ? "grab" : "default",
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
