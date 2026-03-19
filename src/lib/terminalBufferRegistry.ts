import type { Terminal } from "@xterm/xterm";

/**
 * Global registry mapping node IDs to their Terminal instances.
 * Used by persistence to capture scrollback buffers before saving.
 */
const registry = new Map<string, Terminal>();

export function registerTerminal(nodeId: string, term: Terminal): void {
  registry.set(nodeId, term);
}

export function unregisterTerminal(nodeId: string): void {
  registry.delete(nodeId);
}

/**
 * Capture the visible + scrollback content of a terminal as a string.
 * Returns up to maxLines lines of content.
 */
export function captureBuffer(nodeId: string, maxLines = 500): string | undefined {
  const term = registry.get(nodeId);
  if (!term) return undefined;

  const buf = term.buffer.active;
  const lines: string[] = [];
  const totalLines = buf.length;
  const start = Math.max(0, totalLines - maxLines);

  for (let i = start; i < totalLines; i++) {
    const line = buf.getLine(i);
    if (line) {
      lines.push(line.translateToString(true));
    }
  }

  // Trim trailing empty lines
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }

  return lines.length > 0 ? lines.join("\n") : undefined;
}

/**
 * Capture all registered terminal buffers.
 * Returns a map of nodeId → buffer content.
 */
export function captureAllBuffers(): Map<string, string> {
  const result = new Map<string, string>();
  for (const nodeId of registry.keys()) {
    const content = captureBuffer(nodeId);
    if (content) {
      result.set(nodeId, content);
    }
  }
  return result;
}
