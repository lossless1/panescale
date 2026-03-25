import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore } from "../stores/projectStore";
import { useSshStore } from "../stores/sshStore";
import { sshListConfigHosts } from "./ipc";

/**
 * Spawn a terminal at the given position, automatically choosing
 * local PTY or SSH based on the active project.
 */
export function spawnTerminalAtPosition(position: { x: number; y: number }) {
  const project = useProjectStore.getState().activeProject();

  if (project?.isRemote && project.sshHost) {
    const [user, host] = project.sshHost.split("@");

    // Load SSH config hosts fresh (they may not be cached yet)
    sshListConfigHosts().then((configHosts) => {
      const savedConns = useSshStore.getState().connections;
      const configHost = configHosts.find((h) => h.hostname === host || h.host_alias === host);
      // Also check saved connections by ID matching config alias
      const savedConn = savedConns.find((c) => c.host === host || c.id === configHost?.host_alias);
      const port = configHost?.port ?? (savedConn?.port !== 22 ? savedConn?.port : undefined) ?? 22;
      const keyPath = configHost?.identity_file ?? savedConn?.keyPath;
      const connId = configHost?.host_alias ?? savedConn?.id ?? host;

      console.log(`[spawnTerminal] SSH: host=${host}, port=${port}, keyPath=${keyPath}, connId=${connId}`);
      useCanvasStore.getState().addSshTerminalNode(position, { id: connId, host, user, port, keyPath });

      // Set startup command to cd into remote project directory
      const nodes = useCanvasStore.getState().nodes;
      const newNode = nodes[nodes.length - 1];
      if (newNode) {
        const remotePath = project.path.includes(":") ? project.path.split(":")[1] : project.path;
        useCanvasStore.getState().updateNodeData(newNode.id, { startupCommand: `cd ${remotePath}` });
      }
    }).catch((err) => {
      console.error("[spawnTerminal] Failed to load SSH config:", err);
    });
  } else {
    const cwd = project?.path ?? "~";
    useCanvasStore.getState().addTerminalNode(position, cwd);
  }
}
