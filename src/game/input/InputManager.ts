// ==========================================
// Dungeon Mates — Input Manager
// Keyboard + Gamepad support
// WASD/Arrows + Space/E/R/Shift/Tab
// ==========================================

import type { PlayerInput } from '../../../shared/types';

const KEY_BINDINGS = {
  up: ['ArrowUp', 'KeyW'] as const,
  down: ['ArrowDown', 'KeyS'] as const,
  left: ['ArrowLeft', 'KeyA'] as const,
  right: ['ArrowRight', 'KeyD'] as const,
  attack: ['Space'] as const,
  ability: ['KeyE'] as const,
  interact: ['KeyR'] as const,
  dodge: ['KeyQ'] as const,
  ultimate: ['KeyF'] as const,
  sprint: ['ShiftLeft', 'ShiftRight'] as const,
  toggleMap: ['Tab'] as const,
} as const;

const ATTACK_DEBOUNCE_MS = 200; // Auto-repeat rate when holding attack key

export class InputManager {
  private readonly keysDown: Set<string> = new Set();
  private attackPressed = false;
  private abilityPressed = false;
  private interactPressed = false;
  private dodgePressed = false;
  private ultimatePressed = false;
  private toggleMapPressed = false;
  private attached = false;

  // Attack debounce
  private lastAttackTime = 0;

  // Gamepad state
  private gamepadIndex: number | null = null;
  private gamepadAttackPressed = false;
  private gamepadAbilityPressed = false;
  private gamepadInteractPressed = false;

  // Bound handlers for clean detach
  private readonly handleKeyDown: (e: KeyboardEvent) => void;
  private readonly handleKeyUp: (e: KeyboardEvent) => void;
  private readonly handleBlur: () => void;
  private readonly handleGamepadConnected: (e: GamepadEvent) => void;
  private readonly handleGamepadDisconnected: (e: GamepadEvent) => void;

