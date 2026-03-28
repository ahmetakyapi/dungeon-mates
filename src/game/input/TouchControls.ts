// ==========================================
// Dungeon Mates — Touch Controls (Complete Rewrite)
// Floating joystick + action buttons + multi-touch
// ==========================================

import type { PlayerInput } from '../../../shared/types';

// --- Constants ---
const JOYSTICK_OUTER_RADIUS = 60;
const JOYSTICK_INNER_RADIUS = 20;
const JOYSTICK_DEADZONE = 0.12;
const JOYSTICK_EASE = 0.25; // Smoothing factor per frame

const ATTACK_BTN_RADIUS = 35;
const SKILL_BTN_RADIUS = 27;
const INTERACT_BTN_RADIUS = 15;
const BUTTON_HIT_EXTRA = 12; // Extra hit area around buttons

const HAPTIC_DURATION = 10; // ms

// Colors
const JOYSTICK_BG = 'rgba(255,255,255,0.08)';
const JOYSTICK_BG_ACTIVE = 'rgba(255,255,255,0.15)';
const JOYSTICK_RING = 'rgba(255,255,255,0.2)';
const JOYSTICK_RING_ACTIVE = 'rgba(139,92,246,0.5)';
const JOYSTICK_THUMB_COLOR = 'rgba(255,255,255,0.35)';
const JOYSTICK_THUMB_ACTIVE = 'rgba(255,255,255,0.55)';

const ATTACK_COLOR = 'rgba(239,68,68,0.15)';
const ATTACK_BORDER = 'rgba(239,68,68,0.4)';
const ATTACK_ACTIVE = 'rgba(239,68,68,0.35)';
const SKILL_COLOR = 'rgba(139,92,246,0.15)';
const SKILL_BORDER = 'rgba(139,92,246,0.4)';
const SKILL_ACTIVE = 'rgba(139,92,246,0.35)';
const INTERACT_COLOR = 'rgba(59,130,246,0.15)';
const INTERACT_BORDER = 'rgba(59,130,246,0.5)';
const INTERACT_ACTIVE = 'rgba(59,130,246,0.4)';

type TouchState = {
  joystickId: number | null;
  joystickOrigin: { x: number; y: number } | null;
  joystickThumb: { x: number; y: number } | null;
  attackId: number | null;
  skillId: number | null;
  interactId: number | null;
};

export class TouchControls {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly state: TouchState = {
    joystickId: null,
    joystickOrigin: null,
    joystickThumb: null,
    attackId: null,
    skillId: null,
    interactId: null,
  };

  // Smoothed joystick output
  private rawDx = 0;
  private rawDy = 0;
  private smoothDx = 0;
  private smoothDy = 0;

  // Edge-triggered actions
  private attackPressed = false;
  private skillPressed = false;
  private interactPressed = false;

  // Button animation state (0-1, 1 = fully pressed)
  private attackPressAnim = 0;
  private skillPressAnim = 0;
  private interactPressAnim = 0;

  // Interact button visibility
  private _interactVisible = false;

  // Cooldown display (0-1, 0 = ready)
  private _attackCooldown = 0;
  private _skillCooldown = 0;

  private attached = false;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private isLandscape = false;

  // Button positions (recalculated on resize)
  private attackBtnX = 0;
  private attackBtnY = 0;
  private skillBtnX = 0;
  private skillBtnY = 0;
  private interactBtnX = 0;
  private interactBtnY = 0;

  // Pinch-to-zoom state
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private _zoom = 1;
  private pinchTouchIds: number[] = [];

  // Bound handlers
  private readonly handleTouchStart: (e: TouchEvent) => void;
  private readonly handleTouchMove: (e: TouchEvent) => void;
  private readonly handleTouchEnd: (e: TouchEvent) => void;
  private readonly handleResize: () => void;

  constructor(overlayCanvas: HTMLCanvasElement) {
    this.canvas = overlayCanvas;
    const ctx = overlayCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D context for touch overlay');
    this.ctx = ctx;

    this.handleTouchStart = this.onTouchStart.bind(this);
    this.handleTouchMove = this.onTouchMove.bind(this);
    this.handleTouchEnd = this.onTouchEnd.bind(this);
    this.handleResize = () => this.resizeOverlay();
  }

  // --- Public API ---

  /** Attach touch event listeners */
  attach(): void {
    if (this.attached) return;
    // Prevent all default touch behaviors on the canvas
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.resizeOverlay();
    this.attached = true;
  }

