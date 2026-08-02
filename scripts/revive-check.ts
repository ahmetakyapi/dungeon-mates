/**
 * Revive-channel checks against the real Player class.
 *
 *   npx tsx scripts/revive-check.ts
 */
import { Player } from '../server/entities/Player';
import { TICK_RATE } from '../shared/types';

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

const downed = () => {
  const p = new Player('p1', 'Test', { x: 5, y: 5 });
  p.selectClass('warrior');
  // Enough to go through any amount of mitigation.
  p.takeDamage(100000);
  return p;
};

console.log('\nRevive channel');

// --- a downed player is revivable and starts at zero progress ---
{
  const p = downed();
  check('damage downs the player', !p.state.alive);
  check('downed player can be revived', p.canBeRevived());
  check('progress starts at zero', p.getState().reviveProgress === 0, String(p.getState().reviveProgress));
}

// --- the channel takes a real, bounded number of ticks ---
{
  const p = downed();
  let ticks = 0;
  let done = false;
  while (ticks < 200 && !done) { done = p.tickReviveChannel(); ticks++; }
  check('channel completes', done, `${ticks} ticks`);
  check('channel is not instant', ticks > 1, `${ticks} ticks`);
  // Long enough to be a commitment, short enough to attempt mid-fight.
  const seconds = ticks / TICK_RATE;
  check('channel lasts 0.5–3s', seconds >= 0.5 && seconds <= 3, `${seconds.toFixed(2)}s`);
}

// --- progress is reported to the client while channelling ---
{
  const p = downed();
  for (let i = 0; i < 10; i++) p.tickReviveChannel();
  const mid = p.getState().reviveProgress;
  check('progress is reported mid-channel', mid > 0 && mid < 1, String(mid.toFixed(2)));
}

// --- abandoning drains rather than resetting ---
{
  const p = downed();
  for (let i = 0; i < 10; i++) p.tickReviveChannel();
  const before = p.getState().reviveProgress;
  p.decayReviveChannel();
  const after = p.getState().reviveProgress;
  check('abandoning drains progress', after < before && after > 0, `${before.toFixed(2)} -> ${after.toFixed(2)}`);

  for (let i = 0; i < 40; i++) p.decayReviveChannel();
  check('progress drains to zero', p.getState().reviveProgress === 0);
  check('drain does not revive', !p.state.alive);
}

// --- a dodge mid-channel should not throw the whole rescue away ---
{
  const p = downed();
  for (let i = 0; i < 20; i++) p.tickReviveChannel();
  const before = p.getState().reviveProgress;
  // Six ticks away is roughly a dodge roll.
  for (let i = 0; i < 6; i++) p.decayReviveChannel();
  check('a brief interruption keeps most progress', p.getState().reviveProgress > before * 0.4,
    `${before.toFixed(2)} -> ${p.getState().reviveProgress.toFixed(2)}`);
}

// --- completing the channel actually revives, and beats waiting it out ---
{
  const p = downed();
  const maxHp = p.state.maxHp;
  let done = false;
  for (let i = 0; i < 200 && !done; i++) done = p.tickReviveChannel();
  p.revive();
  check('revive brings the player back', p.state.alive);
  check('revive resets progress', p.getState().reviveProgress === 0);
  // The auto-respawn hands back 50%; a rescue has to beat it or nobody bothers.
  check('revive beats the auto-respawn', p.state.hp > maxHp * 0.5,
    `${p.state.hp}/${maxHp}`);
  check('revive grants brief immunity', p.state.alive && p.canBeRevived() === false);
}

// --- a living player cannot be channelled ---
{
  const p = new Player('p2', 'Alive', { x: 1, y: 1 });
  p.selectClass('mage');
  check('living player is not revivable', !p.canBeRevived());
  check('channel on a living player never completes', p.tickReviveChannel() === false);
}

console.log(failures === 0 ? '\nAll revive checks passed.\n' : `\n${failures} revive check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);
