import { ThemeProvider } from "./components/theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";

function App() {
  return (
    <ThemeProvider>
      <AppShell>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: "100%",
            color: "var(--text-secondary)",
            fontSize: 14,
          }}
        >
          Canvas placeholder
        </div>
      </AppShell>
    </ThemeProvider>
  );
}

export default App;
