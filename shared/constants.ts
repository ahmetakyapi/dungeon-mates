// ==========================================
// Dungeon Mates — Game Constants
// ==========================================

// --- Sabitler ---
export const TICK_RATE = 20; // server tick/saniye
export const TICK_MS = 1000 / TICK_RATE;
export const TILE_SIZE = 16;
export const PLAYER_SPEED = 1.8; // tile/saniye
export const ROOM_MIN_SIZE = 7;
export const ROOM_MAX_SIZE = 13;
export const DUNGEON_WIDTH = 64;
export const DUNGEON_HEIGHT = 64;
export const MAX_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 4;

// --- Savunma Formülü ---
// Hasar çarpanı = DEF_K / (DEF_K + defense).
// Düz çıkarma (damage - defense) yerine azalan-getiri: yüksek savunma her zaman
// anlamlı kalır ama hiçbir zaman hasarı 1'e sabitlemez.
// def 10 → %77 hasar alır, def 30 → %53, def 75 → %31.
export const DEF_K = 34;
// --- XP Eğrisi (exponential) ---
// Level N→N+1 için gereken XP: floor(40 * 1.35^(N-1))
export function xpForLevel(level: number): number {
  return Math.floor(40 * Math.pow(1.35, level - 1));
}
// Level N'e ulaşmak için toplam gereken XP
export function totalXpForLevel(level: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += xpForLevel(i);
  }
  return total;
}
// XP'den level hesapla
export function levelFromXp(xp: number): number {
  let level = 1;
  let cumulative = 0;
  while (true) {
    const needed = xpForLevel(level);
    if (cumulative + needed > xp) break;
    cumulative += needed;
    level++;
  }
  return level;
}

// --- Zorluk Seviyeleri ---
export const DIFFICULTY_INFO: Record<number, { label: string; color: string }> = {
  1: { label: 'Kolay', color: '#4ade80' },
  2: { label: 'Normal', color: '#facc15' },
  3: { label: 'Zor', color: '#f97316' },
  4: { label: 'Çok Zor', color: '#ef4444' },
} as const;


// --- Oda nüfusu ---
// Sürü modifiye edicisinin etkisi tamamen bu tavana bağlı: odalar zaten tavanda
// oturuyorsa sayıyı çarpmak hiçbir şey değiştirmez ve arayüzde yazan şey yalan
// olur. Bu yüzden sunucunun içinde değil, doğrulanabilecekleri yerdeler.
export const ROOM_AREA_PER_MONSTER = 14;
export const MAX_MONSTERS_PER_ROOM = 14;
export const MIN_MONSTERS_PER_ROOM = 4;
