import { useCanvasStore } from "../../stores/canvasStore";
import { useT } from "../../lib/i18n";

type TabId = "files" | "terminals" | "git";

export type { TabId };

interface SidebarTabsProps {
  activeTab: TabId;
  onTabChange: (tab: TabId) => void;
}

const tabKeys: { id: TabId; i18nKey: string }[] = [
  { id: "files", i18nKey: "sidebar.files" },
  { id: "terminals", i18nKey: "sidebar.piles" },
];

export function SidebarTabs({ activeTab, onTabChange }: SidebarTabsProps) {
  const t = useT();
  const bellActiveNodes = useCanvasStore((s) => s.bellActiveNodes);
  const hasPilesNotification = bellActiveNodes.size > 0;

  return (
    <div
      style={{
        display: "flex",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}
    >
      {tabKeys.map((tab) => (
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
          <span style={{ position: "relative", display: "inline-block" }}>
            {t(tab.i18nKey)}
            {tab.id === "terminals" && hasPilesNotification && activeTab !== "terminals" && (
              <span style={{
                position: "absolute",
                top: -2,
                right: -8,
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: "#6366f1",
              }} />
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
