// ==========================================
// Dungeon Mates — Shared Types
// Server & Client ortak kullanır
// ==========================================

// --- Sabitler ---
export const TICK_RATE = 20; // server tick/saniye
export const TICK_MS = 1000 / TICK_RATE;
export const TILE_SIZE = 16;
export const PLAYER_SPEED = 2.5; // tile/saniye
export const ROOM_MIN_SIZE = 7;
export const ROOM_MAX_SIZE = 13;
export const DUNGEON_WIDTH = 64;
export const DUNGEON_HEIGHT = 64;
export const MAX_PLAYERS = 4;
export const ROOM_CODE_LENGTH = 4;
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

// --- Enum'lar ---
export type PlayerClass = 'warrior' | 'mage' | 'archer';
export type GamePhase = 'lobby' | 'class_select' | 'playing' | 'boss' | 'victory' | 'defeat' | 'game_over' | 'shopping';
export type TileType = 'floor' | 'wall' | 'door' | 'stairs' | 'chest' | 'void';
export type Direction = 'up' | 'down' | 'left' | 'right';
export type MonsterType = 'skeleton' | 'slime' | 'bat' | 'goblin' | 'rat' | 'spider' | 'wraith' | 'mushroom' | 'gargoyle' | 'dark_knight' | 'phantom' | 'lava_slime' | 'boss_spider_queen' | 'boss_demon' | 'boss_forge_guardian' | 'boss_stone_warden' | 'boss_flame_knight';
export type LootType = 'health_potion' | 'mana_potion' | 'damage_boost' | 'speed_boost' | 'gold';

// --- Sınıf İstatistikleri ---
export const CLASS_STATS: Record<PlayerClass, {
  maxHp: number;
  maxMana: number;
  attack: number;
  defense: number;
  speed: number;
  attackRange: number;
  attackCooldown: number;
  color: string;
  label: string;
  emoji: string;
}> = {
  warrior: {
    maxHp: 120,
    maxMana: 30,
    attack: 18,
    defense: 10,
    speed: 2.2,
    attackRange: 1.5,
    attackCooldown: 500,
    color: '#ef4444',
    label: 'Savaşçı',
    emoji: '⚔️',
  },
  mage: {
    maxHp: 70,
    maxMana: 100,
    attack: 20,
    defense: 3,
    speed: 2.0,
    attackRange: 5,
    attackCooldown: 800,
    color: '#8b5cf6',
    label: 'Büyücü',
    emoji: '🔮',
  },
  archer: {
    maxHp: 90,
    maxMana: 50,
    attack: 12,
    defense: 5,
    speed: 2.8,
    attackRange: 6,
    attackCooldown: 400,
    color: '#10b981',
    label: 'Okçu',
    emoji: '🏹',
  },
} as const;

// --- Zorluk Seviyeleri ---
export const DIFFICULTY_INFO: Record<number, { label: string; color: string }> = {
  1: { label: 'Kolay', color: '#4ade80' },
  2: { label: 'Normal', color: '#facc15' },
  3: { label: 'Zor', color: '#f97316' },
  4: { label: 'Çok Zor', color: '#ef4444' },
} as const;

// --- Yetenek Cooldown Süreleri (tick cinsinden) ---
export const ABILITY_MAX_COOLDOWNS: Record<PlayerClass, number> = {
  warrior: 240,
  mage: 300,
  archer: 200,
} as const;

