'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PixelButton } from '@/components/ui/PixelButton';

const EASE = [0.22, 1, 0.36, 1] as const;

type PrologueCinematicProps = {
  onComplete: () => void;
};

type Scene = 'darkness' | 'king' | 'ritual' | 'catastrophe' | 'corruption' | 'present';

// ── Pixel art drawing helpers (same approach as SpriteRenderer) ──
const px = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) => {
  ctx.fillStyle = color;
  ctx.fillRect(Math.floor(x), Math.floor(y), w, h);
};

// ── Scene timings (ms) ──
const SCENE_TIMINGS: Record<Scene, number> = {
  darkness: 5000,
  king: 10000,
  ritual: 7500,
  catastrophe: 6500,
  corruption: 7000,
  present: 0,
};

const AUTO_SKIP_MS = 50000;

// ── Dialogue per scene ──
const SCENE_DIALOGUE: Record<Scene, readonly string[]> = {
  darkness: [],
  king: [
    'Ateş sönüyor. Hesaplarım doğru. İki yüz yıl içinde Zephara karanlığa gömülecek.',
    'Kimse dinlemiyor. Ama ben görüyorum — her gün biraz daha soğuk, biraz daha karanlık.',
    'Başka yol yok. Bedenimi yakıt olarak sunacağım. Halkım için... her şey halkım için.',
  ],
  ritual: [
    'Ateş yanıt veriyor... Çekirdek titriyor...',
    'Bağlantı kuruldu! Enerji akıyor... Evet! EVET!',
  ],
  catastrophe: [
    '...Hayır.',
    'Bu olmamalıydı. Ateş... kontrol edemiyorum!',
    'Halkım... ne yaptım size... NE YAPTIM?!',
  ],
  corruption: [
    'Zephara\'nın halkı uyandığında insan değildi artık.',
    'Kral Karanmir tahtında oturdu — ne tamamen diri, ne tamamen ölü.',
    'Altı yüz yıl boyunca... her saniyesini hatırlayarak, acı çekerek.',
  ],
  present: [
    'Altı yüz yıl geçti.',
    'Zephara bir mezar oldu — halkı canavar, kralı lanet.',
    'Ama bugün, kapılar yeniden açılıyor.',
    'Ve sen... ilk adımı atan kişisin.',
  ],
} as const;

// ── Line timing ──
const LINE_DELAYS: Partial<Record<Scene, { first: number; rest: number }>> = {
  king: { first: 1800, rest: 2500 },
  ritual: { first: 1200, rest: 2500 },
  catastrophe: { first: 600, rest: 2000 },
  corruption: { first: 1200, rest: 2200 },
  present: { first: 800, rest: 1800 },
};

// ── Particle type ──
type Particle = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
  color: string;
};

function generateParticles(count: number, colors: string[]): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 3,
    duration: 2 + Math.random() * 4,
    delay: Math.random() * 2,
    color: colors[i % colors.length],
  }));
}

// ══════════════════════════════════════════════════
//  PIXEL ART CANVAS — Animated characters
// ══════════════════════════════════════════════════

function PixelCanvas({
  draw,
  width,
  height,
  scale = 4,
  className = '',
}: {
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void;
  width: number;
  height: number;
  scale?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;

    let lastTime = 0;
    const FPS = 12; // Pixel art frame rate
    const interval = 1000 / FPS;

    const loop = (time: number) => {
      rafRef.current = requestAnimationFrame(loop);
      if (time - lastTime < interval) return;
      lastTime = time;

      ctx.clearRect(0, 0, width, height);
      draw(ctx, frameRef.current);
      frameRef.current++;
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [draw, width, height]);

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      className={className}
      style={{
        width: width * scale,
        height: height * scale,
        imageRendering: 'pixelated',
      }}
    />
  );
}

// ── Draw Karanmir (human king, before corruption) ──
function drawKaranmir(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const breathe = Math.sin(frame * 0.21) * 0.4;

  // Royal purple cape
  const capeWave = Math.sin(frame * 0.5) * 1;
  px(ctx, x + 5, y + 7 + breathe, 6, 5, '#4c1d95');
  px(ctx, x + 4 + capeWave * 0.3, y + 10 + breathe, 8, 3, '#3b0764');
  px(ctx, x + 5, y + 11 + breathe, 1, 1, '#2e1065');
  px(ctx, x + 10, y + 11 + breathe, 1, 1, '#2e1065');
  // Cape gold trim
  px(ctx, x + 4, y + 12 + breathe, 8, 1, '#fbbf24');

  // Legs
  px(ctx, x + 5, y + 12, 2, 3, '#1e1b4b');
  px(ctx, x + 9, y + 12, 2, 3, '#1e1b4b');
  // Boots
  px(ctx, x + 4, y + 14, 3, 2, '#451a03');
  px(ctx, x + 9, y + 14, 3, 2, '#451a03');

  // Body — royal armor
  px(ctx, x + 4, y + 6 + breathe, 8, 5, '#fbbf24');
  px(ctx, x + 5, y + 6 + breathe, 6, 1, '#fde68a');
  px(ctx, x + 6, y + 8 + breathe, 4, 1, '#92400e');
  // Armor plate
  px(ctx, x + 7, y + 7 + breathe, 1, 3, '#d97706');

  // Arms
  px(ctx, x + 2, y + 6 + breathe, 2, 5, '#fbbf24');
  px(ctx, x + 12, y + 6 + breathe, 2, 5, '#fbbf24');
  // Hands
  px(ctx, x + 2, y + 10 + breathe, 2, 1, '#fcd5b4');
  px(ctx, x + 12, y + 10 + breathe, 2, 1, '#fcd5b4');

  // Scepter in right hand
  px(ctx, x + 13, y + 2 + breathe, 1, 9, '#78350f');
  // Scepter gem
  const gemPulse = Math.sin(frame * 0.3) > 0.5;
  px(ctx, x + 12, y + 1 + breathe, 3, 2, gemPulse ? '#fde68a' : '#f59e0b');
  px(ctx, x + 13, y + 0 + breathe, 1, 1, gemPulse ? '#ffffff' : '#fde68a');

  // Head
  px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
  // Eyes
  px(ctx, x + 6, y + 3, 1, 1, '#1e1b4b');
  px(ctx, x + 9, y + 3, 1, 1, '#1e1b4b');
  // Brow (worried)
  px(ctx, x + 6, y + 2, 1, 1, '#d4a574');
  px(ctx, x + 9, y + 2, 1, 1, '#d4a574');
  // Beard
  px(ctx, x + 6, y + 5, 4, 2, '#374151');
  px(ctx, x + 7, y + 6, 2, 1, '#4b5563');

  // Crown
  px(ctx, x + 4, y + 1, 8, 2, '#fbbf24');
  px(ctx, x + 5, y + 0, 6, 1, '#fde68a');
  // Crown points
  px(ctx, x + 5, y - 1, 1, 1, '#fbbf24');
  px(ctx, x + 7, y - 2, 2, 2, '#fbbf24');
  px(ctx, x + 8, y - 3, 1, 1, '#fde68a');
  px(ctx, x + 10, y - 1, 1, 1, '#fbbf24');
  // Crown gem
  px(ctx, x + 7, y + 0, 2, 1, '#dc2626');
}

