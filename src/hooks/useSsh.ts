import { useRef, useCallback, useEffect } from "react";
import { Channel } from "@tauri-apps/api/core";
import type { Terminal } from "@xterm/xterm";
import {
  sshConnect,
  sshWrite,
  sshResize,
  sshDisconnect,
} from "../lib/ipc";
import type { SshEvent } from "../lib/ipc";

export interface UseSshReturn {
  connect: (
    connectionId: string,
    password: string | null,
    cols: number,
    rows: number,
    term: Terminal,
    directParams?: { host: string; port: number; user: string; keyPath?: string | null },
  ) => Promise<string>;
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  disconnect: () => void;
  sessionId: string | null;
  isAlive: boolean;
}

export function useSsh(): UseSshReturn {
  const sessionIdRef = useRef<string | null>(null);
  const isAliveRef = useRef(false);
  const renderRef = useRef(0);
  const spawnLock = useRef(false);

  /** Create a Channel wired to an xterm Terminal instance. */
  const createChannel = useCallback((term: Terminal): Channel<SshEvent> => {
    const channel = new Channel<SshEvent>();
    channel.onmessage = (event: SshEvent) => {
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

  /** Wire keyboard input from xterm to SSH session. */
  const wireInput = useCallback((term: Terminal) => {
    term.onData((data: string) => {
      if (sessionIdRef.current && isAliveRef.current) {
        sshWrite(sessionIdRef.current, new TextEncoder().encode(data));
      }
    });
  }, []);

  const connect = useCallback(
    async (
      connectionId: string,
      password: string | null,
      cols: number,
      rows: number,
      term: Terminal,
      directParams?: { host: string; port: number; user: string; keyPath?: string | null },
    ): Promise<string> => {
      if (spawnLock.current) {
        return sessionIdRef.current ?? "";
      }
      spawnLock.current = true;

      try {
        const channel = createChannel(term);
        const id = await sshConnect(connectionId, password, cols, rows, channel, directParams);
        sessionIdRef.current = id;
        isAliveRef.current = true;
        renderRef.current += 1;

        wireInput(term);
        return id;
      } finally {
        spawnLock.current = false;
      }
    },
    [createChannel, wireInput],
  );

  const write = useCallback((data: string) => {
    if (sessionIdRef.current && isAliveRef.current) {
      sshWrite(sessionIdRef.current, new TextEncoder().encode(data));
    }
  }, []);

  const resize = useCallback((cols: number, rows: number) => {
    if (sessionIdRef.current && isAliveRef.current) {
      sshResize(sessionIdRef.current, cols, rows);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (sessionIdRef.current && isAliveRef.current) {
      isAliveRef.current = false;
      sshDisconnect(sessionIdRef.current);
      sessionIdRef.current = null;
      renderRef.current += 1;
    }
    spawnLock.current = false;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (sessionIdRef.current && isAliveRef.current) {
        isAliveRef.current = false;
        sshDisconnect(sessionIdRef.current);
      }
      spawnLock.current = false;
    };
  }, []);

  return {
    connect,
    write,
    resize,
    disconnect,
    sessionId: sessionIdRef.current,
    isAlive: isAliveRef.current,
  };
}