// --- Monster İstatistikleri ---
export const MONSTER_STATS: Record<MonsterType, {
  hp: number;
  attack: number;
  defense: number;
  speed: number;
  xp: number;
  color: string;
  size: number;
}> = {
  skeleton: { hp: 30, attack: 12, defense: 2, speed: 1.5, xp: 10, color: '#d1d5db', size: 1 },
  slime: { hp: 20, attack: 5, defense: 1, speed: 0.8, xp: 5, color: '#4ade80', size: 0.8 },
  bat: { hp: 15, attack: 6, defense: 0, speed: 2.5, xp: 7, color: '#a78bfa', size: 0.6 },
  goblin: { hp: 40, attack: 14, defense: 4, speed: 1.8, xp: 15, color: '#84cc16', size: 0.9 },
  rat: { hp: 12, attack: 4, defense: 0, speed: 2.2, xp: 3, color: '#78716c', size: 0.5 },
  spider: { hp: 25, attack: 10, defense: 2, speed: 1.0, xp: 8, color: '#581c87', size: 0.8 },
  wraith: { hp: 35, attack: 18, defense: 1, speed: 2.2, xp: 15, color: '#a5f3fc', size: 1.0 },
  mushroom: { hp: 45, attack: 12, defense: 6, speed: 0.6, xp: 12, color: '#f472b6', size: 0.9 },
  gargoyle: { hp: 55, attack: 16, defense: 8, speed: 1.4, xp: 20, color: '#6b7280', size: 1.2 },
  dark_knight: { hp: 80, attack: 22, defense: 12, speed: 1.6, xp: 30, color: '#1e293b', size: 1.3 },
  phantom: { hp: 40, attack: 20, defense: 2, speed: 2.5, xp: 25, color: '#c4b5fd', size: 1.0 },
  lava_slime: { hp: 50, attack: 15, defense: 6, speed: 1.0, xp: 18, color: '#f97316', size: 1.0 },
  boss_spider_queen: { hp: 350, attack: 28, defense: 10, speed: 1.3, xp: 80, color: '#7c3aed', size: 2.2 },
  boss_demon: { hp: 500, attack: 35, defense: 15, speed: 1.5, xp: 100, color: '#dc2626', size: 2.5 },
  boss_forge_guardian: { hp: 200, attack: 20, defense: 8, speed: 1.0, xp: 50, color: '#f97316', size: 1.8 },
  boss_stone_warden: { hp: 280, attack: 18, defense: 15, speed: 0.8, xp: 60, color: '#6b7280', size: 2.0 },
  boss_flame_knight: { hp: 320, attack: 30, defense: 10, speed: 2.0, xp: 70, color: '#b91c1c', size: 1.6 },
} as const;

// --- Talent Sistemi ---
export type TalentBranch = 'branch_a' | 'branch_b' | 'branch_c';

export type TalentId = string;

export type TalentDef = {
  id: TalentId;
  name: string;
  description: string;
  branch: TalentBranch;
  level: number; // hangi levelde açılır
  effects: {
    maxHp?: number;
    maxMana?: number;
    attack?: number;
    defense?: number;
    speed?: number;
    lifesteal?: number;         // 0-1 arası, hasar başına HP kazanımı
    manaCostReduction?: number; // 0-1 arası
    abilityDamageBonus?: number; // çarpan
    shieldDmgReduction?: number; // sadece warrior
    thornsDamage?: number;       // saldırana yansıyan hasar
    critChance?: number;         // 0-1 arası
    critMultiplier?: number;     // çarpan
    dodgeChance?: number;        // 0-1 arası
    manaRegen?: number;          // tick başına ek regen
    hpRegen?: number;            // tick başına ek regen
  };
};

// Sınıf başına dal isimleri
export const TALENT_BRANCH_NAMES: Record<PlayerClass, Record<TalentBranch, { name: string; emoji: string; description: string }>> = {
  warrior: {
    branch_a: { name: 'Kale', emoji: '🛡️', description: 'Savunma ve dayanıklılık' },
    branch_b: { name: 'Berserker', emoji: '🔥', description: 'Saldırı ve can çalma' },
    branch_c: { name: 'Komutan', emoji: '⚔️', description: 'Takım güçlendirmeleri' },
  },
  mage: {
    branch_a: { name: 'Ateş Ustası', emoji: '🔥', description: 'Ham hasar gücü' },
    branch_b: { name: 'Buz Ustası', emoji: '❄️', description: 'Kontrol ve yavaşlatma' },
    branch_c: { name: 'Arkanist', emoji: '✨', description: 'Mana verimliliği ve cooldown' },
  },
  archer: {
    branch_a: { name: 'Keskin Nişancı', emoji: '🎯', description: 'Kritik vuruş ve menzil' },
    branch_b: { name: 'Tuzakçı', emoji: '🕸️', description: 'Debuff ve alan hasarı' },
    branch_c: { name: 'İzci', emoji: '🏃', description: 'Hız ve kaçınma' },
  },
} as const;