  constructor(_canvas?: HTMLCanvasElement) {
    this.handleKeyDown = (e: KeyboardEvent) => {
      if (this.isGameKey(e.code)) {
        e.preventDefault();
      }
      this.keysDown.add(e.code);

      // Edge-triggered presses
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.attack)) {
        const now = performance.now();
        if (now - this.lastAttackTime >= ATTACK_DEBOUNCE_MS) {
          this.attackPressed = true;
          this.lastAttackTime = now;
        }
      }
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.ability)) {
        this.abilityPressed = true;
      }
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.interact)) {
        this.interactPressed = true;
      }
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.dodge)) {
        this.dodgePressed = true;
      }
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.ultimate)) {
        this.ultimatePressed = true;
      }
      if (this.isKeyInBinding(e.code, KEY_BINDINGS.toggleMap)) {
        this.toggleMapPressed = true;
      }
    };

    this.handleKeyUp = (e: KeyboardEvent) => {
      this.keysDown.delete(e.code);
    };

    this.handleBlur = () => {
      this.keysDown.clear();
    };

    this.handleGamepadConnected = (e: GamepadEvent) => {
      this.gamepadIndex = e.gamepad.index;
    };

    this.handleGamepadDisconnected = (e: GamepadEvent) => {
      if (this.gamepadIndex === e.gamepad.index) {
        this.gamepadIndex = null;
      }
    };

    // Auto-attach on construction
    this.attach();
  }

  /** Start listening for keyboard + gamepad events */
  attach(): void {
    if (this.attached) return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('gamepadconnected', this.handleGamepadConnected);
    window.addEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    this.attached = true;
  }

  /** Stop listening for all events */
  detach(): void {
    if (!this.attached) return;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('gamepadconnected', this.handleGamepadConnected);
    window.removeEventListener('gamepaddisconnected', this.handleGamepadDisconnected);
    this.keysDown.clear();
    this.attached = false;
  }

  /** Get current input state and consume edge-triggered actions */
  getInput(): PlayerInput {
    // Poll gamepad
    this.pollGamepad();

    let dx = 0;
    let dy = 0;

    if (this.isDown(KEY_BINDINGS.left)) dx -= 1;
    if (this.isDown(KEY_BINDINGS.right)) dx += 1;
    if (this.isDown(KEY_BINDINGS.up)) dy -= 1;
    if (this.isDown(KEY_BINDINGS.down)) dy += 1;

    // Merge gamepad axes
    const gpInput = this.getGamepadAxes();
    if (gpInput) {
      dx += gpInput.dx;
      dy += gpInput.dy;
      // Clamp
      dx = Math.max(-1, Math.min(1, dx));
      dy = Math.max(-1, Math.min(1, dy));
    }

    // Normalize diagonal movement (keyboard produces -1/0/1, so diagonal mag = sqrt(2))
    if (dx !== 0 && dy !== 0) {
      const INV_SQRT2 = 0.7071067811865476; // 1/sqrt(2) — constant for keyboard diagonals
      dx *= INV_SQRT2;
      dy *= INV_SQRT2;
    }

    // Sprint modifier
    const isSprinting = this.isDown(KEY_BINDINGS.sprint) || this.isGamepadButtonDown(10); // L3
    if (isSprinting && (dx !== 0 || dy !== 0)) {
      dx *= 1.2;
      dy *= 1.2;
    }

    // Auto-repeat attack when holding key (debounced)
    const holdingAttack = this.isDown(KEY_BINDINGS.attack) || this.isGamepadButtonDown(0);
    if (holdingAttack && !this.attackPressed && !this.gamepadAttackPressed) {
      const now = performance.now();
      if (now - this.lastAttackTime >= ATTACK_DEBOUNCE_MS) {
        this.attackPressed = true;
        this.lastAttackTime = now;
      }
    }
    const attack = this.attackPressed || this.gamepadAttackPressed;
    const ability = this.abilityPressed || this.gamepadAbilityPressed;
    const interact = this.interactPressed || this.gamepadInteractPressed;
    const dodge = this.dodgePressed || this.isGamepadButtonDown(4); // L1 for gamepad dodge
    const ultimate = this.ultimatePressed || this.isGamepadButtonDown(5); // R1 for gamepad ultimate
    const toggleMap = this.toggleMapPressed;
    const sprint = isSprinting;

    // Consume edge-triggered presses
    this.attackPressed = false;
    this.abilityPressed = false;
    this.interactPressed = false;
    this.dodgePressed = false;
    this.ultimatePressed = false;
    this.toggleMapPressed = false;
    this.gamepadAttackPressed = false;
    this.gamepadAbilityPressed = false;
    this.gamepadInteractPressed = false;

    return { dx, dy, attack, ability, interact, dodge, ultimate, sprint, toggleMap };
  }

  /** Check if device supports touch */
  get isTouch(): boolean {
    return InputManager.isTouchDevice();
  }

  /** Check if any key in the binding array is currently held */
  private isDown(keys: readonly string[]): boolean {
    for (let i = 0; i < keys.length; i++) {
      if (this.keysDown.has(keys[i])) return true;
    }
    return false;
  }

  private isKeyInBinding(code: string, binding: readonly string[]): boolean {
    return (binding as readonly string[]).includes(code);
  }

  /** Check if a key code is one of our game keys */
  private isGameKey(code: string): boolean {
    const allBindings = [
      KEY_BINDINGS.up,
      KEY_BINDINGS.down,
      KEY_BINDINGS.left,
      KEY_BINDINGS.right,
      KEY_BINDINGS.attack,
      KEY_BINDINGS.ability,
      KEY_BINDINGS.interact,
      KEY_BINDINGS.sprint,
      KEY_BINDINGS.toggleMap,
    ] as const;

    for (const binding of allBindings) {
      if (this.isKeyInBinding(code, binding)) return true;
    }
    return false;
  }

  // --- Gamepad support ---

  private pollGamepad(): void {
    if (this.gamepadIndex === null) return;
    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return;
      const gp = gamepads[this.gamepadIndex];
      if (!gp) return;

      // A/Cross button = attack (index 0)
      if (gp.buttons[0]?.pressed) {
        const now = performance.now();
        if (now - this.lastAttackTime >= ATTACK_DEBOUNCE_MS) {
          this.gamepadAttackPressed = true;
          this.lastAttackTime = now;
        }
      }

      // B/Circle = ability (index 1)
      if (gp.buttons[1]?.pressed) {
        this.gamepadAbilityPressed = true;
      }

      // X/Square = interact (index 2)
      if (gp.buttons[2]?.pressed) {
        this.gamepadInteractPressed = true;
      }
    } catch {
      // Gamepad API not available
    }
  }

  private getGamepadAxes(): { dx: number; dy: number } | null {
    if (this.gamepadIndex === null) return null;
    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return null;
      const gp = gamepads[this.gamepadIndex];
      if (!gp) return null;

      let gpDx = gp.axes[0] ?? 0;
      let gpDy = gp.axes[1] ?? 0;

      // Deadzone
      if (Math.abs(gpDx) < 0.15) gpDx = 0;
      if (Math.abs(gpDy) < 0.15) gpDy = 0;

      if (gpDx === 0 && gpDy === 0) return null;
      return { dx: gpDx, dy: gpDy };
    } catch {
      return null;
    }
  }

  private isGamepadButtonDown(index: number): boolean {
    if (this.gamepadIndex === null) return false;
    try {
      const gamepads = navigator.getGamepads();
      if (!gamepads) return false;
      const gp = gamepads[this.gamepadIndex];
      return gp?.buttons[index]?.pressed ?? false;
    } catch {
      return false;
    }
  }

  /** Alias for detach */
  destroy(): void {
    this.detach();
  }

  /** Check if device supports touch (for showing touch controls) */
  static isTouchDevice(): boolean {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }
}
