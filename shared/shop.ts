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
