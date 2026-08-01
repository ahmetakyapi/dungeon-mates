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

// --- Sprint ---
// Sprint was a dead control: the client scaled dx/dy by 1.2 and the server
// normalised any magnitude over 1 straight back down, while the `sprint` flag
// itself was never read. Shift did nothing.
import { Player } from '../server/entities/Player';

const floor = Array.from({ length: 24 }, () => Array.from({ length: 24 }, () => 'floor' as const));
const mk = () => { const p = new Player('p', 'T', { x: 6, y: 6 }); p.selectClass('warrior'); return p; };

const walk = (p: Player, sprint: boolean, ticks: number) => {
  for (let i = 0; i < ticks; i++) {
    p.processInput({ dx: 1, dy: 0, attack: false, ability: false, sprint }, floor, i, []);
  }
  return p.state.position.x - 6;
};

const plain = walk(mk(), false, 20);
const fast = walk(mk(), true, 20);
console.log(`sprint: normal=${plain.toFixed(2)} tiles, sprinting=${fast.toFixed(2)} tiles`,
  fast > plain * 1.2 ? 'PASS' : 'FAIL');

// Attacking is the cost of sprinting.
const q = mk();
const atkWhileSprinting = q.processInput({ dx: 1, dy: 0, attack: true, ability: false, sprint: true }, floor, 99, []);
const r = mk();
const atkWhileWalking = r.processInput({ dx: 1, dy: 0, attack: true, ability: false, sprint: false }, floor, 99, []);
console.log('sprint blocks attack:', atkWhileSprinting === null && atkWhileWalking !== null ? 'PASS' : 'FAIL');
