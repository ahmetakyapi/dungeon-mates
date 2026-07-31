// End-to-end smoke test. Drives a real solo run over Socket.IO against a running
// server (npm run dev:server) and asserts the combat loop actually works.
//
//   npm run dev:server        # in one shell
//   node scripts/smoke.mjs    # in another
import { io } from 'socket.io-client';

const socket = io('http://localhost:3001', { transports: ['polling', 'websocket'] });

const seen = {
  phases: new Set(),
  attackPhases: new Set(),
  telegraphKinds: new Set(),
  projectileTypes: new Set(),
  staggerObserved: false,
  monsterDamageToPlayer: 0,
  damageToMonsters: 0,
  maxFloor: 1,
  kills: 0,
  ticks: 0,
};

let myId = '';
let lastHp = null;
let prevPos = null;
let stuckTicks = 0;
let wander = 0;

socket.on('connect', () => {
  socket.emit('room:create_solo', { playerName: 'SmokeBot' });
});

socket.on('room:created', (d) => { myId = d.playerId; });

socket.on('game:phase_change', (d) => {
  seen.phases.add(d.phase);
  if (d.phase === 'class_select') {
    socket.emit('player:class_select', { playerClass: 'warrior' });
    setTimeout(() => socket.emit('player:ready'), 100);
  }
});

socket.on('game:monster_killed', () => { seen.kills += 1; });
socket.on('game:damage_batch', (batch) => {
  for (const d of batch) {
    if (d.targetId === myId) seen.monsterDamageToPlayer += d.damage;
    else seen.damageToMonsters += d.damage;
  }
});

socket.on('game:state', (state) => {
  seen.ticks += 1;
  seen.maxFloor = Math.max(seen.maxFloor, state.dungeon.currentFloor);

  for (const id in state.monsters) {
    const m = state.monsters[id];
    if (!m.alive) continue;
    seen.attackPhases.add(m.attackPhase);
    if (m.telegraphKind !== 0) seen.telegraphKinds.add(m.telegraphKind);
    if (m.staggerTicks > 0) seen.staggerObserved = true;
  }
  for (const id in state.projectiles) {
    seen.projectileTypes.add(state.projectiles[id].type);
  }

  const me = state.players[myId];
  if (!me) return;
  if (lastHp !== null && me.hp < lastHp) { /* took damage */ }
  lastHp = me.hp;

  // Walk toward the nearest monster and swing constantly.
  let best = null;
  let bestD = Infinity;
  for (const id in state.monsters) {
    const m = state.monsters[id];
    if (!m.alive) continue;
    const d = Math.hypot(m.position.x - me.position.x, m.position.y - me.position.y);
    if (d < bestD) { bestD = d; best = m; }
  }
  // Naive "walk straight at it" pathing gets wedged on walls, so unstick with a
  // random walk whenever position stops changing.
  const moved = !prevPos || Math.hypot(me.position.x - prevPos.x, me.position.y - prevPos.y) > 0.01;
  if (moved) { stuckTicks = 0; } else { stuckTicks += 1; }
  prevPos = { x: me.position.x, y: me.position.y };

  let ix = 0, iy = 0;
  if (stuckTicks > 12) {
    if (stuckTicks % 40 === 0) wander = Math.random() * Math.PI * 2;
    ix = Math.cos(wander); iy = Math.sin(wander);
    if (stuckTicks > 160) stuckTicks = 0;
  } else if (best) {
    const dx = best.position.x - me.position.x;
    const dy = best.position.y - me.position.y;
    const mag = Math.hypot(dx, dy) || 1;
    ix = dx / mag; iy = dy / mag;
  } else {
    if (seen.ticks % 40 === 0) wander = Math.random() * Math.PI * 2;
    ix = Math.cos(wander); iy = Math.sin(wander);
  }
  socket.emit('player:input', { dx: ix, dy: iy, attack: false, ability: false, interact: true });
  socket.emit('player:attack');
  socket.emit('player:interact');
});

setTimeout(() => {
  const ok = (label, cond) => console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
  console.log('--- state ticks received:', seen.ticks);
  console.log('--- phases:', [...seen.phases].join(', '));
  console.log('--- attack phases observed:', [...seen.attackPhases].join(', '));
  console.log('--- telegraph kinds observed:', [...seen.telegraphKinds].join(', '));
  console.log('--- projectile types observed:', [...seen.projectileTypes].join(', '));
  console.log('--- kills:', seen.kills, '| dmg dealt:', seen.damageToMonsters, '| dmg taken:', seen.monsterDamageToPlayer);
  console.log('');
  ok('server streamed state', seen.ticks > 50);
  ok('reached playing phase', seen.phases.has('playing'));
  ok('monsters enter windup', seen.attackPhases.has('windup'));
  ok('monsters reach active frame', seen.attackPhases.has('active'));
  ok('monsters recover', seen.attackPhases.has('recovery'));
  // Floor 1 is deliberately all SWIFT-profile monsters (rat/slime/bat), which carry
  // no telegraph — telegraph shapes are covered by scripts/combat-check.ts instead.
  ok('player damages monsters', seen.damageToMonsters > 0);
  ok('monsters damage player', seen.monsterDamageToPlayer > 0);
  ok('kills registered', seen.kills > 0);
  ok('stagger/interrupt fires', seen.staggerObserved);
  process.exit(0);
}, 60000);