// ── Draw corrupted Karanmir (demon form, simplified boss) ──
function drawCorruptedKaranmir(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const pulse = Math.sin(frame * 0.3) * 2;

  // Fire aura
  ctx.globalAlpha = 0.1 + Math.sin(frame * 0.2) * 0.05;
  px(ctx, x - 2, y - 2, 20, 20, '#ef4444');
  ctx.globalAlpha = 1;

  // Wings
  px(ctx, x - 3, y + 3 + pulse, 4, 9, '#7f1d1d');
  px(ctx, x + 15, y + 3 - pulse, 4, 9, '#7f1d1d');
  // Wing veins
  px(ctx, x - 2, y + 5 + pulse, 1, 6, '#450a0a');
  px(ctx, x + 17, y + 5 - pulse, 1, 6, '#450a0a');

  // Body
  px(ctx, x + 2, y + 3, 12, 11, '#dc2626');
  px(ctx, x + 4, y + 4, 8, 4, '#b91c1c');
  // Lava cracks
  const crackGlow = Math.sin(frame * 0.5) > 0.5 ? '#fbbf24' : '#f97316';
  px(ctx, x + 6, y + 6, 1, 3, '#1a1a2e');
  px(ctx, x + 6, y + 7, 1, 1, crackGlow);
  px(ctx, x + 10, y + 7, 1, 3, '#1a1a2e');
  px(ctx, x + 10, y + 8, 1, 1, crackGlow);
  // Rune on chest
  ctx.globalAlpha = 0.4 + Math.sin(frame * 0.4) * 0.2;
  px(ctx, x + 7, y + 5, 2, 1, '#fbbf24');
  px(ctx, x + 6, y + 6, 4, 1, '#f97316');
  ctx.globalAlpha = 1;

  // Head
  px(ctx, x + 4, y + 0, 8, 4, '#dc2626');
  // Horns
  px(ctx, x + 2, y - 2, 2, 3, '#451a03');
  px(ctx, x + 1, y - 3, 1, 2, '#78350f');
  px(ctx, x + 12, y - 2, 2, 3, '#451a03');
  px(ctx, x + 14, y - 3, 1, 2, '#78350f');

  // Burning eyes
  const eyeColor = frame % 12 < 4 ? '#ef4444' : frame % 12 < 8 ? '#f97316' : '#fbbf24';
  px(ctx, x + 5, y + 1, 2, 2, '#000000');
  px(ctx, x + 9, y + 1, 2, 2, '#000000');
  px(ctx, x + 5, y + 1, 1, 1, eyeColor);
  px(ctx, x + 10, y + 1, 1, 1, eyeColor);

  // Mouth + fangs
  px(ctx, x + 6, y + 3, 4, 1, '#1a1a2e');
  px(ctx, x + 6, y + 3, 1, 1, '#ffffff');
  px(ctx, x + 9, y + 3, 1, 1, '#ffffff');

  // Arms + claws
  px(ctx, x + 0, y + 6, 3, 6, '#dc2626');
  px(ctx, x + 13, y + 6, 3, 6, '#dc2626');
  // Fire from hands
  ctx.globalAlpha = 0.6;
  px(ctx, x - 1, y + 12 + (frame % 3), 2, 1, '#fbbf24');
  px(ctx, x + 14, y + 12 + ((frame + 1) % 3), 2, 1, '#f97316');
  ctx.globalAlpha = 1;

  // Legs + hooves
  px(ctx, x + 4, y + 13, 3, 3, '#991b1b');
  px(ctx, x + 9, y + 13, 3, 3, '#991b1b');
  px(ctx, x + 3, y + 15, 4, 1, '#451a03');
  px(ctx, x + 9, y + 15, 4, 1, '#451a03');
}

// ── Draw citizens (simple humanoids for corruption scene) ──
function drawCitizen(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, variant: number) {
  const colors = [
    { shirt: '#3b82f6', pants: '#1e3a5f' },
    { shirt: '#22c55e', pants: '#14532d' },
    { shirt: '#a855f7', pants: '#3b0764' },
    { shirt: '#f59e0b', pants: '#78350f' },
  ];
  const c = colors[variant % colors.length];
  const sway = Math.sin(frame * 0.3 + variant) * 0.5;

  // Body
  px(ctx, x + 2, y + 4 + sway, 4, 3, c.shirt);
  // Legs
  px(ctx, x + 2, y + 7, 1, 2, c.pants);
  px(ctx, x + 5, y + 7, 1, 2, c.pants);
  // Feet
  px(ctx, x + 1, y + 9, 2, 1, '#78350f');
  px(ctx, x + 5, y + 9, 2, 1, '#78350f');
  // Head
  px(ctx, x + 2, y + 1, 4, 3, '#fcd5b4');
  // Eyes
  px(ctx, x + 3, y + 2, 1, 1, '#1a1a2e');
  px(ctx, x + 5, y + 2, 1, 1, '#1a1a2e');
  // Hair
  const hairColor = variant % 2 === 0 ? '#78350f' : '#374151';
  px(ctx, x + 2, y + 0, 4, 2, hairColor);
}

