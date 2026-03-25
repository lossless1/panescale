import { useEffect, useCallback } from "react";
import { useThemeStore, type ThemePreference } from "../../stores/themeStore";
import { useSettingsStore, type Language } from "../../stores/settingsStore";
import type { TerminalSchemeName } from "../../lib/terminalSchemes";
import { useT } from "../../lib/i18n";
import { enable as enableAutostart, disable as disableAutostart, isEnabled as isAutostartEnabled } from "@tauri-apps/plugin-autostart";

interface SettingsModalProps {
  open: boolean;
  onClose: () => void;
}

const sectionTitle: React.CSSProperties = {
  fontSize: 14,
  color: "var(--text-secondary)",
  marginBottom: 12,
  marginTop: 20,
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

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23888' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
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

function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (val: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!checked)}
      style={{
        width: 40,
        height: 22,
        borderRadius: 11,
        border: "none",
        cursor: "pointer",
        backgroundColor: checked ? "var(--accent)" : "var(--bg-primary)",
        position: "relative",
        transition: "background-color 0.2s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? 20 : 2,
          width: 18,
          height: 18,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.2s",
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }}
      />
    </button>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ ...rowStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13, color: "var(--text-primary)" }}>{label}</div>
        {description && (
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>{description}</div>
        )}
      </div>
      {children}
    </div>
  );
}

const languages: { value: Language; label: string }[] = [
  { value: "en", label: "English" },
  { value: "uk", label: "Ukrainian" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Francais" },
  { value: "es", label: "Espanol" },
  { value: "ja", label: "Japanese" },
  { value: "zh", label: "Chinese" },
];

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const t = useT();
  const preference = useThemeStore((s) => s.preference);
  const setPreference = useThemeStore((s) => s.setPreference);

  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const scrollback = useSettingsStore((s) => s.scrollback);
  const colorScheme = useSettingsStore((s) => s.colorScheme);
  const launchAtLogin = useSettingsStore((s) => s.launchAtLogin);
  const language = useSettingsStore((s) => s.language);
  const notificationsEnabled = useSettingsStore((s) => s.notificationsEnabled);
  const completionChimeEnabled = useSettingsStore((s) => s.completionChimeEnabled);
  const busyThresholdSeconds = useSettingsStore((s) => s.busyThresholdSeconds);
  const autoUpdate = useSettingsStore((s) => s.autoUpdate);

  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setScrollback = useSettingsStore((s) => s.setScrollback);
  const setColorScheme = useSettingsStore((s) => s.setColorScheme);
  const setLaunchAtLogin = useSettingsStore((s) => s.setLaunchAtLogin);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const setNotificationsEnabled = useSettingsStore((s) => s.setNotificationsEnabled);
  const setCompletionChimeEnabled = useSettingsStore((s) => s.setCompletionChimeEnabled);
  const setBusyThresholdSeconds = useSettingsStore((s) => s.setBusyThresholdSeconds);
  const setAutoUpdate = useSettingsStore((s) => s.setAutoUpdate);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleAutostart = useCallback(async (enabled: boolean) => {
    setLaunchAtLogin(enabled);
    try {
      if (enabled) {
        await enableAutostart();
      } else {
        await disableAutostart();
      }
    } catch {
      // autostart plugin may not be available in dev
    }
  }, [setLaunchAtLogin]);

  // Sync autostart state on mount
  useEffect(() => {
    if (!open) return;
    isAutostartEnabled().then((enabled) => {
      if (enabled !== launchAtLogin) setLaunchAtLogin(enabled);
    }).catch(() => {});
  }, [open, launchAtLogin, setLaunchAtLogin]);

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
          maxWidth: 520,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          backgroundColor: "var(--bg-secondary)",
          border: "1px solid var(--border)",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)",
          position: "relative",
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            background: "none",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 18,
            padding: "2px 6px",
            borderRadius: 4,
            lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-primary)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          &#x2715;
        </button>

        <h2
          style={{
            fontSize: 18,
            marginBottom: 4,
            marginTop: 0,
            color: "var(--text-primary)",
            fontWeight: 600,
          }}
        >
          {t("settings.title")}
        </h2>

        {/* ── General ── */}
        <h3 style={{ ...sectionTitle, marginTop: 16 }}>{t("settings.general")}</h3>

        <SettingRow label={t("settings.launchAtLogin")} description={t("settings.launchAtLoginDesc")}>
          <ToggleSwitch checked={launchAtLogin} onChange={handleAutostart} />
        </SettingRow>

        <SettingRow label="Auto-update" description="Check for updates and notify when a new version is available">
          <ToggleSwitch checked={autoUpdate} onChange={setAutoUpdate} />
        </SettingRow>

        <SettingRow label={t("settings.language")} description={t("settings.languageDesc")}>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
            style={{ ...selectStyle, width: 150 }}
          >
            {languages.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </SettingRow>

        {/* ── Appearance ── */}
        <h3 style={sectionTitle}>{t("settings.appearance")}</h3>

        <div style={rowStyle}>
          <label style={labelStyle}>{t("settings.theme")}</label>
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
          <label style={labelStyle}>{t("settings.terminalColorScheme")}</label>
          <div style={{ display: "flex", gap: 6 }}>
            {(["one-dark", "dracula", "light"] as TerminalSchemeName[]).map((scheme) => (
              <SegmentButton
                key={scheme}
                label={scheme === "one-dark" ? "One Dark" : scheme === "dracula" ? "Dracula" : "Light"}
                active={colorScheme === scheme}
                onClick={() => setColorScheme(scheme)}
              />
            ))}
          </div>
        </div>

        {/* ── Terminal ── */}
        <h3 style={sectionTitle}>{t("settings.terminal")}</h3>

        <div style={rowStyle}>
          <label style={labelStyle}>{t("settings.fontFamily")}</label>
          <input
            type="text"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={rowStyle}>
          <label style={labelStyle}>{t("settings.fontSize")}: {fontSize}px</label>
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

        <div style={rowStyle}>
          <label style={labelStyle}>{t("settings.scrollbackLines")}</label>
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

        {/* ── Notifications ── */}
        <h3 style={sectionTitle}>{t("settings.notifications")}</h3>

        <SettingRow label={t("settings.desktopNotifications")} description={t("settings.desktopNotificationsDesc")}>
          <ToggleSwitch checked={notificationsEnabled} onChange={setNotificationsEnabled} />
        </SettingRow>

        <SettingRow label={t("settings.completionSound")} description={t("settings.completionSoundDesc")}>
          <ToggleSwitch checked={completionChimeEnabled} onChange={setCompletionChimeEnabled} />
        </SettingRow>

        <div style={rowStyle}>
          <label style={labelStyle}>{t("settings.busyThreshold")}: {busyThresholdSeconds}s</label>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
            {t("settings.busyThresholdDesc")}
          </div>
          <input
            type="range"
            min={2}
            max={30}
            step={1}
            value={busyThresholdSeconds}
            onChange={(e) => setBusyThresholdSeconds(Number(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />
        </div>
      </div>
    </div>
  );
}
