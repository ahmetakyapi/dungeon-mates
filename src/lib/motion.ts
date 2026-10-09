/**
 * Shared motion vocabulary.
 *
 * One set of curves and durations for the landing page, the page transition and
 * the in-game screens, so a wipe on the way into the dungeon and a panel opening
 * inside it feel like they were cut by the same hand.
 */

/** Long, decisive deceleration — headline reveals, panels arriving. */
export const EASE_OUT_EXPO = [0.16, 1, 0.3, 1] as const;
/** Symmetric and heavy — curtains, shutters, anything that covers the screen. */
export const EASE_IN_OUT = [0.83, 0, 0.17, 1] as const;
/** The project's existing soft ease-out, kept for small UI. */
export const EASE_SOFT = [0.22, 1, 0.36, 1] as const;

export const DUR = {
  fast: 0.25,
  base: 0.5,
  slow: 0.9,
  cinematic: 1.4,
} as const;

/** True when the user asked the OS for less motion. Safe on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

/** Deterministic 0..1 noise for a cell index — stable across renders. */
export function hash01(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}