// ── Draw monster (corrupted citizen — skeleton-like) ──
function drawMonsterSmall(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, variant: number) {
  const sway = Math.sin(frame * 0.4 + variant * 2) * 0.8;
  const isRed = variant % 3 === 0;
  const mainColor = isRed ? '#dc2626' : '#9ca3af';

  // Body
  px(ctx, x + 2, y + 3 + sway, 4, 4, mainColor);
  // Ribs (skeleton)
  if (!isRed) {
    px(ctx, x + 3, y + 4 + sway, 2, 1, '#6b7280');
    px(ctx, x + 3, y + 6 + sway, 2, 1, '#6b7280');
  }
  // Legs
  px(ctx, x + 2, y + 7, 1, 2, mainColor);
  px(ctx, x + 5, y + 7, 1, 2, mainColor);
  // Head (skull)
  px(ctx, x + 2, y + 0, 4, 3, isRed ? '#b91c1c' : '#e5e7eb');
  // Eyes — red glow
  const eyeFlicker = Math.sin(frame * 1.5 + variant) > 0.3;
  if (eyeFlicker) {
    px(ctx, x + 3, y + 1, 1, 1, '#ef4444');
    px(ctx, x + 5, y + 1, 1, 1, '#ef4444');
  }
}

// ── Draw the First Fire ──
function drawFirstFire(ctx: CanvasRenderingContext2D, cx: number, cy: number, frame: number, intensity: number) {
  const flicker = Math.sin(frame * 0.5) * 2;
  const colors = intensity > 0.6
    ? ['#fbbf24', '#fde68a', '#f59e0b', '#fef3c7']
    : intensity > 0.3
    ? ['#f97316', '#fbbf24', '#ea580c', '#f59e0b']
    : ['#dc2626', '#991b1b', '#7f1d1d', '#ef4444'];

  // Core glow
  ctx.globalAlpha = 0.15 * intensity;
  px(ctx, cx - 12, cy - 12, 24, 24, colors[0]);
  ctx.globalAlpha = 0.1 * intensity;
  px(ctx, cx - 16, cy - 16, 32, 32, colors[2]);
  ctx.globalAlpha = 1;

  // Flame body
  const h = Math.floor(6 + flicker + intensity * 4);
  px(ctx, cx - 3, cy - h, 6, h, colors[0]);
  px(ctx, cx - 2, cy - h - 2, 4, 3, colors[1]);
  px(ctx, cx - 1, cy - h - 3, 2, 2, colors[3]);
  // Flame base
  px(ctx, cx - 4, cy - 2, 8, 3, colors[2]);
  px(ctx, cx - 5, cy, 10, 2, colors[2]);

  // Sparks
  for (let i = 0; i < 4; i++) {
    const sx = cx - 4 + Math.sin(frame * 0.7 + i * 1.5) * 6;
    const sy = cy - h - 2 + Math.cos(frame * 0.5 + i * 2) * 3 - i * 2;
    ctx.globalAlpha = 0.5 * intensity;
    px(ctx, sx, sy, 1, 1, colors[3]);
    ctx.globalAlpha = 1;
  }
}

// ── Draw throne ──
function drawThrone(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Back
  px(ctx, x, y, 20, 2, '#374151');
  px(ctx, x + 2, y - 8, 16, 8, '#4b5563');
  px(ctx, x + 4, y - 10, 12, 2, '#6b7280');
  // Throne points
  px(ctx, x + 2, y - 12, 2, 4, '#fbbf24');
  px(ctx, x + 16, y - 12, 2, 4, '#fbbf24');
  px(ctx, x + 9, y - 14, 2, 4, '#fbbf24');
  // Seat
  px(ctx, x + 2, y + 2, 16, 4, '#374151');
  px(ctx, x + 3, y + 2, 14, 1, '#6b7280');
  // Arm rests
  px(ctx, x, y + 2, 3, 4, '#4b5563');
  px(ctx, x + 17, y + 2, 3, 4, '#4b5563');
  // Gold ornaments
  px(ctx, x + 8, y - 8, 4, 2, '#fbbf24');
  px(ctx, x + 9, y - 7, 2, 1, '#fde68a');
}

// ── Draw Zephara gate (for present scene) ──
function drawGate(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  // Stone walls
  px(ctx, x, y, 8, 30, '#6b7280');
  px(ctx, x + 32, y, 8, 30, '#6b7280');
  // Wall texture
  for (let i = 0; i < 5; i++) {
    px(ctx, x + 1, y + 2 + i * 6, 6, 1, '#4b5563');
    px(ctx, x + 33, y + 2 + i * 6, 6, 1, '#4b5563');
  }
  // Arch
  px(ctx, x + 8, y, 24, 3, '#6b7280');
  px(ctx, x + 6, y + 2, 2, 3, '#6b7280');
  px(ctx, x + 32, y + 2, 2, 3, '#6b7280');
  // Gate opening (dark, mysterious)
  px(ctx, x + 8, y + 3, 24, 27, '#0a0a0a');
  // Light from within — pulsing
  const glow = 0.05 + Math.sin(frame * 0.2) * 0.03;
  ctx.globalAlpha = glow;
  px(ctx, x + 10, y + 5, 20, 23, '#fbbf24');
  ctx.globalAlpha = 1;
  // Chains (broken, hanging)
  px(ctx, x + 12, y + 3, 1, 8, '#9ca3af');
  px(ctx, x + 27, y + 3, 1, 6, '#9ca3af');
  // Broken chain links
  px(ctx, x + 12, y + 10, 1, 1, '#d1d5db');
  px(ctx, x + 27, y + 8, 1, 1, '#d1d5db');
  // Rune above gate
  const runeGlow = 0.3 + Math.sin(frame * 0.3) * 0.2;
  ctx.globalAlpha = runeGlow;
  px(ctx, x + 17, y - 2, 6, 2, '#fbbf24');
  px(ctx, x + 18, y - 3, 4, 1, '#fde68a');
  ctx.globalAlpha = 1;
}

// ══════════════════════════════════════════════════
//  SCENE CANVAS COMPOSITIONS
// ══════════════════════════════════════════════════

function DarknessCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Cavern ceiling
    for (let i = 0; i < 80; i += 4) {
      const h = 3 + Math.sin(i * 0.3) * 2;
      px(ctx, i, 0, 4, h, '#1a1a2e');
    }
    // Stone floor
    px(ctx, 0, 42, 80, 8, '#1f2937');
    for (let i = 0; i < 80; i += 6) {
      px(ctx, i, 42, 1, 8, '#374151');
    }

    // The dying First Fire — center
    const intensity = 0.3 + Math.sin(frame * 0.08) * 0.15; // slowly dimming
    drawFirstFire(ctx, 40, 40, frame, intensity);

    // Karanmir standing before the fire, looking at it
    drawKaranmir(ctx, 18, 24, frame);

    // Faint embers floating up
    for (let i = 0; i < 6; i++) {
      const ex = 35 + Math.sin(frame * 0.2 + i * 1.2) * 8;
      const ey = 30 - (frame * 0.3 + i * 5) % 25;
      ctx.globalAlpha = 0.3 + Math.sin(frame * 0.4 + i) * 0.2;
      px(ctx, ex, ey, 1, 1, '#fbbf24');
      ctx.globalAlpha = 1;
    }
  }, []);

  return <PixelCanvas draw={draw} width={80} height={50} scale={5} className="rounded-lg" />;
}

function KingCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Throne room floor — gold inlaid
    px(ctx, 0, 38, 100, 12, '#1f2937');
    for (let i = 0; i < 100; i += 8) {
      px(ctx, i + 3, 39, 2, 1, '#fbbf24');
      ctx.globalAlpha = 0.15;
      px(ctx, i, 40, 8, 1, '#fde68a');
      ctx.globalAlpha = 1;
    }

    // Throne
    drawThrone(ctx, 40, 28);

    // Karanmir sitting on throne (slightly higher)
    drawKaranmir(ctx, 43, 16, frame);

    // Guards (two skeleton-like warriors flanking)
    // Left guard
    px(ctx, 15, 26, 2, 3, '#9ca3af'); // armor
    px(ctx, 14, 23, 4, 3, '#9ca3af');
    px(ctx, 15, 22, 2, 2, '#fcd5b4'); // head
    px(ctx, 14, 21, 4, 2, '#6b7280'); // helmet
    px(ctx, 14, 20, 1, 1, '#fbbf24'); // horn
    px(ctx, 18, 20, 1, 1, '#fbbf24');
    px(ctx, 13, 22, 1, 8, '#9ca3af'); // spear
    px(ctx, 13, 21, 1, 1, '#d1d5db'); // spear tip

    // Right guard (mirror)
    px(ctx, 83, 26, 2, 3, '#9ca3af');
    px(ctx, 82, 23, 4, 3, '#9ca3af');
    px(ctx, 83, 22, 2, 2, '#fcd5b4');
    px(ctx, 82, 21, 4, 2, '#6b7280');
    px(ctx, 82, 20, 1, 1, '#fbbf24');
    px(ctx, 86, 20, 1, 1, '#fbbf24');
    px(ctx, 86, 22, 1, 8, '#9ca3af');
    px(ctx, 86, 21, 1, 1, '#d1d5db');

    // Torches on walls
    const flicker = Math.sin(frame * 0.8) * 1;
    drawSmallFlame(ctx, 8, 14, frame, 0.6);
    drawSmallFlame(ctx, 90, 14, frame + 5, 0.6);

    // Pillars
    px(ctx, 5, 12, 4, 28, '#4b5563');
    px(ctx, 6, 12, 2, 28, '#6b7280');
    px(ctx, 91, 12, 4, 28, '#4b5563');
    px(ctx, 92, 12, 2, 28, '#6b7280');

    // Ceiling ornaments
    px(ctx, 0, 0, 100, 3, '#1a1a2e');
    for (let i = 10; i < 90; i += 15) {
      px(ctx, i, 2, 2, 1, '#fbbf24');
    }
  }, []);

  return <PixelCanvas draw={draw} width={100} height={50} scale={4} className="rounded-lg" />;
}

function drawSmallFlame(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number, intensity: number) {
  const flicker = Math.sin(frame * 0.8) * 1;
  px(ctx, x, y + 2, 2, 2, '#78350f'); // torch base
  px(ctx, x - 1, y - 1 + flicker, 4, 3, '#f59e0b');
  px(ctx, x, y - 2 + flicker, 2, 2, '#fbbf24');
  px(ctx, x, y - 3 + flicker, 1, 1, '#fde68a');
  ctx.globalAlpha = 0.2 * intensity;
  px(ctx, x - 3, y - 3, 8, 6, '#f59e0b');
  ctx.globalAlpha = 1;
}

function RitualCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Deep cavern — ritual chamber
    px(ctx, 0, 0, 90, 5, '#0a0a0a');
    px(ctx, 0, 45, 90, 10, '#1a1a2e');

    // Rune circle on floor
    const runeGlow = 0.3 + Math.sin(frame * 0.3) * 0.2;
    ctx.globalAlpha = runeGlow;
    // Circle outline (simplified)
    for (let a = 0; a < 24; a++) {
      const rx = 45 + Math.cos(a * Math.PI / 12) * 18;
      const ry = 35 + Math.sin(a * Math.PI / 12) * 8;
      px(ctx, rx, ry, 1, 1, '#fbbf24');
    }
    // Inner runes
    for (let a = 0; a < 8; a++) {
      const rx = 45 + Math.cos(a * Math.PI / 4 + frame * 0.1) * 10;
      const ry = 35 + Math.sin(a * Math.PI / 4 + frame * 0.1) * 5;
      px(ctx, rx, ry, 2, 1, '#f97316');
    }
    ctx.globalAlpha = 1;

    // The First Fire — intense, growing
    const intensity = 0.7 + Math.sin(frame * 0.15) * 0.2;
    drawFirstFire(ctx, 45, 32, frame, intensity);

    // Karanmir in front, arms raised
    const kx = 30;
    const ky = 22;
    // Body
    px(ctx, kx + 4, ky + 6, 8, 5, '#fbbf24');
    px(ctx, kx + 5, ky + 12, 2, 3, '#1e1b4b');
    px(ctx, kx + 9, ky + 12, 2, 3, '#1e1b4b');
    // Cape
    px(ctx, kx + 5, ky + 7, 6, 5, '#4c1d95');
    // Arms RAISED
    px(ctx, kx + 1, ky + 2, 2, 5, '#fbbf24');
    px(ctx, kx + 13, ky + 2, 2, 5, '#fbbf24');
    px(ctx, kx + 1, ky + 1, 2, 2, '#fcd5b4'); // hands up
    px(ctx, kx + 13, ky + 1, 2, 2, '#fcd5b4');
    // Head
    px(ctx, kx + 5, ky + 2, 6, 4, '#fcd5b4');
    // Crown
    px(ctx, kx + 4, ky + 1, 8, 2, '#fbbf24');
    px(ctx, kx + 7, ky - 1, 2, 2, '#fde68a');

    // Energy beams connecting king to fire
    const beamAlpha = 0.2 + Math.sin(frame * 0.4) * 0.15;
    ctx.globalAlpha = beamAlpha;
    px(ctx, kx + 2, ky + 2, 12, 1, '#fbbf24');
    px(ctx, kx + 14, ky + 2, 18, 1, '#f97316');
    // Vertical energy
    px(ctx, kx + 8, ky - 3, 1, 5, '#fde68a');
    ctx.globalAlpha = 1;

    // Rising energy particles
    for (let i = 0; i < 8; i++) {
      const px2 = 35 + Math.sin(frame * 0.3 + i * 0.8) * 15;
      const py2 = 40 - (frame * 0.5 + i * 4) % 30;
      ctx.globalAlpha = 0.4;
      px(ctx, px2, py2, 1, 1, i % 2 === 0 ? '#fbbf24' : '#f97316');
      ctx.globalAlpha = 1;
    }
  }, []);

  return <PixelCanvas draw={draw} width={90} height={55} scale={4} className="rounded-lg" />;
}

function CatastropheCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Red-tinted cavern
    const bgPulse = 0.05 + Math.sin(frame * 0.3) * 0.03;
    ctx.globalAlpha = bgPulse;
    px(ctx, 0, 0, 90, 55, '#dc2626');
    ctx.globalAlpha = 1;
    px(ctx, 0, 45, 90, 10, '#1a0505');

    // Cracks in the ground
    const crackColor = frame % 6 < 3 ? '#f97316' : '#dc2626';
    px(ctx, 10, 45, 1, 6, crackColor);
    px(ctx, 30, 44, 1, 8, crackColor);
    px(ctx, 55, 45, 1, 7, crackColor);
    px(ctx, 75, 44, 1, 6, crackColor);

    // Exploding fire — massive, out of control
    const intensity = 1.0;
    drawFirstFire(ctx, 45, 30, frame, intensity);
    // Extra fire tendrils reaching out
    for (let i = 0; i < 5; i++) {
      const tx = 45 + Math.cos(frame * 0.2 + i * 1.3) * (15 + i * 3);
      const ty = 28 + Math.sin(frame * 0.3 + i * 0.8) * 4;
      ctx.globalAlpha = 0.4;
      px(ctx, tx, ty, 2, 3, i % 2 === 0 ? '#ef4444' : '#f97316');
      ctx.globalAlpha = 1;
    }

    // Karanmir — transforming, in agony
    const kx = 32;
    const ky = 20;
    const shake = Math.sin(frame * 2) * 1.5;
    // Body flickering between human and demon
    const isHuman = frame % 8 < 4;
    if (isHuman) {
      // Human form — distorted
      px(ctx, kx + 4 + shake, ky + 6, 8, 5, '#fbbf24');
      px(ctx, kx + 5 + shake, ky + 2, 6, 4, '#fcd5b4');
      px(ctx, kx + 4 + shake, ky + 1, 8, 2, '#fbbf24'); // crown
    } else {
      // Demon form emerging
      px(ctx, kx + 3 + shake, ky + 5, 10, 6, '#dc2626');
      px(ctx, kx + 4 + shake, ky + 1, 8, 4, '#b91c1c');
      // Horns forming
      px(ctx, kx + 2 + shake, ky - 1, 2, 2, '#451a03');
      px(ctx, kx + 12 + shake, ky - 1, 2, 2, '#451a03');
      // Burning eyes
      px(ctx, kx + 5 + shake, ky + 2, 1, 1, '#fbbf24');
      px(ctx, kx + 10 + shake, ky + 2, 1, 1, '#fbbf24');
    }
    // Legs
    px(ctx, kx + 5 + shake, ky + 11, 2, 3, '#1e1b4b');
    px(ctx, kx + 9 + shake, ky + 11, 2, 3, '#1e1b4b');

    // Energy explosion waves
    const wave = (frame * 2) % 40;
    ctx.globalAlpha = Math.max(0, 0.4 - wave * 0.01);
    for (let a = 0; a < 16; a++) {
      const wx = 45 + Math.cos(a * Math.PI / 8) * wave;
      const wy = 30 + Math.sin(a * Math.PI / 8) * (wave * 0.6);
      px(ctx, wx, wy, 1, 1, '#ef4444');
    }
    ctx.globalAlpha = 1;

    // Falling debris
    for (let i = 0; i < 6; i++) {
      const dx = 10 + i * 14 + Math.sin(frame * 0.1 + i) * 3;
      const dy = (frame * 0.8 + i * 8) % 50;
      px(ctx, dx, dy, 2, 2, '#4b5563');
    }
  }, []);

  return <PixelCanvas draw={draw} width={90} height={55} scale={4} className="rounded-lg" />;
}

function CorruptionCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Dark throne room — corrupted
    px(ctx, 0, 38, 100, 12, '#0a0505');
    // Red cracks on floor
    for (let i = 0; i < 10; i++) {
      const crackGlow = Math.sin(frame * 0.3 + i) > 0.5;
      px(ctx, 5 + i * 10, 40, 1, 5, crackGlow ? '#dc2626' : '#7f1d1d');
    }

    // Corrupted throne
    px(ctx, 40, 28, 20, 2, '#374151');
    px(ctx, 42, 20, 16, 8, '#1a0505');
    px(ctx, 44, 18, 12, 2, '#7f1d1d');
    // Throne burning
    ctx.globalAlpha = 0.3;
    px(ctx, 42, 18, 16, 12, '#dc2626');
    ctx.globalAlpha = 1;

    // Corrupted Karanmir on throne
    drawCorruptedKaranmir(ctx, 43, 14, frame);

    // Citizens transforming into monsters (left side)
    if (frame % 16 < 8) {
      drawCitizen(ctx, 10, 28, frame, 0);
      drawCitizen(ctx, 22, 30, frame, 1);
    } else {
      drawMonsterSmall(ctx, 10, 28, frame, 0);
      drawMonsterSmall(ctx, 22, 30, frame, 1);
    }

    // Already corrupted (right side)
    drawMonsterSmall(ctx, 72, 28, frame, 2);
    drawMonsterSmall(ctx, 82, 30, frame, 3);

    // Dark fog
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 5; i++) {
      const fx = Math.sin(frame * 0.1 + i * 2) * 10 + i * 20;
      px(ctx, fx, 30, 15, 10, '#7f1d1d');
    }
    ctx.globalAlpha = 1;

    // Pillars — crumbling
    px(ctx, 5, 12, 4, 28, '#374151');
    px(ctx, 91, 12, 4, 28, '#374151');
    // Cracks on pillars
    px(ctx, 6, 18, 1, 5, '#dc2626');
    px(ctx, 92, 22, 1, 4, '#dc2626');
  }, []);

  return <PixelCanvas draw={draw} width={100} height={50} scale={4} className="rounded-lg" />;
}

function PresentCanvas() {
  const draw = useCallback((ctx: CanvasRenderingContext2D, frame: number) => {
    // Sky / surface — dawn light
    px(ctx, 0, 0, 100, 20, '#0c1222');
    // Stars
    for (let i = 0; i < 8; i++) {
      const twinkle = Math.sin(frame * 0.2 + i * 1.5) > 0.3;
      if (twinkle) {
        ctx.globalAlpha = 0.5;
        px(ctx, 5 + i * 12, 3 + (i * 7 % 12), 1, 1, '#fef3c7');
        ctx.globalAlpha = 1;
      }
    }

    // Ground
    px(ctx, 0, 38, 100, 12, '#374151');
    px(ctx, 0, 36, 100, 2, '#4b5563');
    // Grass/moss patches
    for (let i = 0; i < 10; i++) {
      px(ctx, 3 + i * 10, 36, 3, 1, '#15803d');
    }

    // Zephara gate — center
    drawGate(ctx, 32, 10, frame);

    // Three heroes approaching
    const heroX = 20 + Math.sin(frame * 0.05) * 0.5;
    // Warrior
    drawHeroWarrior(ctx, heroX, 24, frame);
    // Mage
    drawHeroMage(ctx, heroX + 14, 24, frame);
    // Archer
    drawHeroArcher(ctx, heroX + 28, 24, frame);

    // Wind particles
    for (let i = 0; i < 5; i++) {
      const wx = (frame * 0.5 + i * 20) % 100;
      const wy = 20 + Math.sin(frame * 0.2 + i) * 5;
      ctx.globalAlpha = 0.2;
      px(ctx, wx, wy, 2, 1, '#9ca3af');
      ctx.globalAlpha = 1;
    }

    // Light emanating from gate entrance
    const glow = 0.08 + Math.sin(frame * 0.15) * 0.04;
    ctx.globalAlpha = glow;
    px(ctx, 38, 15, 24, 25, '#fbbf24');
    ctx.globalAlpha = 1;
  }, []);

  return <PixelCanvas draw={draw} width={100} height={50} scale={4} className="rounded-lg" />;
}

// ── Simplified hero draws for present scene ──
function drawHeroWarrior(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const walkY = [0, -1, 0, 1][frame % 4];
  // Boots
  px(ctx, x + 4, y + 13, 3, 2, '#6b7280');
  px(ctx, x + 9, y + 13, 3, 2, '#6b7280');
  // Legs
  px(ctx, x + 5, y + 11, 2, 3, '#991b1b');
  px(ctx, x + 9, y + 11, 2, 3, '#991b1b');
  // Cape
  px(ctx, x + 5, y + 7 + walkY, 6, 5, '#b91c1c');
  // Body
  px(ctx, x + 4, y + 6 + walkY, 8, 5, '#9ca3af');
  px(ctx, x + 6, y + 8 + walkY, 4, 1, '#fbbf24');
  // Shield
  px(ctx, x + 1, y + 6 + walkY, 3, 5, '#3b82f6');
  px(ctx, x + 1, y + 6 + walkY, 3, 1, '#6b7280');
  // Sword
  px(ctx, x + 12, y + 3 + walkY, 1, 8, '#d1d5db');
  px(ctx, x + 12, y + 10 + walkY, 1, 1, '#78350f');
  // Head
  px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
  // Helmet
  px(ctx, x + 4, y + 1, 8, 2, '#6b7280');
  px(ctx, x + 3, y - 1, 2, 3, '#fbbf24');
  px(ctx, x + 11, y - 1, 2, 3, '#fbbf24');
  // Plume
  px(ctx, x + 6, y - 2, 4, 1, '#dc2626');
  px(ctx, x + 7, y - 3, 2, 1, '#ef4444');
}

function drawHeroMage(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const walkY = [0, -1, 0, 1][frame % 4];
  const crystalPulse = Math.sin(frame * 0.4) > 0.5;
  // Robe
  px(ctx, x + 3, y + 7 + walkY, 10, 6, '#7c3aed');
  px(ctx, x + 4, y + 13, 3, 2, '#5b21b6');
  px(ctx, x + 9, y + 13, 3, 2, '#5b21b6');
  // Body
  px(ctx, x + 4, y + 5 + walkY, 8, 3, '#8b5cf6');
  // Staff
  px(ctx, x + 13, y + 1, 1, 12, '#78350f');
  px(ctx, x + 12, y + 0, 3, 2, crystalPulse ? '#ddd6fe' : '#a78bfa');
  px(ctx, x + 13, y + 0, 1, 1, crystalPulse ? '#ffffff' : '#c4b5fd');
  // Beard
  px(ctx, x + 6, y + 5, 4, 2, '#e5e7eb');
  // Head
  px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
  // Hat
  px(ctx, x + 4, y + 1, 8, 2, '#7c3aed');
  px(ctx, x + 6, y - 1, 4, 1, '#5b21b6');
  px(ctx, x + 7, y - 2, 2, 1, '#4c1d95');
  px(ctx, x + 8, y - 3, 1, 1, '#3b0764');
  // Hat gem
  px(ctx, x + 7, y + 0, 2, 1, '#fbbf24');
}

