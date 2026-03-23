import { useCanvasStore } from "../stores/canvasStore";
import { useProjectStore } from "../stores/projectStore";
import { useSshStore } from "../stores/sshStore";

/**
 * Spawn a terminal at the given position, automatically choosing
 * local PTY or SSH based on the active project.
 */
export function spawnTerminalAtPosition(position: { x: number; y: number }) {
  const project = useProjectStore.getState().activeProject();

  if (project?.isRemote && project.sshHost) {
    const [user, host] = project.sshHost.split("@");
    const configHosts = useSshStore.getState().configHosts;
    const savedConns = useSshStore.getState().connections;
    const configHost = configHosts.find((h) => h.hostname === host || h.host_alias === host);
    const savedConn = savedConns.find((c) => c.host === host);
    const port = configHost?.port ?? savedConn?.port ?? 22;
    const keyPath = configHost?.identity_file ?? savedConn?.keyPath;
    const connId = configHost?.host_alias ?? savedConn?.id ?? host;

    useCanvasStore.getState().addSshTerminalNode(position, { id: connId, host, user, port, keyPath });

    // Set startup command to cd into remote project directory
    const nodes = useCanvasStore.getState().nodes;
    const newNode = nodes[nodes.length - 1];
    if (newNode) {
      const remotePath = project.path.includes(":") ? project.path.split(":")[1] : project.path;
      useCanvasStore.getState().updateNodeData(newNode.id, { startupCommand: `cd ${remotePath}` });
    }
  } else {
    const cwd = project?.path ?? "~";
    useCanvasStore.getState().addTerminalNode(position, cwd);
  }
}
