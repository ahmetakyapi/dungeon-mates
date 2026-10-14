// ==========================================
// Dungeon Mates — Oyuncu Adı
//
// The name used to live only in the URL. Solo runs were always "Kahraman",
// "Tekrar Oyna" reset whatever the player had typed, and a friend opening an
// invite link had nowhere to type one at all. One remembered name now serves
// the landing form, solo runs, replays and invite links.
// ==========================================

const STORAGE_KEY = 'dungeon-mates-player-name';

/** Matches the landing input; the server accepts up to 20. */
export const PLAYER_NAME_MAX = 12;
export const DEFAULT_PLAYER_NAME = 'Kahraman';

export function cleanPlayerName(raw: string): string {
  return raw.replace(/\s+/g, ' ').trim().slice(0, PLAYER_NAME_MAX);
}

/** The remembered name, or '' when there is none (or storage is blocked). */
export function loadPlayerName(): string {
  try {
    return cleanPlayerName(localStorage.getItem(STORAGE_KEY) ?? '');
  } catch {
    return '';
  }
}

export function savePlayerName(name: string): void {
  const clean = cleanPlayerName(name);
  if (!clean) return;
  try { localStorage.setItem(STORAGE_KEY, clean); } catch { /* private mode */ }
}

export function soloGameUrl(name = loadPlayerName()): string {
  return `/game?mode=solo&name=${encodeURIComponent(name || DEFAULT_PLAYER_NAME)}`;
}

export function joinGameUrl(roomCode: string, name: string): string {
  return `/game?room=${encodeURIComponent(roomCode)}&name=${encodeURIComponent(name)}`;
}

/** What an invite carries: the room only — the friend picks their own name. */
export function inviteUrl(origin: string, roomCode: string): string {
  return `${origin}/game?room=${encodeURIComponent(roomCode)}`;
}
