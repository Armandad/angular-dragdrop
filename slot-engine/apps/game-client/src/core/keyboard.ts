/**
 * Keyboard shortcut manager for the game client.
 *
 * Default bindings:
 * - Space: Spin / Stop / Collect
 * - G: Gamble (when available)
 * - A: Toggle Auto-Play
 * - I: Toggle Paytable Info
 * - H: Toggle History
 * - M: Toggle Mute
 * - F: Toggle Fullscreen
 * - +/-: Adjust bet
 * - Arrow Up/Down: Change active lines
 */
export type KeyAction =
  | 'spin'
  | 'gamble-red'
  | 'gamble-black'
  | 'collect'
  | 'auto-play'
  | 'toggle-info'
  | 'toggle-history'
  | 'toggle-mute'
  | 'toggle-fullscreen'
  | 'bet-up'
  | 'bet-down'
  | 'lines-up'
  | 'lines-down';

type KeyHandler = (action: KeyAction) => void;

const DEFAULT_BINDINGS: Record<string, KeyAction> = {
  ' ': 'spin',
  Enter: 'spin',
  r: 'gamble-red',
  b: 'gamble-black',
  c: 'collect',
  a: 'auto-play',
  i: 'toggle-info',
  h: 'toggle-history',
  m: 'toggle-mute',
  f: 'toggle-fullscreen',
  '+': 'bet-up',
  '=': 'bet-up',
  '-': 'bet-down',
  ArrowUp: 'lines-up',
  ArrowDown: 'lines-down',
};

export class KeyboardManager {
  private bindings: Record<string, KeyAction>;
  private handlers: KeyHandler[] = [];
  private enabled = true;

  constructor(customBindings?: Partial<Record<string, KeyAction>>) {
    this.bindings = { ...DEFAULT_BINDINGS, ...customBindings };

    document.addEventListener('keydown', (e) => this.onKeyDown(e));
  }

  onAction(handler: KeyHandler): void {
    this.handlers.push(handler);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.enabled) return;

    // Don't capture if typing in an input
    if (
      e.target instanceof HTMLInputElement ||
      e.target instanceof HTMLTextAreaElement
    ) {
      return;
    }

    const action = this.bindings[e.key];
    if (action) {
      e.preventDefault();
      for (const handler of this.handlers) {
        handler(action);
      }
    }
  }
}
