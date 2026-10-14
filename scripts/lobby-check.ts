/**
 * Multiplayer lobby checks against the real GameRoom, with a recording stand-in
 * for Socket.IO. Guards the path a co-op run takes before the first tick:
 * lobby → class select → playing.
 *
 *   npx tsx scripts/lobby-check.ts
 */
import type { Server, Socket } from 'socket.io';
import { GameRoom } from '../server/GameRoom';

let failures = 0;
const check = (name: string, cond: boolean, detail = '') => {
  if (cond) { console.log(`  ok   ${name}`); return; }
  failures++;
  console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
};

/** Every room-wide emit, in order. */
const broadcasts: Array<{ event: string; data: unknown }> = [];
// Object.create(null) is `any`, so the stand-ins need no cast; GameRoom only
// touches io.to(...).emit and socket.{id, emit, join} on these paths.
const io: Server = Object.assign(Object.create(null), {
  to: () => ({ emit: (event: string, data: unknown) => { broadcasts.push({ event, data }); } }),
});

const socket = (id: string): Socket => Object.assign(Object.create(null), { id, emit: () => {}, join: () => {} });
const phaseChanges = () => broadcasts.filter((b) => b.event === 'game:phase_change').map((b) => (b.data as { phase: string }).phase);

console.log('\nMultiplayer lobby');

{
  broadcasts.length = 0;
  const room = new GameRoom(io, 'TEST', () => {});
  room.addPlayer(socket('a'), 'Ali');

  check('a lone player cannot start', !room.startClassSelect('a'));
  check('room stays in lobby', room.getPhase() === 'lobby', room.getPhase());

  room.addPlayer(socket('b'), 'Veli');
  check('a stranger cannot start the room', !room.startClassSelect('zzz'));
  check('the second player can start', room.startClassSelect('b'));
  check('room moved to class select', room.getPhase() === 'class_select', room.getPhase());
  check('the change was broadcast once', phaseChanges().join() === 'class_select', phaseChanges().join());
  check('a second press is a no-op', !room.startClassSelect('a') && phaseChanges().length === 1);

  room.addPlayer(socket('c'), 'Ayşe');
  check('a friend can still join during class select', room.getAllPlayers().c !== undefined);

  for (const id of ['a', 'b', 'c']) room.handleClassSelect(id, 'warrior');
  room.handleReady('a');
  room.handleReady('b');
  check('the run waits for everyone to be ready', room.getPhase() === 'class_select', room.getPhase());
  room.handleReady('c');
  check('the run starts once all are ready', room.getPhase() === 'playing', room.getPhase());
  room.destroy();
}

{
  broadcasts.length = 0;
  const room = new GameRoom(io, 'SOLO', () => {});
  room.isSolo = true;
  room.addPlayer(socket('s'), 'Tek');
  room.addPlayer(socket('t'), 'Fazla');
  check('a solo room ignores the lobby start', !room.startClassSelect('s'));
  room.destroy();
}

console.log(failures === 0 ? '\nall lobby checks passed' : `\n${failures} lobby check(s) failed`);
process.exit(failures === 0 ? 0 : 1);
