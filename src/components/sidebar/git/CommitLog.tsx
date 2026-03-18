import { useGitStore } from "../../../stores/gitStore";

interface CommitLogProps {
  repoPath: string;
}

/** Stub -- full implementation in plan 04-04 */
export function CommitLog({ repoPath: _repoPath }: CommitLogProps) {
  const commitLog = useGitStore((s) => s.commitLog);

  return (
    <div style={headerStyle}>
      Log ({commitLog.length})
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
};