function drawHeroArcher(ctx: CanvasRenderingContext2D, x: number, y: number, frame: number) {
  const walkY = [0, -1, 0, 1][frame % 4];
  // Boots
  px(ctx, x + 4, y + 13, 3, 2, '#78350f');
  px(ctx, x + 9, y + 13, 3, 2, '#78350f');
  // Legs
  px(ctx, x + 5, y + 11, 2, 3, '#374151');
  px(ctx, x + 9, y + 11, 2, 3, '#374151');
  // Body — leather
  px(ctx, x + 4, y + 6 + walkY, 8, 5, '#854d0e');
  px(ctx, x + 5, y + 6 + walkY, 6, 1, '#a3650e');
  // Quiver
  px(ctx, x + 11, y + 5 + walkY, 2, 5, '#78350f');
  px(ctx, x + 11, y + 4 + walkY, 1, 1, '#d1d5db'); // arrow tips
  px(ctx, x + 12, y + 4 + walkY, 1, 1, '#d1d5db');
  // Bow
  px(ctx, x + 1, y + 4 + walkY, 1, 8, '#78350f');
  px(ctx, x + 2, y + 4 + walkY, 1, 1, '#fbbf24');
  px(ctx, x + 2, y + 11 + walkY, 1, 1, '#fbbf24');
  // Head
  px(ctx, x + 5, y + 2, 6, 4, '#fcd5b4');
  // Hood
  px(ctx, x + 4, y + 1, 8, 2, '#15803d');
  px(ctx, x + 5, y + 0, 6, 1, '#166534');
  px(ctx, x + 6, y + 2, 1, 1, '#1a1a2e'); // eye
  px(ctx, x + 9, y + 2, 1, 1, '#1a1a2e');
}

// ══════════════════════════════════════════════════
//  LIGHTNING FLASH
// ══════════════════════════════════════════════════

function LightningFlash({ delay, color = 'rgba(220, 38, 38, 0.2)' }: { delay: number; color?: string }) {
  return (
    <motion.div
      className="pointer-events-none absolute inset-0"
      style={{ backgroundColor: color }}
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 0.6, 0, 0.3, 0] }}
      transition={{ duration: 0.5, delay, ease: 'easeOut' }}
    />
  );
}

// ══════════════════════════════════════════════════
//  MAIN COMPONENT
// ══════════════════════════════════════════════════

const SCENE_ORDER: Scene[] = ['darkness', 'king', 'ritual', 'catastrophe', 'corruption', 'present'];