  /** Detach touch event listeners */
  detach(): void {
    if (!this.attached) return;
    this.canvas.removeEventListener('touchstart', this.handleTouchStart);
    this.canvas.removeEventListener('touchmove', this.handleTouchMove);
    this.canvas.removeEventListener('touchend', this.handleTouchEnd);
    this.canvas.removeEventListener('touchcancel', this.handleTouchEnd);
    window.removeEventListener('resize', this.handleResize);
    window.removeEventListener('orientationchange', this.handleResize);
    this.resetState();
    this.attached = false;
  }

  /** Get current touch input (same format as InputManager) */
  getInput(): PlayerInput {
    const input: PlayerInput = {
      dx: this.smoothDx,
      dy: this.smoothDy,
      attack: this.attackPressed,
      ability: this.skillPressed,
      interact: this.interactPressed,
    };

    // Consume edge-triggered
    this.attackPressed = false;
    this.skillPressed = false;
    this.interactPressed = false;

    return input;
  }

  /** Set interact button visibility (from game logic — e.g. near chest/door) */
  set interactVisible(val: boolean) {
    this._interactVisible = val;
  }

  /** Set attack cooldown progress 0-1 */
  set attackCooldown(val: number) {
    this._attackCooldown = Math.max(0, Math.min(1, val));
  }

  /** Set skill cooldown progress 0-1 */
  set skillCooldown(val: number) {
    this._skillCooldown = Math.max(0, Math.min(1, val));
  }

  /** Get current pinch-zoom level */
  get zoom(): number {
    return this._zoom;
  }

  /** Update smoothing — call once per frame */
  update(_dt: number): void {
    // Smooth joystick input with easing
    this.smoothDx += (this.rawDx - this.smoothDx) * JOYSTICK_EASE;
    this.smoothDy += (this.rawDy - this.smoothDy) * JOYSTICK_EASE;

    // Snap to zero if very small
    if (Math.abs(this.smoothDx) < 0.01) this.smoothDx = 0;
    if (Math.abs(this.smoothDy) < 0.01) this.smoothDy = 0;

    // Animate button press states
    const pressTarget = (id: number | null) => (id !== null ? 1 : 0);
    this.attackPressAnim += (pressTarget(this.state.attackId) - this.attackPressAnim) * 0.3;
    this.skillPressAnim += (pressTarget(this.state.skillId) - this.skillPressAnim) * 0.3;
    this.interactPressAnim += (pressTarget(this.state.interactId) - this.interactPressAnim) * 0.3;
  }

  /** Render the touch overlay UI */
  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Draw joystick (only when active — floating mode)
    if (this.state.joystickOrigin && this.state.joystickThumb) {
      this.drawJoystick(ctx);
    }

    // Draw action buttons (always visible)
    this.drawActionButton(
      ctx,
      this.attackBtnX,
      this.attackBtnY,
      ATTACK_BTN_RADIUS,
      this.attackPressAnim,
      ATTACK_COLOR,
      ATTACK_BORDER,
      ATTACK_ACTIVE,
      '⚔️',
      20,
      this._attackCooldown,
    );

    this.drawActionButton(
      ctx,
      this.skillBtnX,
      this.skillBtnY,
      SKILL_BTN_RADIUS,
      this.skillPressAnim,
      SKILL_COLOR,
      SKILL_BORDER,
      SKILL_ACTIVE,
      '✨',
      16,
      this._skillCooldown,
    );

