// Threat targeting check.
//
// Monsters used to lock onto whoever was geometrically nearest, with no threat
// table at all — a tank could not pull anything off a teammate, so the warrior's
// role was decorative in co-op.
//
//   npx tsx scripts/threat-check.ts
import { Monster } from '../server/entities/Monster';

const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 'floor' as const));

// The squishy stands closer; the tank stands further away but builds threat.
const squishy = { id: 'mage', position: { x: 10.5, y: 10 }, alive: true };
const tank = { id: 'warrior', position: { x: 13, y: 10 }, alive: true };
const players = [squishy, tank];

const SPAWN = { x: 10, y: 10 };
const m = new Monster('skeleton', { ...SPAWN }, 0);

/**
 * Run ticks with the monster pinned in place. Without pinning, the monster walks
 * toward whoever it targeted and then *becomes* nearest to them, which masks what
 * the targeting logic is actually doing.
 */
function settle(ticks: number): string | null {
  for (let i = 0; i < ticks; i++) {
    m.state.position.x = SPAWN.x;
    m.state.position.y = SPAWN.y;
    m.update(players, tiles);
  }
  return m.state.targetPlayerId;
}

const ok = (label: string, actual: string | null, expected: string) =>
  console.log(`${actual === expected ? 'PASS' : 'FAIL'}  ${label.padEnd(34)} -> ${actual} (expect ${expected})`);

ok('no threat: nearest wins', settle(30), 'mage');

m.addThreat('warrior', 260);
ok('after tank taunt: threat wins', settle(30), 'warrior');

// Threat decays on a ~0.4s cadence once the tank stops contributing.
ok('after decay: nearest again', settle(600), 'mage');
