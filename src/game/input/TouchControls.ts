// ==========================================
// Dungeon Mates — Touch Controls (Premium Mobile UX)
// Floating joystick + glass action buttons + multi-touch
// Always-visible joystick base, HP bar, cooldown arcs,
// pulse-ready indicators, safe area support
// ==========================================

import type { PlayerInput } from '../../../shared/types';

// --- Constants ---
const JOYSTICK_OUTER_RADIUS = 58;
const JOYSTICK_INNER_RADIUS = 26;
const JOYSTICK_DEADZONE = 0.15;
const JOYSTICK_EASE = 0.3;

const ATTACK_BTN_RADIUS = 40;
const SKILL_BTN_RADIUS = 32;
const INTERACT_BTN_RADIUS = 26;
const BUTTON_HIT_EXTRA = 20; // Fat finger tolerance

const HAPTIC_DURATION = 12;
const HAPTIC_STRONG = 25; // Stronger haptic for attack

// --- Colors (premium glass theme) ---
const COLOR_BG_DARK = 'rgba(4,7,13,0.45)';
const COLOR_BORDER_SUBTLE = 'rgba(148,163,184,0.12)';
const COLOR_WHITE_5 = 'rgba(255,255,255,0.05)';
const COLOR_WHITE_8 = 'rgba(255,255,255,0.08)';
const COLOR_WHITE_12 = 'rgba(255,255,255,0.12)';
const COLOR_WHITE_20 = 'rgba(255,255,255,0.2)';
const COLOR_WHITE_35 = 'rgba(255,255,255,0.35)';
const COLOR_WHITE_50 = 'rgba(255,255,255,0.5)';
const COLOR_WHITE_70 = 'rgba(255,255,255,0.7)';
const COLOR_ACCENT = 'rgba(139,92,246,';  // purple base (append alpha)
const COLOR_RED = 'rgba(239,68,68,';
const COLOR_BLUE = 'rgba(59,130,246,';
const COLOR_GREEN = 'rgba(16,185,129,';
const COLOR_GOLD = 'rgba(245,158,11,';

