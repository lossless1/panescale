import { useRef, useCallback } from "react";
import { Channel } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import {
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptyKill,
  ptyDetach,
  ptyReattach,
} from "../lib/ipc";
import type { PtyEvent } from "../lib/ipc";

interface UsePtyReturn {
  spawn: (cwd: string, cols: number, rows: number, term: Terminal) => Promise<string>;
  reattach: (sessionName: string, cols: number, rows: number, term: Terminal) => Promise<void>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  detach: () => void;
  ptyId: string | null;
  isAlive: boolean;
}

export function usePty(): UsePtyReturn {
  const ptyIdRef = useRef<string | null>(null);
  const isAliveRef = useRef(false);
  // Keep a ref to force re-renders when state changes
  const renderRef = useRef(0);
  // Prevent double-spawn in React strict mode
  const spawnLock = useRef(false);
  // Track the tmux session name so StrictMode remount can reattach
  const sessionNameRef = useRef<string | null>(null);

  /** Create a Channel wired to an xterm Terminal instance. */
  const createChannel = useCallback((term: Terminal): Channel<PtyEvent> => {
    const channel = new Channel<PtyEvent>();
    channel.onmessage = (event: PtyEvent) => {
      if (event.event === "data") {
        const bytes = new Uint8Array(event.data.bytes);
        term.write(bytes);
      } else if (event.event === "exit") {
        isAliveRef.current = false;
        renderRef.current += 1;
      }
    };
    return channel;
  }, []);

  /** Wire keyboard input from xterm to PTY. */
  const wireInput = useCallback((term: Terminal) => {
    term.onData((data: string) => {
      if (ptyIdRef.current && isAliveRef.current) {
        ptyWrite(ptyIdRef.current, new TextEncoder().encode(data));
      }
    });
  }, []);

  const spawn = useCallback(
    async (cwd: string, cols: number, rows: number, term: Terminal): Promise<string> => {
      if (spawnLock.current) {
        // StrictMode remount: the first mount's detach() already cleaned up the
        // backend PTY.  Just reset the lock and do a fresh spawn — the tmux
        // session still exists so spawn will create a new PTY that attaches to it.
        // Wait briefly for the backend detach to finish.
        await new Promise((r) => setTimeout(r, 50));
        spawnLock.current = false;
        // Clear stale refs so the fresh spawn gets clean state
        ptyIdRef.current = null;
        sessionNameRef.current = null;
      }
      spawnLock.current = true;

      const channel = createChannel(term);
      const id = await ptySpawn(cwd, cols, rows, channel);
      ptyIdRef.current = id;
      sessionNameRef.current = `exc-${id}`;
      isAliveRef.current = true;
      renderRef.current += 1;

      wireInput(term);
      return id;
    },
    [createChannel, wireInput],
  );

  const reattach = useCallback(
    async (sessionName: string, cols: number, rows: number, term: Terminal): Promise<void> => {
      if (spawnLock.current) {
        return;
      }
      spawnLock.current = true;

      // Derive ptyId from session name (strip "exc-" prefix to get node ID)
      const nodeId = sessionName.startsWith("exc-") ? sessionName.slice(4) : sessionName;
      const channel = createChannel(term);
      await ptyReattach(nodeId, sessionName, cols, rows, channel);
      ptyIdRef.current = nodeId;
      sessionNameRef.current = sessionName;
      isAliveRef.current = true;
      renderRef.current += 1;

      wireInput(term);
    },
    [createChannel, wireInput],
  );

  const write = useCallback((data: string) => {
    if (ptyIdRef.current && isAliveRef.current) {
      ptyWrite(ptyIdRef.current, new TextEncoder().encode(data));
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (ptyIdRef.current && isAliveRef.current) {
      ptyResize(ptyIdRef.current, cols, rows);
    }
  }, []);

  const kill = useCallback(() => {
    if (ptyIdRef.current && isAliveRef.current) {
      isAliveRef.current = false;
      ptyKill(ptyIdRef.current);
      ptyIdRef.current = null;
      sessionNameRef.current = null;
      renderRef.current += 1;
    }
    spawnLock.current = false;
  }, []);

  const detach = useCallback(() => {
    if (ptyIdRef.current && isAliveRef.current) {
      isAliveRef.current = false;
      ptyDetach(ptyIdRef.current);
      // NOTE: Do NOT clear ptyIdRef or sessionNameRef here.
      // In React StrictMode, detach runs between unmount-remount, and
      // spawn() needs these refs to reattach to the existing tmux session.
      // Do NOT reset spawnLock either -- spawn() uses it to detect remount.
      renderRef.current += 1;
    }
  }, []);

  // NOTE: No useEffect cleanup here. TerminalNode's cleanup effect handles
  // kill vs detach decision via pty.kill() or pty.detach(). Having a second
  // cleanup here would race with TerminalNode's cleanup and cause double-detach.

  return {
    spawn,
    reattach,
    write,
    resize,
    kill,
    detach,
    ptyId: ptyIdRef.current,
    isAlive: isAliveRef.current,
  };
}
