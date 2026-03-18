import { useRef, useCallback, useEffect } from "react";
import { Channel } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import {
  ptySpawn,
  ptyWrite,
  ptyResize,
  ptyKill,
  ptyReattach,
  ptyTmuxAvailable,
} from "../lib/ipc";
import type { PtyEvent } from "../lib/ipc";

interface UsePtyReturn {
  spawn: (cwd: string, cols: number, rows: number, term: Terminal) => Promise<string>;
  reattach: (
    nodeId: string,
    cols: number,
    rows: number,
    term: Terminal,
  ) => Promise<boolean>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  ptyId: string | null;
  isAlive: boolean;
}

/** Module-level cache for tmux availability (checked once per session). */
let tmuxAvailableCache: boolean | null = null;

async function isTmuxAvailable(): Promise<boolean> {
  if (tmuxAvailableCache !== null) return tmuxAvailableCache;
  try {
    tmuxAvailableCache = await ptyTmuxAvailable();
  } catch {
    tmuxAvailableCache = false;
  }
  return tmuxAvailableCache;
}

export function usePty(): UsePtyReturn {
  const ptyIdRef = useRef<string | null>(null);
  const isAliveRef = useRef(false);
  // Keep a ref to force re-renders when state changes
  const renderRef = useRef(0);
  // Prevent double-spawn in React strict mode
  const spawnLock = useRef(false);

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
        return ptyIdRef.current ?? "";
      }
      spawnLock.current = true;

      const channel = createChannel(term);
      const id = await ptySpawn(cwd, cols, rows, channel);
      ptyIdRef.current = id;
      isAliveRef.current = true;
      renderRef.current += 1;

      wireInput(term);
      return id;
    },
    [createChannel, wireInput],
  );

  /**
   * Attempt to reattach to an existing tmux session for a restored node.
   * Returns true if reattach succeeded, false if caller should fall back to spawn.
   */
  const reattach = useCallback(
    async (
      nodeId: string,
      cols: number,
      rows: number,
      term: Terminal,
    ): Promise<boolean> => {
      if (spawnLock.current) return false;
      spawnLock.current = true;

      const tmuxOk = await isTmuxAvailable();
      if (!tmuxOk) {
        spawnLock.current = false;
        return false;
      }

      const sessionName = `exc-${nodeId}`;
      const channel = createChannel(term);

      try {
        await ptyReattach(nodeId, sessionName, cols, rows, channel);
        ptyIdRef.current = nodeId;
        isAliveRef.current = true;
        renderRef.current += 1;
        wireInput(term);
        return true;
      } catch {
        // Session doesn't exist or reattach failed -- caller should fall back to spawn
        spawnLock.current = false;
        return false;
      }
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
      renderRef.current += 1;
    }
    spawnLock.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (ptyIdRef.current && isAliveRef.current) {
        isAliveRef.current = false;
        ptyKill(ptyIdRef.current);
      }
      spawnLock.current = false;
    };
  }, []);

  return {
    spawn,
    reattach,
    write,
    resize,
    kill,
    ptyId: ptyIdRef.current,
    isAlive: isAliveRef.current,
  };
}