// Her sınıf, her dal, her level için talent tanımları
export const TALENT_TREE: Record<PlayerClass, TalentDef[]> = {
  warrior: [
    // Kale (branch_a)
    { id: 'w_a2', name: 'Demir Deri', description: '+15 savunma, kalkan %80 blok', branch: 'branch_a', level: 2, effects: { defense: 15, shieldDmgReduction: 0.8 } },
    { id: 'w_a3', name: 'Dikenli Zırh', description: 'Saldırana 8 hasar yansıt', branch: 'branch_a', level: 3, effects: { thornsDamage: 8 } },
    { id: 'w_a4', name: 'Kale Duvarı', description: '+40 max HP, kalkan HP rejen', branch: 'branch_a', level: 4, effects: { maxHp: 40, hpRegen: 0.04 } },
    { id: 'w_a5', name: 'Yıkılmaz', description: '+20 savunma, +30 max HP', branch: 'branch_a', level: 5, effects: { defense: 20, maxHp: 30 } },
    { id: 'w_a6', name: 'Son Kale', description: '+60 max HP, kalkan %85 blok', branch: 'branch_a', level: 6, effects: { maxHp: 60, shieldDmgReduction: 0.85 } },
    // Berserker (branch_b)
    { id: 'w_b2', name: 'Kan Hasadı', description: '+8 saldırı, %10 can çalma', branch: 'branch_b', level: 2, effects: { attack: 8, lifesteal: 0.1 } },
    { id: 'w_b3', name: 'Öfke', description: '+12 saldırı', branch: 'branch_b', level: 3, effects: { attack: 12 } },
    { id: 'w_b4', name: 'Kanlı Bıçak', description: '%15 can çalma, +5 saldırı', branch: 'branch_b', level: 4, effects: { lifesteal: 0.15, attack: 5 } },
    { id: 'w_b5', name: 'Çılgın Savaşçı', description: '+15 saldırı, +20 max HP', branch: 'branch_b', level: 5, effects: { attack: 15, maxHp: 20 } },
    { id: 'w_b6', name: 'Ölüm Makinesi', description: '+20 saldırı, %20 can çalma', branch: 'branch_b', level: 6, effects: { attack: 20, lifesteal: 0.2 } },
    // Komutan (branch_c)
    { id: 'w_c2', name: 'Savaş Narası', description: '+5 saldırı, +10 savunma', branch: 'branch_c', level: 2, effects: { attack: 5, defense: 10 } },
    { id: 'w_c3', name: 'İlham', description: '+20 max HP, +10 max mana', branch: 'branch_c', level: 3, effects: { maxHp: 20, maxMana: 10 } },
    { id: 'w_c4', name: 'Taktik Üstünlük', description: '+8 saldırı, +8 savunma', branch: 'branch_c', level: 4, effects: { attack: 8, defense: 8 } },
    { id: 'w_c5', name: 'Lider', description: '+30 max HP, +15 max mana', branch: 'branch_c', level: 5, effects: { maxHp: 30, maxMana: 15 } },
    { id: 'w_c6', name: 'Savaş Lordu', description: '+15 saldırı, +15 savunma, +30 HP', branch: 'branch_c', level: 6, effects: { attack: 15, defense: 15, maxHp: 30 } },
  ],
  mage: [
    // Ateş Ustası (branch_a)
    { id: 'm_a2', name: 'Alev Gücü', description: '+10 saldırı', branch: 'branch_a', level: 2, effects: { attack: 10 } },
    { id: 'm_a3', name: 'Yangın', description: '+15 saldırı, yetenek %20 bonus', branch: 'branch_a', level: 3, effects: { attack: 15, abilityDamageBonus: 0.2 } },
    { id: 'm_a4', name: 'Cehennem Ateşi', description: '+12 saldırı, yetenek %30 bonus', branch: 'branch_a', level: 4, effects: { attack: 12, abilityDamageBonus: 0.3 } },
    { id: 'm_a5', name: 'Ateş Lordu', description: '+20 saldırı', branch: 'branch_a', level: 5, effects: { attack: 20 } },
    { id: 'm_a6', name: 'Güneş Çarpması', description: '+25 saldırı, yetenek %40 bonus', branch: 'branch_a', level: 6, effects: { attack: 25, abilityDamageBonus: 0.4 } },
    // Buz Ustası (branch_b)
    { id: 'm_b2', name: 'Buz Kalkanı', description: '+8 savunma, +5 saldırı', branch: 'branch_b', level: 2, effects: { defense: 8, attack: 5 } },
    { id: 'm_b3', name: 'Don', description: '+20 max HP, +8 savunma', branch: 'branch_b', level: 3, effects: { maxHp: 20, defense: 8 } },
    { id: 'm_b4', name: 'Buzul', description: '+10 saldırı, +10 savunma', branch: 'branch_b', level: 4, effects: { attack: 10, defense: 10 } },
    { id: 'm_b5', name: 'Kış Fırtınası', description: '+30 max HP, yetenek %25 bonus', branch: 'branch_b', level: 5, effects: { maxHp: 30, abilityDamageBonus: 0.25 } },
    { id: 'm_b6', name: 'Mutlak Sıfır', description: '+15 saldırı, +15 savunma, +20 HP', branch: 'branch_b', level: 6, effects: { attack: 15, defense: 15, maxHp: 20 } },
    // Arkanist (branch_c)
    { id: 'm_c2', name: 'Mana Akışı', description: '+30 max mana, mana regen artışı', branch: 'branch_c', level: 2, effects: { maxMana: 30, manaRegen: 0.03 } },
    { id: 'm_c3', name: 'Verimlilik', description: '%20 mana maliyet azalma, +10 saldırı', branch: 'branch_c', level: 3, effects: { manaCostReduction: 0.2, attack: 10 } },
    { id: 'm_c4', name: 'Arkan Bilgeliği', description: '+40 max mana, +8 saldırı', branch: 'branch_c', level: 4, effects: { maxMana: 40, attack: 8 } },
    { id: 'm_c5', name: 'Sonsuz Akış', description: '%30 mana azalma, mana regen artışı', branch: 'branch_c', level: 5, effects: { manaCostReduction: 0.3, manaRegen: 0.05 } },
    { id: 'm_c6', name: 'Arkan Lord', description: '+50 max mana, +15 saldırı, %35 azalma', branch: 'branch_c', level: 6, effects: { maxMana: 50, attack: 15, manaCostReduction: 0.35 } },
  ],
  archer: [
    // Keskin Nişancı (branch_a)
    { id: 'a_a2', name: 'Keskin Göz', description: '%15 kritik şansı', branch: 'branch_a', level: 2, effects: { critChance: 0.15 } },
    { id: 'a_a3', name: 'Zayıf Nokta', description: '+10 saldırı, kritik 2x hasar', branch: 'branch_a', level: 3, effects: { attack: 10, critMultiplier: 2.0 } },
    { id: 'a_a4', name: 'Ölümcül Nişan', description: '%25 kritik şansı, +5 saldırı', branch: 'branch_a', level: 4, effects: { critChance: 0.25, attack: 5 } },
    { id: 'a_a5', name: 'Tek Atış', description: '+15 saldırı, kritik 2.5x hasar', branch: 'branch_a', level: 5, effects: { attack: 15, critMultiplier: 2.5 } },
    { id: 'a_a6', name: 'Hayalet Okçu', description: '%35 kritik, +20 saldırı', branch: 'branch_a', level: 6, effects: { critChance: 0.35, attack: 20 } },
    // Tuzakçı (branch_b)
    { id: 'a_b2', name: 'Zehirli Ok', description: '+8 saldırı, yetenek %15 bonus', branch: 'branch_b', level: 2, effects: { attack: 8, abilityDamageBonus: 0.15 } },
    { id: 'a_b3', name: 'Patlayıcı Ok', description: '+12 saldırı, yetenek %25 bonus', branch: 'branch_b', level: 3, effects: { attack: 12, abilityDamageBonus: 0.25 } },
    { id: 'a_b4', name: 'Ölüm Tuzağı', description: '+10 saldırı, +20 max HP', branch: 'branch_b', level: 4, effects: { attack: 10, maxHp: 20 } },
    { id: 'a_b5', name: 'Mayın Tarlası', description: 'Yetenek %40 bonus, +8 saldırı', branch: 'branch_b', level: 5, effects: { abilityDamageBonus: 0.4, attack: 8 } },
    { id: 'a_b6', name: 'Kaos Okçusu', description: '+20 saldırı, yetenek %50 bonus', branch: 'branch_b', level: 6, effects: { attack: 20, abilityDamageBonus: 0.5 } },
    // İzci (branch_c)
    { id: 'a_c2', name: 'Rüzgar Adımı', description: '+0.3 hız, %10 kaçınma', branch: 'branch_c', level: 2, effects: { speed: 0.3, dodgeChance: 0.1 } },
    { id: 'a_c3', name: 'Gölge Adım', description: '%15 kaçınma, +20 max HP', branch: 'branch_c', level: 3, effects: { dodgeChance: 0.15, maxHp: 20 } },
    { id: 'a_c4', name: 'Hayalet Koşucu', description: '+0.4 hız, +8 saldırı', branch: 'branch_c', level: 4, effects: { speed: 0.4, attack: 8 } },
    { id: 'a_c5', name: 'Rüzgar Okçusu', description: '%20 kaçınma, +10 saldırı', branch: 'branch_c', level: 5, effects: { dodgeChance: 0.2, attack: 10 } },
    { id: 'a_c6', name: 'Fırtına İzci', description: '+0.5 hız, %25 kaçınma, +15 saldırı', branch: 'branch_c', level: 6, effects: { speed: 0.5, dodgeChance: 0.25, attack: 15 } },
  ],
} as const;

