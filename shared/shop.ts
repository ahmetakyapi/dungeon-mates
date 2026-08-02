// ==========================================
// Dungeon Mates — Shop System
// ==========================================

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
  levelRequirement?: number;
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
  // === Tier 1: Temel (Level 1+) ===
  // Tüketimlikler
  { id: 'small_health', name: 'Küçük Can İksiri', description: '+30 HP', cost: 20, type: 'consumable', emoji: '🩹', effect: { hp: 30 } },
  { id: 'small_mana', name: 'Küçük Mana İksiri', description: '+20 Mana', cost: 15, type: 'consumable', emoji: '💧', effect: { mana: 20 } },
  // Temel yükseltmeler
  { id: 'leather_patch', name: 'Deri Yama', description: '+3 kalıcı savunma', cost: 45, type: 'upgrade', emoji: '🧥', effect: { defense: 3 } },
  { id: 'whetstone', name: 'Bileme Taşı', description: '+2 kalıcı saldırı', cost: 40, type: 'upgrade', emoji: '🪨', effect: { attack: 2 } },

  // === Tier 2: Orta (Level 3+) ===
  { id: 'large_health', name: 'Büyük Can İksiri', description: '+60 HP', cost: 50, type: 'consumable', emoji: '❤️', levelRequirement: 3, effect: { hp: 60 } },
  { id: 'large_mana', name: 'Büyük Mana İksiri', description: '+50 Mana', cost: 40, type: 'consumable', emoji: '💙', levelRequirement: 3, effect: { mana: 50 } },
  { id: 'reinforced_armor', name: 'Güçlendirilmiş Zırh', description: '+5 kalıcı savunma', cost: 90, type: 'upgrade', emoji: '🛡️', levelRequirement: 3, effect: { defense: 5 } },
  { id: 'sharpened_blade', name: 'Bilenen Kılıç', description: '+3 kalıcı saldırı', cost: 80, type: 'upgrade', emoji: '⚔️', levelRequirement: 3, effect: { attack: 3 } },
  { id: 'vitality_charm', name: 'Yaşam Tılsımı', description: '+15 kalıcı max HP', cost: 100, type: 'upgrade', emoji: '💚', levelRequirement: 3, effect: { maxHp: 15 } },

  // === Tier 3: İleri (Level 5+) ===
  { id: 'mana_crystal', name: 'Mana Kristali', description: '+20 kalıcı max mana', cost: 120, type: 'upgrade', emoji: '🔮', levelRequirement: 5, effect: { maxMana: 20 } },
  { id: 'swift_boots', name: 'Çevik Çizmeler', description: '+0.15 kalıcı hız', cost: 130, type: 'upgrade', emoji: '👢', levelRequirement: 5, effect: { speed: 0.15 } },
  { id: 'iron_shield', name: 'Demir Kalkan', description: '+8 savunma, +10 max HP', cost: 150, type: 'upgrade', emoji: '🔰', levelRequirement: 5, effect: { defense: 8, maxHp: 10 } },
  { id: 'battle_axe', name: 'Savaş Baltası', description: '+5 saldırı', cost: 160, type: 'upgrade', emoji: '🪓', levelRequirement: 5, effect: { attack: 5 } },

  // === Tier 4: Uzman (Level 7+) ===
  { id: 'fire_resist', name: 'Ateş Direnci', description: '+10 savunma, +20 max HP', cost: 220, type: 'upgrade', emoji: '🔥', levelRequirement: 7, floorRequirement: 6, effect: { defense: 10, maxHp: 20 } },
  { id: 'shadow_cloak', name: 'Gölge Pelerini', description: '+6 saldırı, +12 savunma', cost: 250, type: 'upgrade', emoji: '🌑', levelRequirement: 7, floorRequirement: 6, effect: { attack: 6, defense: 12 } },
  { id: 'arcane_tome', name: 'Kadim Büyü Kitabı', description: '+30 max mana, +4 saldırı', cost: 230, type: 'upgrade', emoji: '📖', levelRequirement: 7, effect: { maxMana: 30, attack: 4 } },
  { id: 'vampiric_ring', name: 'Vampirik Yüzük', description: '+7 saldırı, +25 max HP', cost: 280, type: 'upgrade', emoji: '💍', levelRequirement: 7, effect: { attack: 7, maxHp: 25 } },

  // === Tier 5: Efsane (Level 9+) ===
  { id: 'dragon_plate', name: 'Ejder Zırhı', description: '+18 savunma, +40 max HP', cost: 400, type: 'upgrade', emoji: '🐉', levelRequirement: 9, floorRequirement: 8, effect: { defense: 18, maxHp: 40 } },
  { id: 'soul_blade', name: 'Ruh Kılıcı', description: '+12 saldırı, +0.1 hız', cost: 450, type: 'upgrade', emoji: '🗡️', levelRequirement: 9, floorRequirement: 8, effect: { attack: 12, speed: 0.1 } },
  { id: 'phoenix_elixir', name: 'Anka İksiri', description: 'Tam can ve mana', cost: 300, type: 'consumable', emoji: '🦅', levelRequirement: 9, effect: { hp: 999, mana: 999 } },
] as const;

