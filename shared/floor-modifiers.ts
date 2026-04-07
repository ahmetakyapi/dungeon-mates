// ==========================================
// Dungeon Mates — Floor Modifiers
// ==========================================

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