// --- Entity Tipleri ---
export type Vec2 = { x: number; y: number };

export type PlayerState = {
  id: string;
  name: string;
  class: PlayerClass;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  xp: number;
  level: number;
  alive: boolean;
  facing: Direction;
  attacking: boolean;
  lastAttackTime: number;
  score: number;
  abilityActive: boolean;
  abilityCooldownTicks: number;
  speedBoosted: boolean;
  totalDamageDealt: number;
  goldCollected: number;
  // Phase 1: Talent sistemi
  gold: number;
  talents: TalentId[];
  talentBranch: TalentBranch | null;
  pendingTalentChoice: boolean;
  // Phase 3: Elite/Modifier istatistikleri
  stunTicks: number;
};

export type MonsterState = {
  id: string;
  type: MonsterType;
  position: Vec2;
  velocity: Vec2;
  hp: number;
  maxHp: number;
  alive: boolean;
  targetPlayerId: string | null;
  facing: Direction;
  isElite: boolean;
  bossPhase: number;
};

export type ProjectileState = {
  id: string;
  ownerId: string;
  position: Vec2;
  velocity: Vec2;
  direction: Vec2;
  damage: number;
  lifetime: number;
  type: 'arrow' | 'fireball' | 'sword_slash';
};

export type LootState = {
  id: string;
  type: LootType;
  position: Vec2;
  value: number;
};

