/**
 * Boss fight-design checks.
 *
 * Drives the real Monster/BossAI against a flat arena and asserts that phases
 * add mechanics rather than only multiplying numbers — which is what the final
 * fight used to do.
 *
 *   npx tsx scripts/boss-check.ts
 */
import { Monster } from '../server/entities/Monster';
import { TELEGRAPH_NONE, type MonsterType } from '../shared/types';

const tiles = Array.from({ length: 48 }, () => Array.from({ length: 48 }, () => 'floor' as const));

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

/** Run a boss for `ticks` with its HP pinned to a given fraction of max. */
function observe(type: MonsterType, hpRatio: number, ticks = 600) {
  const m = new Monster(type, { x: 24, y: 24 }, 0);
  const player = { id: 'p1', position: { x: 27, y: 24 }, alive: true };
  const seen = {
    telegraphs: new Set<number>(),
    maxRadius: 0,
    aoeResolutions: 0,
    summons: 0,
    phases: new Set<number>(),
    states: new Set<string>(),
  };
  for (let i = 0; i < ticks; i++) {
    // Pin HP so the boss stays in the phase under test.
    m.state.hp = Math.max(1, Math.floor(m.state.maxHp * hpRatio));
    m.update([player], tiles);
    seen.phases.add(m.state.bossPhase);
    seen.states.add(m.aiState);
    if (m.state.telegraphKind !== TELEGRAPH_NONE) {
      seen.telegraphs.add(m.state.telegraphKind);
      seen.maxRadius = Math.max(seen.maxRadius, m.state.telegraphRadius);
    }
    if (m.aoeHits.length > 0) { seen.aoeResolutions++; m.aoeHits.length = 0; }
    if (m.shouldSummon) { seen.summons++; m.shouldSummon = false; }
  }
  return seen;
}

console.log('\nBoss fights');

// --- the final fight gains mechanics as it goes, not just multipliers ---
{
  const p0 = observe('boss_demon', 0.95); // phase 0
  const p1 = observe('boss_demon', 0.60); // phase 1 — nova arrives
  const p2 = observe('boss_demon', 0.40); // phase 2 — summons arrive
  const p3 = observe('boss_demon', 0.10); // phase 3 — sunburst

  for (const [label, s] of [['phase0', p0], ['phase1', p1], ['phase2', p2], ['phase3', p3]] as const) {
    console.log(`  ${label} telegraphs=${s.telegraphs.size} summons=${s.summons} aoe=${s.aoeResolutions} r=${s.maxRadius.toFixed(1)}`);
  }

  check('opening phase has no nova', p0.telegraphs.size === 0 && p0.aoeResolutions === 0,
    `${p0.telegraphs.size} telegraphs, ${p0.aoeResolutions} resolutions`);
  check('opening phase does not summon', p0.summons === 0, `${p0.summons} summons`);
  check('later phases add a telegraphed nova', p1.aoeResolutions > 0, `${p1.aoeResolutions}`);
  check('phase 1 still holds summons back', p1.summons === 0, `${p1.summons}`);
  check('phase 2 adds summons', p2.summons > 0, `${p2.summons}`);
  check('phase 2 widens the nova', p2.maxRadius > p1.maxRadius,
    `${p1.maxRadius.toFixed(1)} → ${p2.maxRadius.toFixed(1)}`);
  check('the last phase widens it much further', p3.maxRadius > p2.maxRadius * 1.3,
    `${p2.maxRadius.toFixed(1)} → ${p3.maxRadius.toFixed(1)}`);
  check('the boss commits while casting', p3.states.has('cast'), [...p3.states].join(','));
}

// --- every boss telegraphs something; a boss with no readable tell is unfair ---
{
  const bosses: MonsterType[] = [
    'boss_forge_guardian', 'boss_spider_queen', 'boss_stone_warden',
    'boss_flame_knight', 'boss_demon',
  ];
  for (const b of bosses) {
    const s = observe(b, 0.4, 500);
    check(`${b} telegraphs`, s.telegraphs.size > 0 || s.aoeResolutions > 0,
      `telegraphs=${s.telegraphs.size} aoe=${s.aoeResolutions}`);
  }
}

// --- a nova must be dodgeable: standing still gets hit, walking out does not ---
{
  const hit = (flee: boolean) => {
    const m = new Monster('boss_demon', { x: 24, y: 24 }, 0);
    const player = { id: 'p1', position: { x: 25.5, y: 24 }, alive: true };
    let hits = 0;
    for (let i = 0; i < 600; i++) {
      m.state.hp = Math.max(1, Math.floor(m.state.maxHp * 0.1));
      // Once a danger area is up, run for the edge.
      if (flee && m.state.telegraphKind !== TELEGRAPH_NONE) {
        player.position.x = Math.min(46, player.position.x + 0.6);
      }
      m.update([player], tiles);
      if (m.aoeHits.length > 0) { hits += m.aoeHits.length; m.aoeHits.length = 0; }
    }
    return hits;
  };
  const stood = hit(false);
  const fled = hit(true);
  check('standing in the nova gets hit', stood > 0, `${stood} hits`);
  check('walking out of the nova avoids it', fled < stood, `stood=${stood} fled=${fled}`);
}

console.log(failures === 0 ? '\nAll boss checks passed.\n' : `\n${failures} boss check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
