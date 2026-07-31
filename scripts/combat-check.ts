// Attack-anatomy checks. Exercises the windup → active → recovery state machine
// directly, without a server, and asserts that telegraphed attacks can be dodged.
//
//   npx tsx scripts/combat-check.ts
import { Monster } from '../server/entities/Monster';
import { TELEGRAPH_NONE } from '../shared/types';

const tiles = Array.from({ length: 32 }, () => Array.from({ length: 32 }, () => 'floor' as const));

function run(type: any, label: string) {
  const m = new Monster(type, { x: 10, y: 10 }, 0);
  const players = [{ id: 'p1', position: { x: 10.8, y: 10 }, alive: true }];
  const kinds = new Set<number>();
  const phases = new Set<string>();
  let hit = 0;
  for (let i = 0; i < 120; i++) {
    const r = m.update(players, tiles);
    phases.add(m.state.attackPhase);
    if (m.state.telegraphKind !== TELEGRAPH_NONE) kinds.add(m.state.telegraphKind);
    if (r) hit++;
    if (m.pendingProjectile) hit++;
  }
  console.log(`${label.padEnd(16)} phases=${[...phases].join('/')} telegraph=${[...kinds].join(',') || 'none'} hits=${hit}`);
}

run('skeleton', 'skeleton');
run('dark_knight', 'dark_knight');
run('gargoyle', 'gargoyle(ranged)');
run('phantom', 'phantom(ranged)');

// Boss AoE telegraph + delayed resolution
const boss = new Monster('boss_forge_guardian' as any, { x: 10, y: 10 }, 0);
const near = [{ id: 'p1', position: { x: 11.5, y: 10 }, alive: true }];
let aoeTick = -1;
const bossKinds = new Set<number>();
for (let i = 0; i < 200; i++) {
  boss.update(near, tiles);
  if (boss.state.telegraphKind !== TELEGRAPH_NONE) bossKinds.add(boss.state.telegraphKind);
  if (boss.aoeHits.length > 0 && aoeTick < 0) aoeTick = i;
}
console.log(`forge slam       telegraph=${[...bossKinds].join(',') || 'none'} resolved_at_tick=${aoeTick}`);

// Dodge check: player leaves the circle during windup -> no hit
const boss2 = new Monster('boss_forge_guardian' as any, { x: 10, y: 10 }, 0);
const mover = [{ id: 'p1', position: { x: 11.5, y: 10 }, alive: true }];
let hitsWhileFleeing = 0;
for (let i = 0; i < 200; i++) {
  if (boss2.pendingAoe) mover[0].position.x = 30; // run far away mid-windup
  boss2.update(mover, tiles);
  hitsWhileFleeing += boss2.aoeHits.length;
}
console.log(`dodge test       hits_when_player_flees_windup=${hitsWhileFleeing} (expect 0)`);
