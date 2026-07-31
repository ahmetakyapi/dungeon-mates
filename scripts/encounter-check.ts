// Encounter-structure checks: wave assignment per floor, room categories, and
// elite affix rolls. Runs against the generator + Monster directly.
//
//   npx tsx scripts/encounter-check.ts
import { DungeonGenerator } from '../server/dungeon/DungeonGenerator';
import { Monster } from '../server/entities/Monster';
import { rollEliteAffix, ELITE_AFFIXES } from '../shared/types';

const gen = new DungeonGenerator();
const catCounts: Record<string, number> = {};
let doorTiles = 0;
for (let floor = 1; floor <= 10; floor++) {
  const d = gen.generate(floor, 1);
  for (const r of d.rooms) catCounts[r.category] = (catCounts[r.category] ?? 0) + 1;
  for (const row of d.tiles) for (const t of row) if (t === 'door') doorTiles++;
}
console.log('room categories over 10 floors:', JSON.stringify(catCounts));
console.log('door tiles carved:', doorTiles, doorTiles > 0 ? '(lockable)' : '(NONE — lock cannot work)');

// Wave counts mirror GameRoom's rule
const waveFor = (f: number) => (f >= 6 ? 2 : f >= 2 ? 1 : 0);
console.log('waves by floor:', [1,2,5,6,10].map((f) => `f${f}=${waveFor(f)}`).join(' '));

// Affix distribution + that each affix actually changes stats
const rolled = new Set<string>();
for (let i = 0; i < 300; i++) rolled.add(rollEliteAffix(10));
console.log('affixes rolled at floor 10:', [...rolled].sort().join(', '));
console.log('affix defs present:', Object.keys(ELITE_AFFIXES).length);

const base = new Monster('skeleton', { x: 5, y: 5 }, 0);
const elite = new Monster('skeleton', { x: 5, y: 5 }, 0);
elite.makeElite(10);
console.log(
  `elite skeleton: hp ${base.state.maxHp}->${elite.state.maxHp}`,
  `atk ${base.scaledAttack}->${elite.scaledAttack}`,
  `def ${base.scaledDefense}->${elite.scaledDefense}`,
  `affix=${elite.state.eliteAffix}`,
);