export type DungeonRoom = {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  isBossRoom: boolean;
  isStartRoom: boolean;
  cleared: boolean;
  monsterIds: string[];
};

// --- Oyun Durumu ---
// --- Floor Modifier (Kat Laneti) ---
export type FloorModifierId = 'reduced_healing' | 'darkness' | 'haste_monsters' | 'fragile' | 'drought' | 'burning_ground';
export type FloorModifier = {
  id: FloorModifierId;
  name: string;
  description: string;
};
export const FLOOR_MODIFIERS: Record<FloorModifierId, FloorModifier> = {
  reduced_healing: { id: 'reduced_healing', name: 'Zayıf İyileşme', description: 'İksirler %50 daha az iyileştirir' },
  darkness: { id: 'darkness', name: 'Karanlık', description: 'Görüş mesafesi azaldı' },
  haste_monsters: { id: 'haste_monsters', name: 'Hızlı Düşmanlar', description: 'Canavarlar %30 daha hızlı' },
  fragile: { id: 'fragile', name: 'Kırılgan', description: 'Alınan hasar %20 artırıldı' },
  drought: { id: 'drought', name: 'Kuraklık', description: 'Mana yenilenmesi yarıya indi' },
  burning_ground: { id: 'burning_ground', name: 'Yanan Zemin', description: 'Rastgele zeminler tutuşuyor' },
} as const;

