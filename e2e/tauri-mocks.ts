import { Page } from "@playwright/test";

/**
 * Injects Tauri API mocks into the page so the app can run in a browser context.
 * Must be called before navigating to the app (via page.addInitScript).
 */
export function getTauriMockScript(): string {
  return `
    // Mock window.__TAURI_INTERNALS__ so @tauri-apps/api detects a "Tauri" environment
    window.__TAURI_INTERNALS__ = {
      invoke: async (cmd, args) => {
        console.log('[TAURI MOCK] invoke:', cmd, args);

        // Route commands to mock handlers
        switch (cmd) {
          case 'state_load':
            // Return null = no persisted state, app starts fresh
            return null;

          case 'state_save':
            // Swallow saves silently
            return null;

          case 'pty_spawn':
            // Return a fake PTY ID
            return 'mock-pty-' + Date.now();

          case 'pty_write':
          case 'pty_resize':
          case 'pty_kill':
          case 'pty_reattach':
            return null;

          case 'pty_tmux_available':
            return false;

          case 'pty_ensure_tmux':
          case 'pty_tmux_cleanup':
            return null;

          case 'fs_read_dir':
            // Return a mock file tree
            return [
              { name: 'README.md', is_dir: false, path: args.path + '/README.md', size: 1024, created: Date.now(), modified: Date.now() },
              { name: 'src', is_dir: true, path: args.path + '/src', size: 0, created: Date.now(), modified: Date.now() },
              { name: 'package.json', is_dir: false, path: args.path + '/package.json', size: 512, created: Date.now(), modified: Date.now() },
              { name: 'image.png', is_dir: false, path: args.path + '/image.png', size: 2048, created: Date.now(), modified: Date.now() },
            ];

          case 'fs_create_file':
          case 'fs_create_dir':
          case 'fs_rename':
          case 'fs_delete':
          case 'fs_move':
            return null;

          case 'git_status':
            return { staged: [], unstaged: [], untracked: [] };

          case 'git_branches':
            return { current: 'main', branches: ['main'] };

          case 'git_log':
            return [];

          case 'git_stash_list':
            return [];

          case 'git_conflicts':
            return [];

          case 'ssh_load_connections':
            return { connections: [], groups: [] };

          default:
            console.warn('[TAURI MOCK] unhandled command:', cmd);
            return null;
        }
      },

      convertFileSrc: (path) => {
        return 'asset://localhost/' + encodeURIComponent(path);
      },

      metadata: {
        currentWindow: {
          label: 'main',
        },
        currentWebview: {
          label: 'main',
          windowLabel: 'main',
        },
      },
    };

    // Mock @tauri-apps/api/window
    window.__TAURI_INTERNALS__.invoke_key = 'mock';

    // Mock Channel class for PTY streaming
    class MockChannel {
      constructor() {
        this.id = 'mock-channel-' + Date.now();
        this._onmessage = null;
      }
      get onmessage() { return this._onmessage; }
      set onmessage(fn) { this._onmessage = fn; }
      toJSON() { return { id: this.id, __tauriChannel: true }; }
    }
    window.__TAURI_CHANNEL__ = MockChannel;

    // Mock getCurrentWindow for close handler
    if (!window.__TAURI_INTERNALS__.invoke) {
      window.__TAURI_INTERNALS__.invoke = async () => null;
    }
  `;
}

/**
 * Set up Tauri mocks on a Playwright page before navigation.
 */
export async function setupTauriMocks(page: Page): Promise<void> {
  await page.addInitScript(getTauriMockScript());
}
