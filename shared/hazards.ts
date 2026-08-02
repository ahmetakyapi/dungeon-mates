import type { TileType } from './entities';

/**
 * Which floors carry which hazard, and how much.
 *
 * Lives in shared/ because both sides need it: the server generates the pools,
 * and the landing page's live scenes draw the floor a visitor is looking at. Two
 * copies of this table would drift the moment either side is tuned.
 *
 * Water arrives first and is only a nuisance; lava shows up once the run is
 * already dangerous. Floor 8 is named "Lav Nehirleri", which until this table
 * existed was a promise the level never kept.
 */
export type HazardSpec = {
  type: Extract<TileType, 'lava' | 'water'>;
  /** Chance a given room contains any pool at all. */
  roomChance: number;
  maxPools: number;
  minSize: number;
  maxSize: number;
};

export const HAZARD_BY_FLOOR: Readonly<Record<number, HazardSpec>> = {
  3: { type: 'water', roomChance: 0.45, maxPools: 2, minSize: 3, maxSize: 7 },
  6: { type: 'water', roomChance: 0.5, maxPools: 2, minSize: 4, maxSize: 9 },
  8: { type: 'lava', roomChance: 0.75, maxPools: 3, minSize: 4, maxSize: 11 },
  9: { type: 'lava', roomChance: 0.5, maxPools: 2, minSize: 3, maxSize: 8 },
  10: { type: 'lava', roomChance: 0.4, maxPools: 2, minSize: 3, maxSize: 7 },
};

/** The hazard a floor uses, or null if it has none. */
export function hazardForFloor(floor: number): HazardSpec | null {
  return HAZARD_BY_FLOOR[floor] ?? null;
}
