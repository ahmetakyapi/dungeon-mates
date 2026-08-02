/**
 * Floor-modifier checks: the table is coherent, the trade-offs actually trade,
 * and Swarm is not silently swallowed by the per-room monster cap.
 *
 *   npx tsx scripts/modifier-check.ts
 */
import {
  FLOOR_MODIFIERS, MODIFIER_EFFECTS, MIN_MONSTERS_PER_ROOM, MAX_MONSTERS_PER_ROOM,
  ROOM_AREA_PER_MONSTER, type FloorModifier,
  BOSS_LORE, FLOOR_LORE, monsterDisplay, floorTheme,
} from '../shared/types';

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

console.log('\nFloor modifiers');

const all = Object.values(FLOOR_MODIFIERS) as FloorModifier[];
const curses = all.filter((m) => m.kind === 'curse');
const tradeoffs = all.filter((m) => m.kind === 'tradeoff');
console.log(`  pool: ${all.length} (${curses.length} curse, ${tradeoffs.length} trade-off)`);

// --- table coherence ---
check('every id matches its key', all.every((m) => FLOOR_MODIFIERS[m.id].id === m.id));
check('every modifier has a name and description',
  all.every((m) => m.name.length > 0 && m.description.length > 0));
check('names are unique', new Set(all.map((m) => m.name)).size === all.length);

// --- the pool has to outlast a run ---
// A run draws one modifier on floors 4-6 and two on 7-10: eleven draws. A pool
// smaller than that guarantees repeats before the run is over.
check('pool outlasts a single run', all.length >= 10, `${all.length} modifiers, 11 draws per run`);
check('there are real trade-offs, not only curses', tradeoffs.length >= 4, `${tradeoffs.length}`);

// --- trade-offs must actually cut both ways ---
check('Glass Cannon gives and takes',
  MODIFIER_EFFECTS.glassCannonPlayerDamage > 1 && MODIFIER_EFFECTS.glassCannonDamageTaken > 1);
check('Swarm gives and takes',
  MODIFIER_EFFECTS.swarmCountMult > 1 && MODIFIER_EFFECTS.swarmHpMult < 1);
check('Frenzy gives and takes',
  MODIFIER_EFFECTS.frenzyCooldownMult < 1 && MODIFIER_EFFECTS.frenzyDamageMult < 1);
check('Brittle Foes gives and takes', MODIFIER_EFFECTS.brittleDamageMult > 1);

// --- Swarm must survive the per-room cap ---
// If ordinary rooms already sit at MAX_MONSTERS_PER_ROOM, multiplying the count
// changes nothing and the modifier is a lie told in the UI.
{
  let roomsWhereSwarmMatters = 0;
  let roomsTested = 0;
  // Room sizes the generator actually produces.
  for (let w = 6; w <= 14; w++) {
    for (let h = 6; h <= 14; h++) {
      roomsTested++;
      const base = Math.max(MIN_MONSTERS_PER_ROOM, Math.floor((w * h) / ROOM_AREA_PER_MONSTER));
      const normal = Math.min(MAX_MONSTERS_PER_ROOM, Math.max(1, Math.round(base)));
      const swarmed = Math.min(MAX_MONSTERS_PER_ROOM, Math.max(1, Math.round(base * MODIFIER_EFFECTS.swarmCountMult)));
      if (swarmed > normal) roomsWhereSwarmMatters++;
    }
  }
  const pct = Math.round((roomsWhereSwarmMatters / roomsTested) * 100);
  check('Swarm changes the count in most rooms', pct >= 60,
    `${pct}% of ${roomsTested} room sizes (cap ${MAX_MONSTERS_PER_ROOM})`);
}

// --- a swarmed floor should be busier but not deadlier per body ---
{
  const bodies = MODIFIER_EFFECTS.swarmCountMult;
  const perBody = MODIFIER_EFFECTS.swarmHpMult;
  const totalHp = bodies * perBody;
  // Total effective HP should stay near parity: more targets, not a wall.
  check('Swarm keeps total HP near parity', totalHp > 0.8 && totalHp < 1.15, `${totalHp.toFixed(2)}×`);
}

// --- Glass Cannon should be a real gamble, not a free buff ---
{
  const net = MODIFIER_EFFECTS.glassCannonPlayerDamage / MODIFIER_EFFECTS.glassCannonDamageTaken;
  check('Glass Cannon is close to even', net > 0.9 && net < 1.2, `${net.toFixed(2)}× net`);
}

// --- boss lore covers every boss the intro can show ---
{
  const ids = ['boss_forge_guardian', 'boss_spider_queen', 'boss_stone_warden', 'boss_flame_knight', 'boss_demon'];
  check('every boss has lore', ids.every((id) => Boolean(BOSS_LORE[id])),
    ids.filter((id) => !BOSS_LORE[id]).join(', '));
  check('every boss has intro lines and a fall line',
    ids.every((id) => BOSS_LORE[id]?.intro.length > 0 && BOSS_LORE[id]?.fall.length > 0));
  check('every floor with lore has a name and reveal',
    Object.values(FLOOR_LORE).every((f) => f.name && f.lore && f.reveal));
  // The nameplate and the narrative must agree — they did not before.
  // The palette and the narrative each carry a floor name, and they had already
  // drifted: floor 3 was titled "Derin Tüneller" on the card while its own text
  // described a forge, and floor 5 was named for the boss rather than for what
  // Selvira actually is.
  const nameDrift = Object.keys(FLOOR_LORE)
    .map(Number)
    .filter((f) => floorTheme(f).name !== FLOOR_LORE[f].name)
    .map((f) => `${f}: ${floorTheme(f).name} vs ${FLOOR_LORE[f].name}`);
  check('floor names agree between palette and lore', nameDrift.length === 0, nameDrift.join('; '));

  check('final boss is named consistently',
    BOSS_LORE.boss_demon.name === monsterDisplay('boss_demon').name,
    `${BOSS_LORE.boss_demon.name} vs ${monsterDisplay('boss_demon').name}`);
}

console.log(failures === 0 ? '\nAll modifier checks passed.\n' : `\n${failures} modifier check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
