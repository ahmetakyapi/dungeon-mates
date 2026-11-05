'use client';

import { useMemo, useRef, type ReactNode } from 'react';
import { motion, useScroll, useTransform, type MotionValue } from 'framer-motion';
import { hash01 } from '@/lib/motion';

/**
 * A band of rock between two sections — the page passing through a layer of
 * ground on the way down.
 *
 * Four pixel ridges, stepped on a 1-unit grid (crispEdges, uniform scale, so
 * every step is a square pixel at any width), each moving at its own speed as
 * the band crosses the screen: the back ridge barely moves, the front one
 * slides past. Firewatch's layered hills, cut into a dungeon wall.
 *
 * Detail lives inside the rock: pebbles near the surface, crystals in the
 * depths, glowing veins at the heart of the Fire. All of it is generated from
 * a fixed seed, so server and client draw the same band.
 */

type Variant = 'surface' | 'depths' | 'fire';

const VW = 240;
const VH = 56;

/** `rim` is the one-pixel highlight on each ridge top, as in hand-drawn tiles. */
const PALETTE: Record<Variant, { layers: readonly string[]; rim: readonly string[]; detail: readonly string[]; glow?: string }> = {
  surface: {
    layers: ['#1d1f31', '#171828', '#11121d', '#0b0c14'],
    rim: ['#2e3150', '#282a44', '#22243a', '#1b1d2e'],
    detail: ['#2c2e45', '#3a3c58', '#6d6a8e'],
  },
  depths: {
    layers: ['#251c3d', '#1c162e', '#141021', '#0c0b15'],
    rim: ['#3d2f66', '#342857', '#2a2147', '#201a36'],
    detail: ['#3b2d63', '#7c5cff', '#b49cff'],
  },
  fire: {
    layers: ['#2e1510', '#24110a', '#190c08', '#0e0809'],
    rim: ['#6a2a14', '#57220f', '#45190b', '#331309'],
    detail: ['#5a1f10', '#ff8a3d', '#ffd27a'],
    glow: '#ff6a2a',
  },
};

/** Stepped ridge: a polygon on integer coordinates, filled to the bottom. */
function ridge(seed: number, base: number, amp: number, step: number): string {
  let d = `M0 ${VH}`;
  for (let x = 0; x <= VW; x += step) {
    const n =
      Math.sin(x * 0.045 + seed) * 0.55 +
      Math.sin(x * 0.11 + seed * 2.3) * 0.3 +
      (hash01(seed * 97 + x) - 0.5) * 0.4;
    const y = Math.round(base - n * amp);
    d += ` V${y} H${Math.min(VW, x + step)}`;
  }
  return `${d} V${VH} Z`;
}

type Speck = { x: number; y: number; w: number; h: number; c: number };

function specks(seed: number, count: number, top: number): Speck[] {
  const out: Speck[] = [];
  for (let i = 0; i < count; i++) {
    const r = hash01(seed + i * 13.7);
    out.push({
      x: Math.floor(hash01(seed * 3 + i) * VW),
      y: Math.floor(top + hash01(seed * 7 + i * 2) * (VH - top - 4)),
      w: r > 0.8 ? 2 : 1,
      h: r > 0.93 ? 2 : 1,
      c: r > 0.85 ? 2 : r > 0.5 ? 1 : 0,
    });
  }
  return out;
}

function Layer({ progress, index, path, fill, rim, children }: {
  progress: MotionValue<number>; index: number; path: string; fill: string; rim: string; children?: ReactNode;
}) {
  // Back ridge drifts a little, front ridge sweeps: depth through speed.
  const travel = [2, 4, 7, 10][index];
  const y = useTransform(progress, [0, 1], [travel, -travel]);
  return (
    <motion.g style={{ y }}>
      {/* The same ridge one unit higher, under the fill: a lit top edge. */}
      <path d={path} fill={rim} transform="translate(0 -1)" />
      <path d={path} fill={fill} />
      {children}
    </motion.g>
  );
}

export function Strata({ variant, depth, label, seed = 1 }: {
  variant: Variant; depth: string; label: string; seed?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end start'] });
  const pal = PALETTE[variant];

  const shapes = useMemo(() => ({
    ridges: [
      ridge(seed * 1.3, 13, 7, 6),
      ridge(seed * 2.1, 21, 6, 5),
      ridge(seed * 3.7, 30, 6, 4),
      ridge(seed * 5.9, 39, 5, 3),
    ],
    mid: specks(seed * 11, 46, 24),
    front: specks(seed * 19, 30, 40),
    veins: variant === 'fire' ? specks(seed * 23, 14, 32) : [],
  }), [seed, variant]);

  const labelY = useTransform(scrollYProgress, [0, 1], ['30%', '-30%']);

  return (
    <div ref={ref} className="dm-strata" data-variant={variant} aria-hidden>
      <svg viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMin slice" shapeRendering="crispEdges">
        {pal.glow && (
          <defs>
            <linearGradient id={`dm-strata-glow-${seed}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor={pal.glow} stopOpacity="0" />
              <stop offset="1" stopColor={pal.glow} stopOpacity="0.35" />
            </linearGradient>
          </defs>
        )}
        {pal.glow && <rect x="0" y="0" width={VW} height={VH} fill={`url(#dm-strata-glow-${seed})`} />}
        {shapes.ridges.map((d, i) => (
          <Layer key={i} progress={scrollYProgress} index={i} path={d} fill={pal.layers[i]} rim={pal.rim[i]}>
            {i === 1 && shapes.mid.map((s, k) => (
              <rect key={k} x={s.x} y={s.y} width={s.w} height={s.h} fill={pal.detail[s.c === 2 ? 1 : 0]} />
            ))}
            {i === 2 && shapes.veins.map((s, k) => (
              <rect key={k} className="dm-strata-vein" x={s.x} y={s.y} width={s.w + 2} height={1} fill={pal.detail[1 + (k % 2)]}
                    style={{ animationDelay: `${(k % 7) * 0.45}s` }} />
            ))}
            {i === 3 && shapes.front.map((s, k) => (
              <rect key={k} x={s.x} y={s.y} width={s.w} height={s.h} fill={pal.detail[s.c === 2 ? 2 : 0]} opacity={s.c === 2 ? 0.7 : 1} />
            ))}
          </Layer>
        ))}
      </svg>
      <motion.p className="dm-strata-label" style={{ y: labelY }}>
        <span className="dm-strata-depth">{depth}</span>
        <span>{label}</span>
      </motion.p>
    </div>
  );
}