// HP bar colors
const HP_GREEN = '#4ade80';
const HP_YELLOW = '#fbbf24';
const HP_RED = '#ef4444';
const HP_BG = 'rgba(39,39,42,0.8)';

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

  // Button animation state (0-1)
  private attackPressAnim = 0;
  private skillPressAnim = 0;
  private interactPressAnim = 0;

  // Interact button visibility
  private _interactVisible = false;

  // Cooldown display (0-1, 0 = ready)
  private _attackCooldown = 0;
  private _skillCooldown = 0;

  // Player HP display
  private _playerHp = 100;
  private _playerMaxHp = 100;

  private attached = false;
  private canvasWidth = 0;
  private canvasHeight = 0;
  private isLandscape = false;

  // Button positions
  private attackBtnX = 0;
  private attackBtnY = 0;
  private skillBtnX = 0;
  private skillBtnY = 0;
  private interactBtnX = 0;
  private interactBtnY = 0;

  // Joystick base position
  private joystickBaseX = 0;
  private joystickBaseY = 0;

  // Pinch-to-zoom
  private pinchStartDist = 0;
  private pinchStartZoom = 1;
  private _zoom = 1;
  private pinchTouchIds: number[] = [];

  // Animations
  private joystickActiveAnim = 0;
  private readyPulseTimer = 0;

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

  attach(): void {
    if (this.attached) return;
    this.canvas.addEventListener('touchstart', this.handleTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.handleTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.handleTouchEnd, { passive: false });
    this.canvas.addEventListener('touchcancel', this.handleTouchEnd, { passive: false });
    window.addEventListener('resize', this.handleResize);
    window.addEventListener('orientationchange', this.handleResize);
    this.resizeOverlay();
    this.attached = true;
  }

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

  getInput(): PlayerInput {
    const input: PlayerInput = {
      dx: this.smoothDx,
      dy: this.smoothDy,
      attack: this.attackPressed,
      ability: this.skillPressed,
      interact: this.interactPressed,
    };
    this.attackPressed = false;
    this.skillPressed = false;
    this.interactPressed = false;
    return input;
  }

  set interactVisible(val: boolean) { this._interactVisible = val; }
  set attackCooldown(val: number) { this._attackCooldown = Math.max(0, Math.min(1, val)); }
  set skillCooldown(val: number) { this._skillCooldown = Math.max(0, Math.min(1, val)); }
  get zoom(): number { return this._zoom; }

  /** Set player HP for the mini HP bar near joystick */
  setPlayerHp(hp: number, maxHp: number): void {
    this._playerHp = hp;
    this._playerMaxHp = maxHp;
  }

  /** Update smoothing + animations — call once per frame */
  update(dt: number): void {
    // Smooth joystick
    this.smoothDx += (this.rawDx - this.smoothDx) * JOYSTICK_EASE;
    this.smoothDy += (this.rawDy - this.smoothDy) * JOYSTICK_EASE;
    if (Math.abs(this.smoothDx) < 0.01) this.smoothDx = 0;
    if (Math.abs(this.smoothDy) < 0.01) this.smoothDy = 0;

    // Button press animations
    const pressTarget = (id: number | null) => (id !== null ? 1 : 0);
    this.attackPressAnim += (pressTarget(this.state.attackId) - this.attackPressAnim) * 0.3;
    this.skillPressAnim += (pressTarget(this.state.skillId) - this.skillPressAnim) * 0.3;
    this.interactPressAnim += (pressTarget(this.state.interactId) - this.interactPressAnim) * 0.3;

    // Joystick active fade
    const joystickTarget = this.state.joystickId !== null ? 1 : 0;
    this.joystickActiveAnim += (joystickTarget - this.joystickActiveAnim) * 0.25;

    // Ready pulse timer (for attack/skill ready glow)
    this.readyPulseTimer += dt * 3;
    if (this.readyPulseTimer > Math.PI * 2) this.readyPulseTimer -= Math.PI * 2;
  }

  /** Render the touch overlay UI */
  render(): void {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

    // Always-visible joystick base
    this.drawJoystickBase(ctx);

    // Active floating joystick
    if (this.state.joystickOrigin && this.state.joystickThumb) {
      this.drawJoystick(ctx);
    }

    // Mini HP bar near joystick
    this.drawMiniHpBar(ctx);

    // Action buttons
    this.drawAttackButton(ctx);
    this.drawSkillButton(ctx);

    // Interact button (conditional)
    if (this._interactVisible) {
      this.drawInteractButton(ctx);
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

      // Pinch-to-zoom
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

      // Attack button
      if (this.hitTestCircle(x, y, this.attackBtnX, this.attackBtnY, ATTACK_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.attackId = t.identifier;
        this.attackPressed = true;
        this.haptic(HAPTIC_STRONG);
        continue;
      }

      // Skill button
      if (this.hitTestCircle(x, y, this.skillBtnX, this.skillBtnY, SKILL_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.skillId = t.identifier;
        this.skillPressed = true;
        this.haptic(HAPTIC_DURATION);
        continue;
      }

      // Interact button
      if (this._interactVisible && this.hitTestCircle(x, y, this.interactBtnX, this.interactBtnY, INTERACT_BTN_RADIUS + BUTTON_HIT_EXTRA)) {
        this.state.interactId = t.identifier;
        this.interactPressed = true;
        this.haptic(HAPTIC_DURATION);
        continue;
      }

      // Left half: floating joystick
      if (x < this.canvasWidth * 0.55 && this.state.joystickId === null) {
        this.state.joystickId = t.identifier;
        this.state.joystickOrigin = { x, y };
        this.state.joystickThumb = { x, y };
        this.haptic(HAPTIC_DURATION);
      }
    }
  }

  private onTouchMove(e: TouchEvent): void {
    e.preventDefault();
    e.stopPropagation();

    // Pinch-to-zoom
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
      if (t.identifier === this.state.attackId) this.state.attackId = null;
      if (t.identifier === this.state.skillId) this.state.skillId = null;
      if (t.identifier === this.state.interactId) this.state.interactId = null;
    }
  }

  // --- Drawing: Joystick ---

  private drawJoystickBase(ctx: CanvasRenderingContext2D): void {
    const bx = this.joystickBaseX;
    const by = this.joystickBaseY;
    const r = JOYSTICK_OUTER_RADIUS;

    if (this.joystickActiveAnim > 0.5) return;

    const alpha = 1 - this.joystickActiveAnim;
    ctx.save();
    ctx.globalAlpha = alpha;

    // Glass background
    ctx.beginPath();
    ctx.arc(bx, by, r, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_BG_DARK;
    ctx.fill();
    ctx.strokeStyle = COLOR_BORDER_SUBTLE;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Crosshair
    ctx.strokeStyle = COLOR_WHITE_8;
    ctx.lineWidth = 1;
    const gap = 14;
    const len = r - 16;

    ctx.beginPath();
    ctx.moveTo(bx - len, by); ctx.lineTo(bx - gap, by);
    ctx.moveTo(bx + gap, by); ctx.lineTo(bx + len, by);
    ctx.moveTo(bx, by - len); ctx.lineTo(bx, by - gap);
    ctx.moveTo(bx, by + gap); ctx.lineTo(bx, by + len);
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(bx, by, 5, 0, Math.PI * 2);
    ctx.fillStyle = COLOR_WHITE_8;
    ctx.fill();

    // Direction arrows (subtle)
    const arrowDist = r - 8;
    const arrowSize = 4;
    ctx.fillStyle = COLOR_WHITE_12;
    for (let a = 0; a < 4; a++) {
      const angle = a * Math.PI / 2;
      const ax = bx + Math.cos(angle) * arrowDist;
      const ay = by + Math.sin(angle) * arrowDist;
      ctx.beginPath();
      ctx.moveTo(ax + Math.cos(angle) * arrowSize, ay + Math.sin(angle) * arrowSize);
      ctx.lineTo(ax + Math.cos(angle + 2.4) * arrowSize, ay + Math.sin(angle + 2.4) * arrowSize);
      ctx.lineTo(ax + Math.cos(angle - 2.4) * arrowSize, ay + Math.sin(angle - 2.4) * arrowSize);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }

  private drawJoystick(ctx: CanvasRenderingContext2D): void {
    const o = this.state.joystickOrigin!;
    const t = this.state.joystickThumb!;
    const isActive = this.state.joystickId !== null;

    // Outer ring with glass effect
    ctx.beginPath();
    ctx.arc(o.x, o.y, JOYSTICK_OUTER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = isActive ? 'rgba(4,7,13,0.55)' : COLOR_BG_DARK;
    ctx.fill();
    ctx.strokeStyle = isActive ? `${COLOR_ACCENT}0.5)` : COLOR_WHITE_20;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Active outer glow
    if (isActive) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, JOYSTICK_OUTER_RADIUS + 4, 0, Math.PI * 2);
      ctx.strokeStyle = `${COLOR_ACCENT}0.2)`;
      ctx.lineWidth = 6;
      ctx.stroke();
    }

    // Direction indicator arrow
    if (Math.abs(this.rawDx) > JOYSTICK_DEADZONE || Math.abs(this.rawDy) > JOYSTICK_DEADZONE) {
      const angle = Math.atan2(this.rawDy, this.rawDx);
      const indicatorDist = JOYSTICK_OUTER_RADIUS + 14;
      const ix = o.x + Math.cos(angle) * indicatorDist;
      const iy = o.y + Math.sin(angle) * indicatorDist;
      const as = 7;

      ctx.beginPath();
      ctx.moveTo(ix + Math.cos(angle) * as, iy + Math.sin(angle) * as);
      ctx.lineTo(ix + Math.cos(angle + 2.5) * as, iy + Math.sin(angle + 2.5) * as);
      ctx.lineTo(ix + Math.cos(angle - 2.5) * as, iy + Math.sin(angle - 2.5) * as);
      ctx.closePath();
      ctx.fillStyle = `${COLOR_ACCENT}0.5)`;
      ctx.fill();
    }

    // Inner thumb with radial gradient
    const thumbGrad = ctx.createRadialGradient(t.x, t.y, 0, t.x, t.y, JOYSTICK_INNER_RADIUS);
    thumbGrad.addColorStop(0, isActive ? COLOR_WHITE_70 : COLOR_WHITE_50);
    thumbGrad.addColorStop(1, isActive ? COLOR_WHITE_35 : COLOR_WHITE_20);
    ctx.beginPath();
    ctx.arc(t.x, t.y, JOYSTICK_INNER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = thumbGrad;
    ctx.fill();
    ctx.strokeStyle = COLOR_WHITE_35;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight
    ctx.beginPath();
    ctx.arc(t.x - 3, t.y - 3, JOYSTICK_INNER_RADIUS * 0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
  }

  // --- Drawing: Mini HP Bar ---

  private drawMiniHpBar(ctx: CanvasRenderingContext2D): void {
    const bx = this.joystickBaseX;
    const by = this.joystickBaseY;
    const barW = JOYSTICK_OUTER_RADIUS * 2 - 8;
    const barH = 6;
    const barX = bx - barW / 2;
    const barY = by + JOYSTICK_OUTER_RADIUS + 12;

    const hpPct = this._playerMaxHp > 0
      ? Math.max(0, Math.min(1, this._playerHp / this._playerMaxHp))
      : 0;

    // Background
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.fillStyle = HP_BG;
    ctx.fill();

    // HP fill
    if (hpPct > 0) {
      const fillW = barW * hpPct;
      const hpColor = hpPct > 0.5 ? HP_GREEN : hpPct > 0.25 ? HP_YELLOW : HP_RED;
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH, 3);
      ctx.fillStyle = hpColor;
      ctx.fill();

      // Shine overlay
      ctx.beginPath();
      ctx.roundRect(barX, barY, fillW, barH / 2, [3, 3, 0, 0]);
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.fill();
    }

    // Border
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 3);
    ctx.strokeStyle = COLOR_BORDER_SUBTLE;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Low HP pulse
    if (hpPct > 0 && hpPct < 0.25) {
      const pulse = Math.sin(this.readyPulseTimer * 2) * 0.3 + 0.3;
      ctx.beginPath();
      ctx.roundRect(barX - 2, barY - 2, barW + 4, barH + 4, 5);
      ctx.strokeStyle = `rgba(239,68,68,${pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  // --- Drawing: Action Buttons ---

  private drawAttackButton(ctx: CanvasRenderingContext2D): void {
    const x = this.attackBtnX;
    const y = this.attackBtnY;
    const r = ATTACK_BTN_RADIUS;
    const isReady = this._attackCooldown === 0;
    const readyPulse = isReady ? Math.sin(this.readyPulseTimer) * 0.15 + 0.85 : 1;

    this.drawGlassButton(ctx, x, y, r, this.attackPressAnim, COLOR_RED, readyPulse);

    // Cooldown arc
    if (this._attackCooldown > 0) {
      this.drawCooldownArc(ctx, x, y, r, this._attackCooldown);
    }

    // Icon
    ctx.font = `${24}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('⚔️', x, y);

    // Label
    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.fillText('Saldır', x, y + r + 8);
  }

  private drawSkillButton(ctx: CanvasRenderingContext2D): void {
    const x = this.skillBtnX;
    const y = this.skillBtnY;
    const r = SKILL_BTN_RADIUS;
    const isReady = this._skillCooldown === 0;
    const readyPulse = isReady ? Math.sin(this.readyPulseTimer) * 0.2 + 0.8 : 1;

    this.drawGlassButton(ctx, x, y, r, this.skillPressAnim, COLOR_ACCENT, readyPulse);

    // Cooldown arc
    if (this._skillCooldown > 0) {
      this.drawCooldownArc(ctx, x, y, r, this._skillCooldown);
    }

    // Ready glow ring
    if (isReady) {
      const glowAlpha = Math.sin(this.readyPulseTimer) * 0.3 + 0.3;
      ctx.beginPath();
      ctx.arc(x, y, r + 5, 0, Math.PI * 2);
      ctx.strokeStyle = `${COLOR_GREEN}${glowAlpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    // Icon
    ctx.font = `${20}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('✨', x, y);

    // Label
    ctx.font = '9px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isReady ? `${COLOR_GREEN}0.6)` : 'rgba(255,255,255,0.4)';
    ctx.fillText(isReady ? 'Hazır!' : 'Yetenek', x, y + r + 8);
  }

  private drawInteractButton(ctx: CanvasRenderingContext2D): void {
    const x = this.interactBtnX;
    const y = this.interactBtnY;
    const r = INTERACT_BTN_RADIUS;

    // Pulsing appear animation
    const pulse = Math.sin(this.readyPulseTimer * 2) * 0.1 + 0.9;
    this.drawGlassButton(ctx, x, y, r, this.interactPressAnim, COLOR_BLUE, pulse);

    // Beacon ring
    const beaconAlpha = Math.sin(this.readyPulseTimer * 2) * 0.3 + 0.4;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.strokeStyle = `${COLOR_BLUE}${beaconAlpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Icon
    ctx.font = `${16}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('🔑', x, y);

    // Label
    ctx.font = '8px sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillStyle = `${COLOR_BLUE}0.6)`;
    ctx.fillText('Etkileşim', x, y + r + 6);
  }

  /** Draw a glass-morphism button */
  private drawGlassButton(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    pressAnim: number,
    colorBase: string,
    readyPulse: number,
  ): void {
    const scale = (1 - pressAnim * 0.12) * readyPulse;
    const r = radius * scale;

    ctx.save();

    // Outer glow when pressed
    if (pressAnim > 0.2) {
      ctx.beginPath();
      ctx.arc(x, y, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = `${colorBase}${pressAnim * 0.2})`;
      ctx.fill();
    }

    // Glass background
    const bgGrad = ctx.createRadialGradient(x, y - r * 0.3, 0, x, y, r);
    bgGrad.addColorStop(0, pressAnim > 0.3 ? `${colorBase}0.35)` : `${colorBase}0.15)`);
    bgGrad.addColorStop(1, pressAnim > 0.3 ? `${colorBase}0.2)` : `${colorBase}0.08)`);

    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = bgGrad;
    ctx.fill();

    // Glass border
    ctx.strokeStyle = `${colorBase}${pressAnim > 0.3 ? 0.6 : 0.35})`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner highlight (top shine)
    ctx.beginPath();
    ctx.arc(x, y - r * 0.2, r * 0.75, Math.PI, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fill();

    ctx.restore();
  }

  /** Draw cooldown arc overlay */
  private drawCooldownArc(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    radius: number,
    cooldown: number,
  ): void {
    ctx.save();

    // Dark overlay
    ctx.beginPath();
    ctx.moveTo(x, y);
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (Math.PI * 2 * cooldown);
    ctx.arc(x, y, radius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();

    // Progress arc border
    ctx.beginPath();
    ctx.arc(x, y, radius - 1, startAngle, endAngle);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Cooldown percentage text
    const pct = Math.ceil(cooldown * 100);
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(`${pct}%`, x, y + radius * 0.25);

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
      jdx = (jdx / dist) * JOYSTICK_OUTER_RADIUS;
      jdy = (jdy / dist) * JOYSTICK_OUTER_RADIUS;
      this.state.joystickThumb = {
        x: origin.x + jdx,
        y: origin.y + jdy,
      };
    }

    this.rawDx = jdx / JOYSTICK_OUTER_RADIUS;
    this.rawDy = jdy / JOYSTICK_OUTER_RADIUS;

    if (Math.abs(this.rawDx) < JOYSTICK_DEADZONE) this.rawDx = 0;
    if (Math.abs(this.rawDy) < JOYSTICK_DEADZONE) this.rawDy = 0;
  }

  private haptic(duration: number): void {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(duration);
      }
    } catch {
      // Silently ignore
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

    // Safe area offsets (approximate, CSS env() not directly accessible)
    const safeBottom = this.isLandscape ? 16 : 28;
    const safeRight = this.isLandscape ? 28 : 20;
    const safeLeft = 20;

    // Button positions (bottom-right cluster)
    const bottomPad = safeBottom + 32;
    const rightPad = safeRight + 16;

    // Attack button: large, bottom-right
    this.attackBtnX = this.canvasWidth - ATTACK_BTN_RADIUS - rightPad;
    this.attackBtnY = this.canvasHeight - ATTACK_BTN_RADIUS - bottomPad;

    // Skill button: arc layout, upper-left of attack
    this.skillBtnX = this.attackBtnX - ATTACK_BTN_RADIUS - SKILL_BTN_RADIUS + 2;
    this.skillBtnY = this.attackBtnY - ATTACK_BTN_RADIUS - SKILL_BTN_RADIUS - 6;

    // Interact button: left of attack
    this.interactBtnX = this.attackBtnX - ATTACK_BTN_RADIUS - INTERACT_BTN_RADIUS - 14;
    this.interactBtnY = this.attackBtnY + 6;

    // Joystick base: bottom-left
    this.joystickBaseX = safeLeft + JOYSTICK_OUTER_RADIUS + 28;
    this.joystickBaseY = this.canvasHeight - bottomPad - JOYSTICK_OUTER_RADIUS - 10;
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