    // Interact button (only when near interactive object)
    if (this._interactVisible) {
      this.drawActionButton(
        ctx,
        this.interactBtnX,
        this.interactBtnY,
        INTERACT_BTN_RADIUS,
        this.interactPressAnim,
        INTERACT_COLOR,
        INTERACT_BORDER,
        INTERACT_ACTIVE,
        '🔑',
        12,
        0,
      );
    }
  }

  // --- Touch event handlers ---

  private onTouchStart(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      const x = t.clientX;
      const y = t.clientY;

      // Check pinch-to-zoom (2 finger gesture)
      if (e.touches.length === 2 && this.pinchTouchIds.length === 0) {
        const t0 = e.touches[0];
        const t1 = e.touches[1];
        this.pinchTouchIds = [t0.identifier, t1.identifier];
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        this.pinchStartDist = Math.sqrt(dx * dx + dy * dy);
        this.pinchStartZoom = this._zoom;
        return;
      }

      // Attack button hit test
      if (this.hitTestCircle(x, y, this.attackBtnX, this.attackBtnY, ATTACK_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.attackId = t.identifier;
        this.attackPressed = true;
        this.haptic();
        continue;
      }

      // Skill button hit test
      if (this.hitTestCircle(x, y, this.skillBtnX, this.skillBtnY, SKILL_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.skillId = t.identifier;
        this.skillPressed = true;
        this.haptic();
        continue;
      }

      // Interact button hit test
      if (this._interactVisible && this.hitTestCircle(x, y, this.interactBtnX, this.interactBtnY, INTERACT_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.interactId = t.identifier;
        this.interactPressed = true;
        this.haptic();
        continue;
      }

      // Left half: floating joystick — appears where player touches
      if (x < this.canvasWidth * 0.55 && this.state.joystickId === null) {
        this.state.joystickId = t.identifier;
        this.state.joystickOrigin = { x, y };
        this.state.joystickThumb = { x, y };
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Handle pinch-to-zoom
    if (this.pinchTouchIds.length === 2 && e.touches.length >= 2) {
      let t0: Touch | null = null;
      let t1: Touch | null = null;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i].identifier === this.pinchTouchIds[0]) t0 = e.touches[i];
        if (e.touches[i].identifier === this.pinchTouchIds[1]) t1 = e.touches[i];
      }
      if (t0 && t1) {
        const dx = t1.clientX - t0.clientX;
        const dy = t1.clientY - t0.clientY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (this.pinchStartDist > 0) {
          const scale = dist / this.pinchStartDist;
          this._zoom = Math.max(0.8, Math.min(1.5, this.pinchStartZoom * scale));
        }
      }
      return;
    }

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];
      if (t.identifier === this.state.joystickId && this.state.joystickOrigin) {
        this.state.joystickThumb = { x: t.clientX, y: t.clientY };
        this.updateJoystick();
      }
    }
  }

  private onTouchEnd(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    const touches = e.changedTouches;
    for (let i = 0; i < touches.length; i++) {
      const t = touches[i];

      // Pinch-to-zoom release
      if (this.pinchTouchIds.includes(t.identifier)) {
        this.pinchTouchIds = [];
        this.pinchStartDist = 0;
      }

      if (t.identifier === this.state.joystickId) {
        this.state.joystickId = null;
        this.state.joystickOrigin = null;
        this.state.joystickThumb = null;
        this.rawDx = 0;
        this.rawDy = 0;
      }
      if (t.identifier === this.state.attackId) {
        this.state.attackId = null;
      }
      if (t.identifier === this.state.skillId) {
        this.state.skillId = null;
      }
      if (t.identifier === this.state.interactId) {
        this.state.interactId = null;
      }
    }
  }

  // --- Drawing helpers ---

  private drawJoystick(ctx: CanvasRenderingContext2D): void {
    const o = this.state.joystickOrigin!;
    const t = this.state.joystickThumb!;
    const isActive = this.state.joystickId !== null;

    // Outer ring
    ctx.beginPath();
    ctx.arc(o.x, o.y, JOYSTICK_OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? JOYSTICK_BG_ACTIVE : JOYSTICK_BG;
    ctx.fill();
    ctx.strokeStyle = isActive ? JOYSTICK_RING_ACTIVE : JOYSTICK_RING;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Active glow on outer ring
    if (isActive) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, JOYSTICK_OUTER_RADIUS + 2, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(139,92,246,0.2)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }

    // Direction indicator (small arrow showing movement direction)
    if (Math.abs(this.rawDx) > JOYSTICK_DEADZONE || Math.abs(this.rawDy) > JOYSTICK_DEADZONE) {
      const angle = Math.atan2(this.rawDy, this.rawDx);
      const indicatorDist = JOYSTICK_OUTER_RADIUS + 10;
      const ix = o.x + Math.cos(angle) * indicatorDist;
      const iy = o.y + Math.sin(angle) * indicatorDist;
      const arrowSize = 5;

      ctx.beginPath();
      ctx.moveTo(
        ix + Math.cos(angle) * arrowSize,
        iy + Math.sin(angle) * arrowSize,
      );
      ctx.lineTo(
        ix + Math.cos(angle + 2.5) * arrowSize,
        iy + Math.sin(angle + 2.5) * arrowSize,
      );
      ctx.lineTo(
        ix + Math.cos(angle - 2.5) * arrowSize,
        iy + Math.sin(angle - 2.5) * arrowSize,
      );
      ctx.closePath();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
    }

    // Inner thumb
    ctx.beginPath();
    ctx.arc(t.x, t.y, JOYSTICK_INNER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? JOYSTICK_THUMB_ACTIVE : JOYSTICK_THUMB_COLOR;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private drawActionButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    pressAnim: number,
    bgColor: string,
    borderColor: string,
    activeColor: string,
    icon: string,
    iconSize: number,
    cooldown: number,
  ): void {
    // Scale animation (slight shrink on press)
    const scale = 1 - pressAnim * 0.1;
    const r = radius * scale;

    ctx.save();

    // Background circle
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = pressAnim > 0.3 ? activeColor : bgColor;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cooldown overlay (circular progress)
    if (cooldown > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      const startAngle = -Math.PI / 2;
      const endAngle = startAngle + (Math.PI * 2 * cooldown);
      ctx.arc(x, y, r, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fill();
    }

    // Icon
    ctx.font = `${iconSize}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icon, x, y);

    ctx.restore();
  }

  // --- Internal helpers ---

  private hitTestCircle(tx: number, ty: number, cx: number, cy: number, radius: number): boolean {
    const dx = tx - cx;
    const dy = ty - cy;
    return dx * dx + dy * dy <= radius * radius;
  }

  private updateJoystick(): void {
    const origin = this.state.joystickOrigin;
    const thumb = this.state.joystickThumb;
    if (!origin || !thumb) return;

    let jdx = thumb.x - origin.x;
    let jdy = thumb.y - origin.y;
    const dist = Math.sqrt(jdx * jdx + jdy * jdy);

    if (dist > JOYSTICK_OUTER_RADIUS) {
      // Clamp thumb to radius
      jdx = (jdx / dist) * JOYSTICK_OUTER_RADIUS;
      jdy = (jdy / dist) * JOYSTICK_OUTER_RADIUS;
      this.state.joystickThumb = {
        x: origin.x + jdx,
        y: origin.y + jdy,
      };
    }

    // Normalize to -1..1
    this.rawDx = jdx / JOYSTICK_OUTER_RADIUS;
    this.rawDy = jdy / JOYSTICK_OUTER_RADIUS;

    // Apply deadzone
    if (Math.abs(this.rawDx) < JOYSTICK_DEADZONE) this.rawDx = 0;
    if (Math.abs(this.rawDy) < JOYSTICK_DEADZONE) this.rawDy = 0;
  }

  private haptic(): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(HAPTIC_DURATION);
      }
    } catch {
      // Haptic not available — silently ignore
    }
  }

  private resizeOverlay(): void {
    const dpr = window.devicePixelRatio || 1;
    this.canvasWidth = window.innerWidth;
    this.canvasHeight = window.innerHeight;
    this.canvas.width = this.canvasWidth * dpr;
    this.canvas.height = this.canvasHeight * dpr;
    this.canvas.style.width = `${this.canvasWidth}px`;
    this.canvas.style.height = `${this.canvasHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    this.isLandscape = this.canvasWidth > this.canvasHeight && this.canvasHeight < 500;

    // Recalculate button positions
    const safeBottom = this.isLandscape ? 20 : 40;
    const safeRight = this.isLandscape ? 30 : 20;

    // Attack button: bottom-right
    this.attackBtnX = this.canvasWidth - ATTACK_BTN_RADIUS - safeRight;
    this.attackBtnY = this.canvasHeight - ATTACK_BTN_RADIUS - safeBottom;

    // Skill button: above attack button
    this.skillBtnX = this.attackBtnX - (this.isLandscape ? 10 : 20);
    this.skillBtnY = this.attackBtnY - ATTACK_BTN_RADIUS - SKILL_BTN_RADIUS - 15;

    // Interact button: left of attack button
    this.interactBtnX = this.attackBtnX - ATTACK_BTN_RADIUS - INTERACT_BTN_RADIUS - 20;
    this.interactBtnY = this.attackBtnY;
  }

  private resetState(): void {
    this.state.joystickId = null;
    this.state.joystickOrigin = null;
    this.state.joystickThumb = null;
    this.state.attackId = null;
    this.state.skillId = null;
    this.state.interactId = null;
    this.rawDx = 0;
    this.rawDy = 0;
    this.smoothDx = 0;
    this.smoothDy = 0;
    this.attackPressed = false;
    this.skillPressed = false;
    this.interactPressed = false;
    this.pinchTouchIds = [];
    this.pinchStartDist = 0;
  }
}