export function PrologueCinematic({ onComplete }: PrologueCinematicProps) {
  const [scene, setScene] = useState<Scene>('darkness');
  const [visibleLines, setVisibleLines] = useState(0);
  const [showPrompt, setShowPrompt] = useState(false);
  const [skipped, setSkipped] = useState(false);
  const sceneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSkip = useCallback(() => {
    if (skipped) return;
    setSkipped(true);
    if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    onComplete();
  }, [skipped, onComplete]);

  // Keyboard handler
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleSkip]);

  // Auto-skip safety
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!skipped) onComplete();
    }, AUTO_SKIP_MS);
    return () => clearTimeout(timer);
  }, [onComplete, skipped]);

  // Scene progression
  useEffect(() => {
    if (scene === 'present') return;
    const timing = SCENE_TIMINGS[scene];

    sceneTimerRef.current = setTimeout(() => {
      const idx = SCENE_ORDER.indexOf(scene);
      if (idx < SCENE_ORDER.length - 1) {
        setVisibleLines(0);
        setScene(SCENE_ORDER[idx + 1]);
      }
    }, timing);

    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
    };
  }, [scene]);

  // Line reveal
  useEffect(() => {
    const lines = SCENE_DIALOGUE[scene];
    if (!lines || lines.length === 0) return;

    const timing = LINE_DELAYS[scene];
    if (!timing) return;

    if (visibleLines < lines.length) {
      const delay = visibleLines === 0 ? timing.first : timing.rest;
      lineTimerRef.current = setTimeout(() => {
        setVisibleLines((v) => v + 1);
      }, delay);
      return () => {
        if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
      };
    }

    if (scene === 'present') {
      const timer = setTimeout(() => setShowPrompt(true), 600);
      return () => clearTimeout(timer);
    }
  }, [visibleLines, scene]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (sceneTimerRef.current) clearTimeout(sceneTimerRef.current);
      if (lineTimerRef.current) clearTimeout(lineTimerRef.current);
    };
  }, []);

  const currentDialogue = SCENE_DIALOGUE[scene];
  const isNarration = scene === 'corruption' || scene === 'present';

  // Particle colors per scene
  const particleColors: Record<Scene, string[]> = {
    darkness: ['rgba(245,158,11,0.12)', 'rgba(251,191,36,0.08)'],
    king: ['rgba(245,158,11,0.15)', 'rgba(139,92,246,0.1)', 'rgba(251,191,36,0.12)'],
    ritual: ['rgba(245,158,11,0.25)', 'rgba(249,115,22,0.2)', 'rgba(251,191,36,0.15)'],
    catastrophe: ['rgba(220,38,38,0.3)', 'rgba(239,68,68,0.25)', 'rgba(245,158,11,0.2)'],
    corruption: ['rgba(220,38,38,0.2)', 'rgba(127,29,29,0.15)', 'rgba(139,92,246,0.1)'],
    present: ['rgba(245,158,11,0.15)', 'rgba(139,92,246,0.12)', 'rgba(16,185,129,0.1)'],
  };

  const particles = useMemo(
    () => generateParticles(25, particleColors[scene]),
    [scene],
  );

  // Background gradient per scene
  const bgClass: Record<Scene, string> = {
    darkness: 'from-black via-zinc-950 to-black',
    king: 'from-black via-zinc-950/90 to-black',
    ritual: 'from-black via-amber-950/20 to-black',
    catastrophe: 'from-black via-red-950/60 to-black',
    corruption: 'from-black via-red-950/40 to-black',
    present: 'from-[#04070d] via-[#0c1222] to-[#04070d]',
  };

  // Scene-specific subtitle
  const sceneLabels: Record<Scene, string> = {
    darkness: 'Altı Yüz Yıl Önce',
    king: 'Taht Salonu — Zephara',
    ritual: 'Ateş-i Kadim\'in Çekirdeği',
    catastrophe: 'Felaket',
    corruption: 'Sonrası',
    present: '',
  };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={scene}
        className="fixed inset-0 z-[96] flex flex-col items-center justify-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: scene === 'catastrophe' ? 0.2 : 0.7, ease: EASE }}
        onClick={handleSkip}
      >
        {/* Background */}
        <div className={`absolute inset-0 bg-gradient-to-b ${bgClass[scene]}`} />

        {/* Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.8) 100%)',
          }}
        />

        {/* Letterbox bars */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 z-50 h-[8%] bg-black" />
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 z-50 h-[8%] bg-black" />

        {/* Catastrophe screenshake */}
        {scene === 'catastrophe' && (
          <>
            <motion.div
              className="pointer-events-none absolute inset-0"
              animate={{
                x: [0, -6, 5, -4, 3, -2, 1, 0, -3, 2, 0],
                y: [0, 4, -5, 3, -3, 2, -1, 0, 2, -1, 0],
              }}
              transition={{ duration: 0.8, delay: 0.1, ease: 'easeOut' }}
            />
            <LightningFlash delay={0.1} />
            <LightningFlash delay={0.5} color="rgba(245, 158, 11, 0.25)" />
            <LightningFlash delay={1.2} />
            <LightningFlash delay={2.8} />
          </>
        )}

        {/* Particles */}
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
              backgroundColor: p.color,
            }}
            animate={{
              y: [0, scene === 'catastrophe' ? -60 : -35, 0],
              opacity: [0, scene === 'catastrophe' ? 0.7 : 0.4, 0],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center gap-4 px-6 text-center">
          {/* Scene label */}
          {sceneLabels[scene] && (
            <motion.p
              className="font-pixel text-[8px] uppercase tracking-[0.3em] text-dm-gold/50 lg:text-[10px] 2xl:text-xs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.6 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              {sceneLabels[scene]}
            </motion.p>
          )}

          {/* Pixel art canvas */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="relative"
          >
            {/* Canvas glow behind */}
            <div
              className="pointer-events-none absolute inset-0 -m-4 rounded-xl blur-xl"
              style={{
                background: scene === 'catastrophe' || scene === 'corruption'
                  ? 'radial-gradient(circle, rgba(220,38,38,0.15) 0%, transparent 70%)'
                  : scene === 'present'
                  ? 'radial-gradient(circle, rgba(245,158,11,0.1) 0%, transparent 70%)'
                  : 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
              }}
            />

            {scene === 'darkness' && <DarknessCanvas />}
            {scene === 'king' && <KingCanvas />}
            {scene === 'ritual' && <RitualCanvas />}
            {scene === 'catastrophe' && <CatastropheCanvas />}
            {scene === 'corruption' && <CorruptionCanvas />}
            {scene === 'present' && <PresentCanvas />}
          </motion.div>

          {/* Dialogue lines */}
          {currentDialogue.length > 0 && (
            <div className="mt-2 flex max-w-md flex-col gap-2 lg:max-w-lg">
              {currentDialogue.map((line, i) => (
                <AnimatePresence key={i}>
                  {i < visibleLines && (
                    <motion.p
                      className={`font-body leading-relaxed ${
                        scene === 'catastrophe' && i === currentDialogue.length - 1
                          ? 'text-base font-bold text-red-400 lg:text-lg'
                          : scene === 'catastrophe'
                          ? 'text-sm text-red-300/90 lg:text-base'
                          : isNarration
                          ? 'text-sm text-zinc-300 lg:text-base'
                          : 'text-sm text-zinc-200 lg:text-base'
                      } ${
                        scene === 'present' && i === currentDialogue.length - 1
                          ? '!text-dm-gold !text-base lg:!text-lg'
                          : ''
                      }`}
                      style={{
                        textShadow: scene === 'catastrophe'
                          ? '0 0 15px rgba(220, 38, 38, 0.6)'
                          : scene === 'present' && i === currentDialogue.length - 1
                          ? '0 0 12px rgba(245, 158, 11, 0.4)'
                          : '0 0 8px rgba(0, 0, 0, 0.5)',
                      }}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5, ease: EASE }}
                    >
                      {isNarration ? line : `\u201C${line}\u201D`}
                    </motion.p>
                  )}
                </AnimatePresence>
              ))}
            </div>
          )}

          {/* Darkness scene — single subtitle */}
          {scene === 'darkness' && (
            <motion.p
              className="mt-1 max-w-sm font-body text-sm leading-relaxed text-zinc-500 lg:text-base"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 0.7, y: 0 }}
              transition={{ delay: 2, duration: 1, ease: EASE }}
            >
              Ateş-i Kadim sönüyordu. Zephara&apos;nın güneşi, yavaşça, karanlığa teslim oluyordu.
            </motion.p>
          )}

          {/* Present scene — ready prompt */}
          <AnimatePresence>
            {showPrompt && scene === 'present' && (
              <motion.div
                className="mt-3 flex flex-col items-center gap-3"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
              >
                <PixelButton
                  variant="gold"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSkip();
                  }}
                >
                  Zephara&apos;ya İn
                </PixelButton>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Skip hint */}
          <motion.p
            className="mt-2 font-pixel text-[7px] text-zinc-600 lg:text-[9px] 2xl:text-[11px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            transition={{ delay: 2, duration: 0.5 }}
          >
            Enter ile geç
          </motion.p>
        </div>

        {/* Scene transition fade */}
        {scene !== 'present' && (
          <motion.div
            className="pointer-events-none absolute inset-0 z-40 bg-black"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0, 1] }}
            transition={{
              duration: SCENE_TIMINGS[scene] / 1000,
              times: [0, 0.88, 1],
              ease: EASE,
            }}
          />
        )}
      </motion.div>
    </AnimatePresence>
  );
}
