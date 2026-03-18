import { useRef, useState } from "react";
import { gitCommit } from "../../../lib/ipc";
import { useGitStore } from "../../../stores/gitStore";

interface CommitSectionProps {
  repoPath: string;
}

export function CommitSection({ repoPath }: CommitSectionProps) {
  const [message, setMessage] = useState("");
  const [committing, setCommitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const entries = useGitStore((s) => s.entries);
  const refresh = useGitStore((s) => s.refresh);

  const hasStagedFiles = entries.some((e) => e.status.startsWith("staged_"));
  const isDisabled = !message.trim() || !hasStagedFiles || committing;

  const handleCommit = async () => {
    if (isDisabled) return;
    setCommitting(true);
    setFeedback(null);
    try {
      const oid = await gitCommit(repoPath, message.trim());
      const shortOid = oid.length > 7 ? oid.slice(0, 7) : oid;
      setMessage("");
      setFeedback(`Committed: ${shortOid}`);
      await refresh(repoPath);
      setTimeout(() => setFeedback(null), 2000);
    } catch (err) {
      setFeedback(`Error: ${String(err)}`);
      setTimeout(() => setFeedback(null), 3000);
    } finally {
      setCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleCommit();
    }
  };

  return (
    <div style={{ padding: "0 0 8px 0" }}>
      <textarea
        ref={textareaRef}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Commit message..."
        rows={3}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "6px 8px",
          fontSize: 12,
          fontFamily: "inherit",
          background: "var(--bg-primary)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          resize: "vertical",
          outline: "none",
          minHeight: 52,
        }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
        <button
          onClick={handleCommit}
          disabled={isDisabled}
          style={{
            flex: 1,
            padding: "5px 12px",
            fontSize: 12,
            fontWeight: 600,
            background: isDisabled ? "var(--bg-secondary)" : "var(--accent)",
            color: isDisabled ? "var(--text-secondary)" : "#fff",
            border: "none",
            borderRadius: 4,
            cursor: isDisabled ? "not-allowed" : "pointer",
            opacity: committing ? 0.7 : 1,
          }}
        >
          {committing ? "Committing..." : "Commit"}
        </button>
      </div>

      {feedback && (
        <div
          style={{
            fontSize: 11,
            marginTop: 4,
            color: feedback.startsWith("Error") ? "var(--text-error, #f44)" : "#4caf50",
          }}
        >
          {feedback}
        </div>
      )}
    </div>
  );
}
