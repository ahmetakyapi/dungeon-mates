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

// Hybrid aim: the pointer only takes over once it has actually been moved, and
// control hands back to auto-target after this long idle. Keeps the default
// experience unchanged for players who never touch the mouse.
const AIM_IDLE_RELEASE_MS = 2000;
const AIM_ACTIVATE_PX = 4;

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

  // Hybrid aim state
  private canvas: HTMLCanvasElement | null = null;
  private pointerX = 0;
  private pointerY = 0;
  private pointerActive = false;
  private lastPointerMove = 0;
  private readonly handlePointerMove: (e: PointerEvent) => void;
  private readonly handlePointerDown: (e: PointerEvent) => void;

  // Gamepad state
  private gamepadIndex: number | null = null;
  private gamepadAttackPressed = false;
  private gamepadAbilityPressed = false;
  private gamepadInteractPressed = false;
  private prevGpDodge = false;
  private prevGpUltimate = false;

  // Bound handlers for clean detach
  private readonly handleKeyDown: (e: KeyboardEvent) => void;
  private readonly handleKeyUp: (e: KeyboardEvent) => void;
  private readonly handleBlur: () => void;
  private readonly handleGamepadConnected: (e: GamepadEvent) => void;
  private readonly handleGamepadDisconnected: (e: GamepadEvent) => void;

  private static isTypingTarget(target: EventTarget | null): boolean {
    const el = target as HTMLElement | null;
    if (!el || !el.tagName) return false;
    const tag = el.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
  }

  constructor(canvas?: HTMLCanvasElement) {
    this.canvas = canvas ?? null;

    this.handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return; // touch aims via the joystick
      const dx = e.clientX - this.pointerX;
      const dy = e.clientY - this.pointerY;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      // Require real movement before stealing aim from auto-target.
      if (Math.abs(dx) + Math.abs(dy) >= AIM_ACTIVATE_PX) {
        this.pointerActive = true;
        this.lastPointerMove = performance.now();
      }
    };

    this.handlePointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      this.pointerX = e.clientX;
      this.pointerY = e.clientY;
      this.pointerActive = true;
      this.lastPointerMove = performance.now();
      if (e.button === 0) {
        const now = performance.now();
        if (now - this.lastAttackTime >= ATTACK_DEBOUNCE_MS) {
          this.attackPressed = true;
          this.lastAttackTime = now;
        }
      }
    };
    this.handleKeyDown = (e: KeyboardEvent) => {
      // Listeners are on window, so without this guard typing in the chat box moved
      // the character and preventDefault ate the space/E/R characters outright.
      if (InputManager.isTypingTarget(e.target)) return;
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
      // Always clear on keyup, even from a text field — otherwise a key held while
      // focus moves into chat stays stuck down forever.
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
    window.addEventListener('pointermove', this.handlePointerMove);
    (this.canvas ?? window).addEventListener('pointerdown', this.handlePointerDown as EventListener);
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
    window.removeEventListener('pointermove', this.handlePointerMove);
    (this.canvas ?? window).removeEventListener('pointerdown', this.handlePointerDown as EventListener);
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
    // Edge-detect the gamepad buttons. isGamepadButtonDown is level-triggered, so
    // holding L1/R1 previously re-fired dodge and ultimate on every single frame.
    const gpDodgeDown = this.isGamepadButtonDown(4); // L1
    const gpUltDown = this.isGamepadButtonDown(5);   // R1
    const dodge = this.dodgePressed || (gpDodgeDown && !this.prevGpDodge);
    const ultimate = this.ultimatePressed || (gpUltDown && !this.prevGpUltimate);
    this.prevGpDodge = gpDodgeDown;
    this.prevGpUltimate = gpUltDown;
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

    return { dx, dy, attack, ability, interact, dodge, ultimate, sprint, toggleMap, aimAngle: this.getAimAngle() };
  }

  /**
   * Angle from the player (screen centre — the camera keeps them there) to the
   * pointer, or undefined to fall back to server-side auto-targeting.
   */
  private getAimAngle(): number | undefined {
    if (!this.pointerActive || !this.canvas) return undefined;
    if (performance.now() - this.lastPointerMove > AIM_IDLE_RELEASE_MS) {
      this.pointerActive = false;
      return undefined;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return undefined;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = this.pointerX - cx;
    const dy = this.pointerY - cy;
    if (Math.abs(dx) + Math.abs(dy) < 1) return undefined;
    return Math.atan2(dy, dx);
  }

  /** True while the player is manually aiming (renderer draws the reticle). */
  get isAiming(): boolean {
    return this.pointerActive;
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