// ==========================================
// Stok, nadirlik ve yeniden çekme
//
// Dükkân eskiden o kata uygun HER eşyayı gösteriyordu. Bu, dükkânı bir karar
// olmaktan çıkarıp bir listeye çeviriyordu: ne istiyorsan hep oradaydı, tek
// kısıt altındı. Sınırlı stok kıtlık yaratıyor, yeniden çekme de kötü bir
// stoğa mahkûm kalmamak için altınla ödenen bir çıkış yolu veriyor.
// ==========================================

export type ShopRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/** Nadirlik seviye şartından türetiliyor — ayrı bir alan drift ederdi. */
export function shopRarity(item: ShopItem): ShopRarity {
  const lv = item.levelRequirement ?? 1;
  if (lv >= 9) return 'legendary';
  if (lv >= 7) return 'epic';
  if (lv >= 5) return 'rare';
  if (lv >= 3) return 'uncommon';
  return 'common';
}

export const RARITY_STYLE: Record<ShopRarity, { label: string; color: string; glow: string }> = {
  common: { label: 'Sıradan', color: '#a1a1aa', glow: 'rgba(161,161,170,0.25)' },
  uncommon: { label: 'Nadir', color: '#4ade80', glow: 'rgba(74,222,128,0.3)' },
  rare: { label: 'Ender', color: '#60a5fa', glow: 'rgba(96,165,250,0.35)' },
  epic: { label: 'Destansı', color: '#c084fc', glow: 'rgba(192,132,252,0.4)' },
  legendary: { label: 'Efsane', color: '#fbbf24', glow: 'rgba(251,191,36,0.45)' },
};

/** Bir dükkân ziyaretinde kaç eşya sergilenir. */
export const SHOP_STOCK_SIZE = 6;
/** İlk yeniden çekmenin bedeli; her çekmede bu kadar artar. */
export const SHOP_REROLL_BASE_COST = 30;

export function rerollCost(timesRerolled: number): number {
  return SHOP_REROLL_BASE_COST * (timesRerolled + 1);
}

/**
 * Bir ziyaret için stok çek.
 *
 * Ağırlıklar oyuncunun seviyesine göre kayıyor: erken oyunda çoğunlukla ucuz
 * ve kullanışlı şeyler, geç oyunda üst kademeler. En az bir tüketimlik garanti
 * — canı azalmış bir takımın iksir bulamadan çıktığı bir dükkân, dükkân değil
 * cezadır.
 */
export function rollShopStock(
  floor: number,
  maxPlayerLevel: number,
  rng: () => number = Math.random,
): ShopItem[] {
  const eligible = SHOP_ITEMS.filter((item) =>
    (!item.floorRequirement || floor >= item.floorRequirement) &&
    (!item.levelRequirement || maxPlayerLevel >= item.levelRequirement));

  if (eligible.length <= SHOP_STOCK_SIZE) return [...eligible];

  const weightOf = (item: ShopItem): number => {
    const gap = maxPlayerLevel - (item.levelRequirement ?? 1);
    // Kendi kademesindekiler en olası; çok gerideki kademeler seyrekleşiyor
    // ama tamamen kaybolmuyor (ucuz iksirler her zaman işe yarar).
    if (gap <= 1) return 5;
    if (gap <= 3) return 3;
    if (gap <= 5) return 2;
    return 1;
  };

  const pool = [...eligible];
  const picked: ShopItem[] = [];

  // Önce bir tüketimlik garanti et.
  const consumables = pool.filter((i) => i.type === 'consumable');
  if (consumables.length > 0) {
    const c = consumables[Math.floor(rng() * consumables.length)];
    picked.push(c);
    pool.splice(pool.indexOf(c), 1);
  }

  while (picked.length < SHOP_STOCK_SIZE && pool.length > 0) {
    let total = 0;
    for (const item of pool) total += weightOf(item);
    let roll = rng() * total;
    let idx = 0;
    for (let i = 0; i < pool.length; i++) {
      roll -= weightOf(pool[i]);
      if (roll <= 0) { idx = i; break; }
      idx = i;
    }
    picked.push(pool[idx]);
    pool.splice(idx, 1);
  }

  // Ucuzdan pahalıya — göz önce ödeyebileceği şeyi görsün.
  return picked.sort((a, b) => a.cost - b.cost);
}
