import { useGitStore } from "../../../stores/gitStore";

interface BranchSectionProps {
  repoPath: string;
}

/** Stub -- full implementation in plan 04-03 */
export function BranchSection({ repoPath: _repoPath }: BranchSectionProps) {
  const branches = useGitStore((s) => s.branches);

  return (
    <div style={headerStyle}>
      Branches ({branches.length})
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
