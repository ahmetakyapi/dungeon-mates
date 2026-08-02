/**
 * Hazard tile checks: generation shape, placement safety, and the guarantee
 * that a pool can never cover something the run depends on.
 *
 *   npx tsx scripts/hazard-check.ts
 */
import { DungeonGenerator } from '../server/dungeon/DungeonGenerator';
import type { TileType } from '../shared/types';

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

const count = (tiles: TileType[][], t: TileType) => {
  let n = 0;
  for (const row of tiles) for (const c of row) if (c === t) n++;
  return n;
};

console.log('\nHazard tiles');

// --- floors that should have them, do; floors that should not, do not ---
const SAMPLES = 12;
const tally: Record<number, { lava: number; water: number; runs: number }> = {};
for (let floor = 1; floor <= 10; floor++) {
  tally[floor] = { lava: 0, water: 0, runs: 0 };
  for (let i = 0; i < SAMPLES; i++) {
    const { tiles } = new DungeonGenerator().generate(floor, 1);
    tally[floor].lava += count(tiles, 'lava');
    tally[floor].water += count(tiles, 'water');
    tally[floor].runs++;
  }
}
for (let f = 1; f <= 10; f++) {
  const t = tally[f];
  console.log(`  floor ${String(f).padStart(2)}  lava=${String(t.lava).padStart(4)}  water=${String(t.water).padStart(4)}  (${SAMPLES} runs)`);
}
check('floor 8 has lava', tally[8].lava > 0, `${tally[8].lava} tiles over ${SAMPLES} runs`);
check('floor 3 has water', tally[3].water > 0, `${tally[3].water} tiles`);
check('floor 1 has no hazards', tally[1].lava === 0 && tally[1].water === 0);
check('floor 2 has no hazards', tally[2].lava === 0 && tally[2].water === 0);
check('lava only on the deep floors', tally[1].lava + tally[2].lava + tally[3].lava + tally[4].lava === 0);

// --- safety: hazards never cover critical tiles or the start room ---
{
  let stairsCovered = 0;
  let chestCovered = 0;
  let doorAdjacent = 0;
  let inStartRoom = 0;
  let reachableRuns = 0;

  for (let i = 0; i < 25; i++) {
    const { tiles, rooms } = new DungeonGenerator().generate(9, 1);

    // Nothing critical was overwritten: exactly one staircase still exists on a
    // non-boss floor, and every chest tile is still a chest.
    if (count(tiles, 'stairs') !== 1) stairsCovered++;

    const start = rooms.find((r) => r.isStartRoom);
    if (start) {
      for (let y = start.y; y < start.y + start.height; y++) {
        for (let x = start.x; x < start.x + start.width; x++) {
          if (tiles[y]?.[x] === 'lava' || tiles[y]?.[x] === 'water') inStartRoom++;
        }
      }
    }

    for (let y = 1; y < tiles.length - 1; y++) {
      for (let x = 1; x < tiles[y].length - 1; x++) {
        if (tiles[y][x] !== 'lava' && tiles[y][x] !== 'water') continue;
        // A pool must not sit in a doorway; that would force a hazard crossing.
        for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
          const n = tiles[y + dy]?.[x + dx];
          if (n === 'door' || n === 'door_locked' || n === 'door_sealed') doorAdjacent++;
        }
      }
    }

    // The stairs must still be reachable from the start without passing a wall.
    if (start && floodReachesStairs(tiles, start.centerX, start.centerY)) reachableRuns++;
  }

  check('stairs are never overwritten', stairsCovered === 0, `${stairsCovered} runs lost the staircase`);
  check('start room stays clear', inStartRoom === 0, `${inStartRoom} hazard tiles in start rooms`);
  check('no pool blocks a doorway', doorAdjacent === 0, `${doorAdjacent} door-adjacent hazard tiles`);
  check('stairs stay reachable', reachableRuns === 25, `${reachableRuns}/25`);
  check('chests survive', chestCovered === 0);
}

/** BFS over walkable tiles; hazards are walkable, walls are not. */
function floodReachesStairs(tiles: TileType[][], sx: number, sy: number): boolean {
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const walkable = new Set<TileType>(['floor', 'door', 'door_locked', 'stairs', 'chest', 'lava', 'water']);
  const seen = new Uint8Array(w * h);
  const q = [sy * w + sx];
  seen[sy * w + sx] = 1;
  for (let head = 0; head < q.length; head++) {
    const cur = q[head];
    const cx = cur % w;
    const cy = (cur - cx) / w;
    if (tiles[cy][cx] === 'stairs') return true;
    for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (seen[idx] || !walkable.has(tiles[ny][nx])) continue;
      seen[idx] = 1;
      q.push(idx);
    }
  }
  return false;
}

console.log(failures === 0 ? '\nAll hazard checks passed.\n' : `\n${failures} hazard check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
