// End-to-end smoke test. Drives a real solo run over Socket.IO against a running
// server (npm run dev:server) and asserts the combat loop actually works.
//
//   npm run dev:server                     # in one shell
//   node scripts/smoke.mjs                 # in another
//   DM_SERVER=http://localhost:3010 node scripts/smoke.mjs   # non-default port
import { io } from 'socket.io-client';

// Port follows the server's own default; override with DM_SERVER when 3001 is busy.
const SERVER = process.env.DM_SERVER ?? 'http://localhost:3001';
const socket = io(SERVER, { transports: ['polling', 'websocket'] });

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
  lastMonsterCount: 0,
  lastPos: '',
  lastNearest: 0,
  lockedDoorsSeen: false,
  wavesSpawned: 0,
  eliteAffixes: new Set(),
  roomsCleared: 0,
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
socket.on('game:wave_spawned', () => { seen.wavesSpawned += 1; });
socket.on('game:room_cleared', () => { seen.roomsCleared += 1; });
socket.on('game:damage_batch', (batch) => {
  for (const d of batch) {
    if (d.targetId === myId) seen.monsterDamageToPlayer += d.damage;
    else seen.damageToMonsters += d.damage;
  }
});

const WALKABLE = new Set(['floor', 'door', 'stairs']);

/** BFS over walkable tiles; returns a unit step toward the next waypoint. */
function bfsStep(state, from, to) {
  const tiles = state.dungeon.tiles;
  const h = tiles.length;
  const w = tiles[0]?.length ?? 0;
  const sx = Math.floor(from.x), sy = Math.floor(from.y);
  const tx = Math.floor(to.x), ty = Math.floor(to.y);
  if (sx === tx && sy === ty) return null;

  const prev = new Int32Array(w * h).fill(-1);
  const seenCell = new Uint8Array(w * h);
  const queue = [sy * w + sx];
  seenCell[sy * w + sx] = 1;
  let head = 0;
  let found = -1;

  while (head < queue.length) {
    const cur = queue[head++];
    const cx = cur % w, cy = (cur - cx) / w;
    if (cx === tx && cy === ty) { found = cur; break; }
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const idx = ny * w + nx;
      if (seenCell[idx]) continue;
      if (!WALKABLE.has(tiles[ny]?.[nx])) continue;
      seenCell[idx] = 1;
      prev[idx] = cur;
      queue.push(idx);
    }
  }
  if (found < 0) return null;

  // Walk back to the cell adjacent to the start.
  let node = found;
  while (prev[node] !== -1 && prev[node] !== sy * w + sx) node = prev[node];
  const nx = node % w, ny = (node - nx) / w;
  const dx = (nx + 0.5) - from.x;
  const dy = (ny + 0.5) - from.y;
  const mag = Math.hypot(dx, dy) || 1;
  return { x: dx / mag, y: dy / mag };
}

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
  for (const id in state.monsters) {
    const m = state.monsters[id];
    if (m.isElite && m.eliteAffix) seen.eliteAffixes.add(m.eliteAffix);
  }
  for (const row of state.dungeon.tiles) {
    if (row.includes('door_locked')) { seen.lockedDoorsSeen = true; break; }
  }
  for (const id in state.projectiles) {
    seen.projectileTypes.add(state.projectiles[id].type);
  }

  const me = state.players[myId];
  if (!me) return;
  seen.lastMonsterCount = Object.values(state.monsters).filter((m) => m.alive).length;
  seen.lastPos = `${me.position.x.toFixed(1)},${me.position.y.toFixed(1)}`;
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
  seen.lastNearest = bestD;

  // Walk the actual dungeon graph. Steering straight at the target wedged the bot
  // against walls, which made the whole test a coin flip on dungeon layout.
  let ix = 0, iy = 0;
  const step = best ? bfsStep(state, me.position, best.position) : null;
  if (step) {
    ix = step.x; iy = step.y;
  } else {
    if (seen.ticks % 30 === 0) wander = Math.random() * Math.PI * 2;
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
  console.log('--- monsters alive:', seen.lastMonsterCount, '| my pos:', seen.lastPos, '| nearest dist:', seen.lastNearest?.toFixed(2));
  console.log('--- rooms cleared:', seen.roomsCleared, '| waves:', seen.wavesSpawned, '| locked doors seen:', seen.lockedDoorsSeen, '| elite affixes:', [...seen.eliteAffixes].join(',') || 'none');
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
  ok('rooms lock during combat', seen.lockedDoorsSeen);
  ok('rooms get cleared', seen.roomsCleared > 0);
  process.exit(0);
}, 60000);