// --- Dükkan Sistemi ---
export type ShopItemType = 'consumable' | 'upgrade';
export type ShopItem = {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: ShopItemType;
  emoji: string;
  floorRequirement?: number;
  effect: {
    hp?: number;
    mana?: number;
    maxHp?: number;
    maxMana?: number;
    attack?: number;
    defense?: number;
    speed?: number;
  };
};

export const SHOP_ITEMS: ShopItem[] = [
  // Tüketimlikler
  { id: 'large_health', name: 'Büyük Can İksiri', description: '+60 HP', cost: 30, type: 'consumable', emoji: '❤️', effect: { hp: 60 } },
  { id: 'large_mana', name: 'Büyük Mana İksiri', description: '+50 Mana', cost: 25, type: 'consumable', emoji: '💙', effect: { mana: 50 } },
  // Kalıcı yükseltmeler
  { id: 'reinforced_armor', name: 'Güçlendirilmiş Zırh', description: '+5 kalıcı savunma', cost: 60, type: 'upgrade', emoji: '🛡️', effect: { defense: 5 } },
  { id: 'sharpened_blade', name: 'Bilenen Kılıç', description: '+3 kalıcı saldırı', cost: 50, type: 'upgrade', emoji: '⚔️', effect: { attack: 3 } },
  { id: 'vitality_charm', name: 'Yaşam Tılsımı', description: '+20 kalıcı max HP', cost: 70, type: 'upgrade', emoji: '💚', effect: { maxHp: 20 } },
  { id: 'mana_crystal', name: 'Mana Kristali', description: '+15 kalıcı max mana', cost: 55, type: 'upgrade', emoji: '🔮', effect: { maxMana: 15 } },
  { id: 'swift_boots', name: 'Çevik Çizmeler', description: '+0.2 kalıcı hız', cost: 65, type: 'upgrade', emoji: '👢', effect: { speed: 0.2 } },
  // Geç kat özel eşyalar
  { id: 'fire_resist', name: 'Ateş Direnci', description: '+8 savunma, +15 max HP', cost: 100, type: 'upgrade', emoji: '🔥', floorRequirement: 7, effect: { defense: 8, maxHp: 15 } },
  { id: 'shadow_cloak', name: 'Gölge Pelerini', description: '+5 saldırı, +10 savunma', cost: 120, type: 'upgrade', emoji: '🌑', floorRequirement: 6, effect: { attack: 5, defense: 10 } },
] as const;

export type GameState = {
  roomCode: string;
  phase: GamePhase;
  tick: number;
  players: Record<string, PlayerState>;
  monsters: Record<string, MonsterState>;
  projectiles: Record<string, ProjectileState>;
  loot: Record<string, LootState>;
  dungeon: {
    tiles: TileType[][];
    rooms: DungeonRoom[];
    width: number;
    height: number;
    currentFloor: number;
  };
  currentRoomId: number;
  isSolo: boolean;
  soloDeathsRemaining: number;
  currentFloorModifiers: FloorModifier[];
};

// --- Socket Events ---

