import { useEffect } from "react";
import { useThemeStore, type ThemePreference } from "../../stores/themeStore";
import { useSettingsStore } from "../../stores/settingsStore";
import type { TerminalSchemeName } from "../../lib/terminalSchemes";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--text-secondary)",
  marginBottom: 12,
  marginTop: 0,
  fontWeight: 600,
};

const rowStyle: React.CSSProperties = {
  marginBottom: 16,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-secondary)",
  marginBottom: 4,
  display: "block",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  backgroundColor: "var(--bg-primary)",
  color: "var(--text-primary)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "8px",
  fontSize: 13,
  boxSizing: "border-box",
};

function SegmentButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: "6px 12px",
        fontSize: 12,
        border: "1px solid var(--border)",
        borderRadius: 6,
        cursor: "pointer",
        backgroundColor: active ? "var(--accent)" : "var(--bg-primary)",
        color: active ? "#fff" : "var(--text-primary)",
        fontWeight: active ? 600 : 400,
        transition: "background-color 0.15s, color 0.15s",
      }}
    >
      {label}
    </button>
  );
}

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setScrollback = useSettingsStore((s) => s.setScrollback);
  const setColorScheme = useSettingsStore((s) => s.setColorScheme);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: 480,
          width: "90%",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
        }}
      >
        <h2
          style={{
            fontSize: 18,
            marginBottom: 20,
            marginTop: 0,
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          Settings
        </h2>

        {/* Appearance Section */}
        <h3 style={sectionTitle}>Appearance</h3>

        <div style={rowStyle}>
          <label style={labelStyle}>Theme</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["system", "dark", "light"] as ThemePreference[]).map((pref) => (
              <SegmentButton
                key={pref}
                label={pref.charAt(0).toUpperCase() + pref.slice(1)}
                active={preference === pref}
                onClick={() => setPreference(pref)}
              />
            ))}
          </div>
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Terminal Color Scheme</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["one-dark", "dracula"] as TerminalSchemeName[]).map((scheme) => (
              <SegmentButton
                key={scheme}
                label={scheme === "one-dark" ? "One Dark" : "Dracula"}
                active={colorScheme === scheme}
                onClick={() => setColorScheme(scheme)}
              />
            ))}
          </div>
        </div>

        {/* Terminal Section */}
        <h3 style={{ ...sectionTitle, marginTop: 20 }}>Terminal</h3>

        <div style={rowStyle}>
          <label style={labelStyle}>Font Family</label>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>Font Size: {fontSize}px</label>
          <input
            type="range"
            min={10}
            max={24}
            step={1}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>

        <div style={{ ...rowStyle, marginBottom: 0 }}>
          <label style={labelStyle}>Scrollback Lines</label>
          <input
            type="number"
            min={500}
            max={50000}
            step={500}
            value={scrollback}
            onChange={(e) => setScrollback(Number(e.target.value))}
            style={inputStyle}
          />
        </div>
      </div>
    </div>
  );
}
