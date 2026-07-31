// Palette + autotiling sanity. Verifies every floor has a distinct theme and that
// the neighbour mask actually varies across a generated map.
//
//   npx tsx scripts/visual-check.ts
import { DungeonGenerator } from '../server/dungeon/DungeonGenerator';
import { floorTheme, THEMED_FLOOR_COUNT } from '../shared/types';

const seenFloorBase = new Set<string>();
const seenWallBase = new Set<string>();
for (let f = 1; f <= 10; f++) {
  const t = floorTheme(f);
  seenFloorBase.add(t.floor[1]);
  seenWallBase.add(t.wall[1]);
  console.log(`floor ${String(f).padStart(2)}  ${t.name.padEnd(28)} floor=${t.floor[1]} wall=${t.wall[1]} accent=${t.accent}`);
}
console.log('');
console.log('themed floors:', THEMED_FLOOR_COUNT);
console.log('distinct floor colours:', seenFloorBase.size, seenFloorBase.size === 10 ? 'PASS' : 'FAIL');
console.log('distinct wall colours: ', seenWallBase.size, seenWallBase.size === 10 ? 'PASS' : 'FAIL');

// Neighbour-mask variety on a real map
const N = 1, E = 2, S = 4, W = 8;
const d = new DungeonGenerator().generate(3, 1);
const masks = new Set<number>();
for (let y = 1; y < d.height - 1; y++) {
  for (let x = 1; x < d.width - 1; x++) {
    if (d.tiles[y][x] !== 'wall') continue;
    let m = 0;
    const solid = (t: string) => t === 'wall' || t === 'void';
    if (solid(d.tiles[y - 1][x])) m |= N;
    if (solid(d.tiles[y][x + 1])) m |= E;
    if (solid(d.tiles[y + 1][x])) m |= S;
    if (solid(d.tiles[y][x - 1])) m |= W;
    masks.add(m);
  }
}
console.log('distinct wall neighbour masks on floor 3:', masks.size, masks.size > 6 ? 'PASS (autotiling has variety)' : 'FAIL');
