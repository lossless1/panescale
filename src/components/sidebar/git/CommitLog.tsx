import { useState, useCallback, useRef, useMemo } from "react";
import { useGitStore } from "../../../stores/gitStore";
import { gitLog } from "../../../lib/ipc";
import { assignLanes } from "./CommitGraph";
import { CommitGraph } from "./CommitGraph";
import { CommitLogItem } from "./CommitLogItem";

const ROW_HEIGHT = 32;
const PAGE_SIZE = 50;

interface CommitLogProps {
  repoPath: string;
}

export function CommitLog({ repoPath }: CommitLogProps) {
  const commitLog = useGitStore((s) => s.commitLog);

  const [collapsed, setCollapsed] = useState(false);
  const [expandedOid, setExpandedOid] = useState<string | null>(null);
  const [extraCommits, setExtraCommits] = useState<
    import("../../../lib/ipc").GitCommitInfo[]
  >([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef(0);

  // All commits = store commits + paginated extras
  const allCommits = useMemo(
    () => [...commitLog, ...extraCommits],
    [commitLog, extraCommits],
  );

  const nodes = useMemo(() => assignLanes(allCommits), [allCommits]);

  const handleScroll = useCallback(async () => {
    if (!scrollRef.current || loadingMore || !hasMore) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    if (scrollTop + clientHeight < scrollHeight - 50) return;

    setLoadingMore(true);
    const nextSkip = skipRef.current + PAGE_SIZE;
    try {
      const more = await gitLog(repoPath, PAGE_SIZE, nextSkip);
      if (more.length < PAGE_SIZE) setHasMore(false);
      if (more.length > 0) {
        setExtraCommits((prev) => [...prev, ...more]);
        skipRef.current = nextSkip;
      }
    } catch {
      /* swallow -- store may surface error */
    } finally {
      setLoadingMore(false);
    }
  }, [repoPath, loadingMore, hasMore]);

  return (
    <div style={{ marginBottom: 8 }}>
      {/* Header */}
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={headerStyle}
      >
        {collapsed ? "\u25B6" : "\u25BC"} Commit Log ({allCommits.length}
        {hasMore ? "+" : ""})
      </div>

      {!collapsed && (
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          style={{
            maxHeight: 400,
            overflowY: "auto",
            overflowX: "hidden",
          }}
        >
          {allCommits.length === 0 ? (
            <div
              style={{
                padding: "8px",
                fontSize: 12,
                color: "var(--text-secondary)",
              }}
            >
              No commits
            </div>
          ) : (
            <div style={{ display: "flex" }}>
              {/* SVG graph */}
              <CommitGraph nodes={nodes} rowHeight={ROW_HEIGHT} />

              {/* Commit items */}
              <div style={{ flex: 1, minWidth: 0 }}>
                {allCommits.map((commit) => (
                  <CommitLogItem
                    key={commit.oid}
                    commit={commit}
                    expanded={expandedOid === commit.oid}
                    onToggle={() =>
                      setExpandedOid(
                        expandedOid === commit.oid ? null : commit.oid,
                      )
                    }
                  />
                ))}
              </div>
            </div>
          )}

          {loadingMore && (
            <div
              style={{
                padding: "4px 8px",
                fontSize: 11,
                color: "var(--text-secondary)",
                textAlign: "center",
              }}
            >
              Loading...
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const headerStyle: React.CSSProperties = {
  fontWeight: 600,
  fontSize: 11,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--text-secondary)",
  marginTop: 12,
  marginBottom: 4,
  paddingBottom: 4,
  borderBottom: "1px solid var(--border)",
  cursor: "pointer",
};
