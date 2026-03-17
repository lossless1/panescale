import { ReactFlowProvider } from "@xyflow/react";
import { ThemeProvider } from "./components/theme/ThemeProvider";
import { AppShell } from "./components/layout/AppShell";
import { Canvas } from "./components/canvas/Canvas";

function App() {
  return (
    <ThemeProvider>
      <AppShell>
        <ReactFlowProvider>
          <Canvas />
        </ReactFlowProvider>
      </AppShell>
    </ThemeProvider>
  );
}

export default App;
