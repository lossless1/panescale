import type { GitCommitInfo } from "../../../lib/ipc";

interface CommitLogItemProps {
  commit: GitCommitInfo;
  expanded: boolean;
  onToggle: () => void;
}

function relativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)}w ago`;
  return new Date(timestamp * 1000).toLocaleDateString();
}

export function CommitLogItem({
  commit,
  expanded,
  onToggle,
}: CommitLogItemProps) {
  const firstLine = commit.message.split("\n")[0];

  return (
    <div>
      {/* Collapsed row -- fixed 32px height */}
      <div
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          height: 32,
          padding: "0 8px",
          cursor: "pointer",
          fontSize: 12,
          overflow: "hidden",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "var(--bg-secondary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.backgroundColor =
            "transparent";
        }}
      >
        <span
          style={{
            fontFamily: "monospace",
            color: "var(--accent, #8b7cf6)",
            flexShrink: 0,
            fontSize: 11,
          }}
        >
          {commit.short_oid}
        </span>
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: "var(--text-primary)",
          }}
        >
          {firstLine}
        </span>
        <span
          style={{
            flexShrink: 0,
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          {relativeTime(commit.timestamp)}
        </span>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: "4px 8px 8px 8px",
            fontSize: 11,
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-secondary)",
          }}
        >
          {/* Full message */}
          <div
            style={{
              whiteSpace: "pre-wrap",
              color: "var(--text-primary)",
              marginBottom: 6,
              lineHeight: 1.4,
            }}
          >
            {commit.message}
          </div>

          {/* Author */}
          <div style={{ color: "var(--text-secondary)", marginBottom: 2 }}>
            <span style={{ fontWeight: 600 }}>{commit.author}</span>{" "}
            &lt;{commit.author_email}&gt;
          </div>

          {/* Date */}
          <div style={{ color: "var(--text-secondary)", marginBottom: 6 }}>
            {new Date(commit.timestamp * 1000).toLocaleString()}
          </div>

          {/* Changed files */}
          {commit.files_changed.length > 0 && (
            <div>
              <div
                style={{
                  color: "var(--text-secondary)",
                  fontWeight: 600,
                  marginBottom: 2,
                }}
              >
                Files ({commit.files_changed.length}):
              </div>
              {commit.files_changed.map((f) => (
                <div
                  key={f}
                  style={{
                    fontFamily: "monospace",
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    padding: "1px 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