// Client → Server
export type ClientEvents = {
  'room:create': (data: { playerName: string }) => void;
  'room:create_solo': (data: { playerName: string }) => void;
  'room:join': (data: { roomCode: string; playerName: string }) => void;
  'player:class_select': (data: { playerClass: PlayerClass }) => void;
  'player:ready': () => void;
  'player:input': (data: PlayerInput) => void;
  'player:attack': () => void;
  'player:use_ability': () => void;
  'player:interact': () => void;
  'player:select_talent': (data: { talentId: TalentId }) => void;
  'player:buy_item': (data: { itemId: string }) => void;
  'player:shop_done': () => void;
  'chat:send': (data: { text: string }) => void;
};

// Server → Client
export type ServerEvents = {
  'room:created': (data: { roomCode: string; playerId: string }) => void;
  'room:joined': (data: { playerId: string; players: Record<string, PlayerState> }) => void;
  'room:player_joined': (data: { player: PlayerState }) => void;
  'room:player_left': (data: { playerId: string }) => void;
  'room:error': (data: { message: string }) => void;
  'game:phase_change': (data: { phase: GamePhase }) => void;
  'game:state': (data: GameState) => void;
  'game:damage': (data: { targetId: string; damage: number; sourceId: string }) => void;
  'game:loot_pickup': (data: { playerId: string; loot: LootState }) => void;
  'game:monster_killed': (data: { monsterId: string; killerId: string; xp: number }) => void;
  'game:player_died': (data: { playerId: string }) => void;
  'game:room_cleared': (data: { roomId: number }) => void;
  'game:floor_complete': (data: { floor: number }) => void;
  'game:chest_opened': (data: { x: number; y: number }) => void;
  'game:stairs_used': () => void;
  'game:victory': () => void;
  'game:defeat': () => void;
  'game:talent_choice': (data: { playerId: string; talents: TalentDef[] }) => void;
  'game:talent_selected': (data: { playerId: string; talentId: TalentId }) => void;
  'game:level_up': (data: { playerId: string; level: number }) => void;
  'game:shop_open': (data: { items: ShopItem[]; playerGold: Record<string, number> }) => void;
  'game:item_purchased': (data: { playerId: string; itemId: string; remainingGold: number }) => void;
  'game:boss_phase': (data: { monsterId: string; phase: number }) => void;
  'game:boss_dialogue': (data: { monsterId: string; bossType: string; dialogue: string; phase: number }) => void;
  'game:floor_modifier': (data: { modifiers: FloorModifier[] }) => void;
  'chat:message': (data: { playerId: string; name: string; text: string }) => void;
};

// Player Input (her tick gönderilir)
export type PlayerInput = {
  dx: number; // -1 to 1
  dy: number; // -1 to 1
  attack: boolean;
  ability: boolean;
  interact?: boolean;
  sprint?: boolean;
  toggleMap?: boolean;
};

// --- Yetenek Sonuçları ---
export type AbilityResult =
  | { type: 'shield_wall' }
  | { type: 'ice_storm'; position: Vec2; damage: number; radius: number }
  | { type: 'arrow_rain'; projectiles: { id: string; ownerId: string; position: Vec2; direction: Vec2; damage: number }[] };

// Loot tablosu
export const LOOT_TABLE: Record<LootType, { chance: number; value: number; label: string; color: string }> = {
  health_potion: { chance: 0.25, value: 25, label: 'Can İksiri', color: '#ef4444' },
  mana_potion: { chance: 0.18, value: 20, label: 'Mana İksiri', color: '#3b82f6' },
  damage_boost: { chance: 0.05, value: 5, label: 'Güç Artışı', color: '#f59e0b' },
  speed_boost: { chance: 0.07, value: 0.3, label: 'Hız Artışı', color: '#06b6d4' },
  gold: { chance: 0.35, value: 10, label: 'Altın', color: '#eab308' },
} as const;
// Gold değeri kat bazlı: 5 + floor * 2
export function goldValueForFloor(floor: number): number {
  return 5 + floor * 2;
}
