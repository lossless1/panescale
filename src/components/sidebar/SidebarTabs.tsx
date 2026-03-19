type TabId = "files" | "terminals" | "git" | "ssh";

interface SidebarTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabs: { id: TabId; label: string }[] = [
  { id: "files", label: "Files" },
  { id: "terminals", label: "Piles" },
  { id: "git", label: "Git" },
  { id: "ssh", label: "SSH" },
];

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          style={{
            flex: 1,
            padding: "8px 0",
            fontSize: 12,
            fontWeight: activeTab === tab.id ? 600 : 400,
            color:
              activeTab === tab.id
                ? "var(--text-primary)"
                : "var(--text-secondary)",
            background: "none",
            border: "none",
            borderBottom:
              activeTab === tab.id ? "2px solid var(--accent)" : "2px solid transparent",
            cursor: "pointer",
            transition: "color 0.15s, border-color 0.15s",
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
