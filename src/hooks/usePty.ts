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
  spawn: (nodeId: string, cwd: string, cols: number, rows: number, term: Terminal) => Promise<string>;
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
  const renderRef = useRef(0);
  const sessionNameRef = useRef<string | null>(null);

  // Shared spawn promise: if a spawn is in-flight, the StrictMode remount
  // reuses it instead of creating a second PTY/tmux session.
  const spawnPromiseRef = useRef<Promise<string> | null>(null);
  // Same for reattach
  const reattachPromiseRef = useRef<Promise<void> | null>(null);

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

  const wireInput = useCallback((term: Terminal) => {
    term.onData((data: string) => {
      if (ptyIdRef.current && isAliveRef.current) {
        ptyWrite(ptyIdRef.current, new TextEncoder().encode(data));
      }
    });
  }, []);

  const spawn = useCallback(
    async (nodeId: string, cwd: string, cols: number, rows: number, term: Terminal): Promise<string> => {
      // If a spawn is already in flight (StrictMode remount while ptySpawn
      // is still async), wait for it to finish instead of spawning again.
      // The first mount's channel/wireInput won't work (that Terminal was
      // disposed), so we need to re-wire after awaiting.
      if (spawnPromiseRef.current) {
        console.log("[usePty] spawn() — reusing in-flight spawn promise (StrictMode remount)");
        const id = await spawnPromiseRef.current;

        // The first mount's Terminal was disposed by StrictMode cleanup.
        // Re-wire the NEW Terminal to the existing PTY via reattach.
        if (ptyIdRef.current && sessionNameRef.current) {
          try {
            // Detach first (the old attach from mount #1 has a dead channel)
            await ptyDetach(ptyIdRef.current).catch(() => {});
            await new Promise((r) => setTimeout(r, 50));
            const channel = createChannel(term);
            await ptyReattach(ptyIdRef.current, sessionNameRef.current, cols, rows, channel);
            isAliveRef.current = true;
            wireInput(term);
            console.log("[usePty] spawn() — re-wired to existing session after StrictMode remount");
          } catch (e) {
            console.warn("[usePty] spawn() — re-wire failed:", e);
          }
        }
        return id;
      }

      // No spawn in flight — do a fresh spawn using the node ID
      // so the tmux session name (exc-{nodeId}) matches on restore.
      const promise = (async () => {
        const channel = createChannel(term);
        const id = await ptySpawn(nodeId, cwd, cols, rows, channel);
        ptyIdRef.current = id;
        sessionNameRef.current = `exc-${id}`;
        isAliveRef.current = true;
        renderRef.current += 1;
        wireInput(term);
        console.log(`[usePty] spawn() — fresh spawn SUCCESS: ${id}`);
        return id;
      })();

      spawnPromiseRef.current = promise;
      return promise;
    },
    [createChannel, wireInput],
  );

  const reattach = useCallback(
    async (sessionName: string, cols: number, rows: number, term: Terminal): Promise<void> => {
      // Same pattern: reuse in-flight reattach promise
      if (reattachPromiseRef.current) {
        console.log("[usePty] reattach() — reusing in-flight promise (StrictMode remount)");
        await reattachPromiseRef.current;

        if (ptyIdRef.current && sessionNameRef.current) {
          try {
            await ptyDetach(ptyIdRef.current).catch(() => {});
            await new Promise((r) => setTimeout(r, 50));
            const channel = createChannel(term);
            await ptyReattach(ptyIdRef.current, sessionNameRef.current, cols, rows, channel);
            isAliveRef.current = true;
            wireInput(term);
            console.log("[usePty] reattach() — re-wired after StrictMode remount");
          } catch (e) {
            console.warn("[usePty] reattach() — re-wire failed:", e);
          }
        }
        return;
      }

      const promise = (async () => {
        const nodeId = sessionName.startsWith("exc-") ? sessionName.slice(4) : sessionName;
        const channel = createChannel(term);
        await ptyReattach(nodeId, sessionName, cols, rows, channel);
        ptyIdRef.current = nodeId;
        sessionNameRef.current = sessionName;
        isAliveRef.current = true;
        renderRef.current += 1;
        wireInput(term);
        console.log(`[usePty] reattach() — SUCCESS: ${sessionName}`);
      })();

      reattachPromiseRef.current = promise;
      return promise;
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
    console.log("[usePty] kill()");
    if (ptyIdRef.current && isAliveRef.current) {
      isAliveRef.current = false;
      ptyKill(ptyIdRef.current);
      ptyIdRef.current = null;
      sessionNameRef.current = null;
      renderRef.current += 1;
    }
    spawnPromiseRef.current = null;
    reattachPromiseRef.current = null;
  }, []);

  const detach = useCallback(() => {
    console.log(`[usePty] detach() — ptyId=${ptyIdRef.current}, alive=${isAliveRef.current}`);
    if (ptyIdRef.current && isAliveRef.current) {
      isAliveRef.current = false;
      ptyDetach(ptyIdRef.current);
      // Keep ptyIdRef, sessionNameRef, and promiseRefs intact
      // so StrictMode remount can re-wire to the same session.
      renderRef.current += 1;
    }
    // If ptyId is null, spawn is still in flight — that's fine,
    // the remount will pick it up via spawnPromiseRef.
  }, []);

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
