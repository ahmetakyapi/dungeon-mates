'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PixelShutter } from '@/components/fx/PixelShutter';
import { prefersReducedMotion } from '@/lib/motion';

type CinematicWipeProps = {
  /** Any value — when this changes, a wipe fires. */
  trigger: string | number;
  /** Optional tint for special phases (boss = red, victory = gold, defeat = red) */
  color?: string;
  /** Total duration in ms (cover + reveal). Clamped to keep input latency low. */
  durationMs?: number;
  /**
   * Wavefront glow. When omitted it is derived from `color`, so existing call
   * sites get the right accent for free.
   */
  edge?: string;
};

type Stage = { id: number; mode: 'cover' | 'reveal' };

/** Never hold the screen longer than this, whatever the caller asks for. */
const MAX_TOTAL_MS = 680;
/** Share of the timeline spent covering — fast in, slower out. */
const COVER_SHARE = 0.36;

/** Phase tint → wavefront colour. Purple is the game's default accent. */
const EDGE_BY_TINT: Record<string, string> = {
  '#2a0a0a': '#ef4444', // boss
  '#1a1300': '#fbbf24', // victory
  '#1a0505': '#7f1d1d', // defeat
};
const DEFAULT_EDGE = '#8b5cf6';

/**
 * Phase-change wipe built from the same pixel shutter as the route transition:
 * blocks slam in along a glowing diagonal front, then lift away the same way,
 * so a phase change inside the dungeon reads as the same "cut" as walking into
 * it. Purely decorative — pointer-events are off for its whole life and the
 * total time is capped, so it never eats an input.
 */
export function CinematicWipe({
  trigger,
  color = '#000000',
  durationMs = 640,
  edge,
}: CinematicWipeProps) {
  const [stage, setStage] = useState<Stage | null>(null);
  const firstRun = useRef(true);
  const seq = useRef(0);

  const total = Math.min(Math.max(durationMs, 300), MAX_TOTAL_MS);
  const coverMs = Math.round(total * COVER_SHARE);
  const revealMs = total - coverMs;

  useEffect(() => {
    if (prefersReducedMotion()) {
      firstRun.current = false;
      return;
    }
    seq.current += 1;
    // On mount the view underneath is brand new: just lift a curtain off it.
    // Afterwards, every phase change gets the full cover → reveal cut.
    setStage({ id: seq.current, mode: firstRun.current ? 'reveal' : 'cover' });
    firstRun.current = false;
    // Hard stop, in case an animation end is ever missed (tab hidden etc.).
    const t = window.setTimeout(() => setStage(null), total + 220);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trigger]);

  const handleCovered = useCallback(() => {
    setStage((s) => (s && s.mode === 'cover' ? { id: s.id, mode: 'reveal' } : s));
  }, []);

  const handleRevealed = useCallback(() => {
    setStage((s) => (s && s.mode === 'reveal' ? null : s));
  }, []);

  if (!stage) return null;

  const edgeColor = edge ?? EDGE_BY_TINT[color.toLowerCase()] ?? DEFAULT_EDGE;

  return (
    <PixelShutter
      key={`${stage.id}-${stage.mode}`}
      mode={stage.mode}
      color={color}
      edge={edgeColor}
      durationMs={stage.mode === 'cover' ? coverMs : revealMs}
      onDone={stage.mode === 'cover' ? handleCovered : handleRevealed}
      zIndex={80}
      direction="down"
      interactive={false}
    />
  );
}
