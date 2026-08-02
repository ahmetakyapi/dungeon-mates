// ==========================================
// Dungeon Mates — Kat Modifiye Ediciler
//
// Eskiden altı tane vardı ve altısı da düz cezaydı. Kat 4'te başlayıp katta bir
// (kat 7'den sonra iki) çekildiği için oyuncu havuzun tamamını beşinci kata
// varmadan görüyordu — ve hepsi aynı cümleyi kuruyordu: "bu kat biraz daha kötü".
//
// Takas edici modifiye ediciler bunu değiştiriyor. Bir tarafı verip bir tarafı
// alıyorlar, yani katı yalnızca zorlaştırmıyor, o katta nasıl oynadığını
// değiştiriyorlar: Cam Kanon'da her dövüş kimin önce vurduğuna dönüşüyor,
// Sürü'de tek hedefli build'ler tıkanırken alan hasarı parlıyor. Bir run'ın
// diğerinden farklı hissetmesini sağlayan şey bu.
// ==========================================

export type FloorModifierId =
  | 'reduced_healing' | 'darkness' | 'haste_monsters' | 'fragile' | 'drought' | 'burning_ground'
  | 'glass_cannon' | 'swarm' | 'frenzy' | 'brittle_foes';

/**
 * `curse` tek yönlü ceza, `tradeoff` iki yönlü.
 * Arayüz ikisini farklı renklendiriyor — oyuncu neyle karşılaştığını
 * okumadan önce görebilmeli.
 */
export type FloorModifierKind = 'curse' | 'tradeoff';

export type FloorModifier = {
  id: FloorModifierId;
  name: string;
  description: string;
  kind: FloorModifierKind;
};

export const FLOOR_MODIFIERS: Record<FloorModifierId, FloorModifier> = {
  // --- tek yönlü cezalar ---
  reduced_healing: { id: 'reduced_healing', name: 'Zayıf İyileşme', description: 'İksirler %50 daha az iyileştirir', kind: 'curse' },
  darkness: { id: 'darkness', name: 'Karanlık', description: 'Görüş mesafesi azaldı', kind: 'curse' },
  haste_monsters: { id: 'haste_monsters', name: 'Hızlı Düşmanlar', description: 'Canavarlar %30 daha hızlı', kind: 'curse' },
  fragile: { id: 'fragile', name: 'Kırılgan', description: 'Alınan hasar %20 artırıldı', kind: 'curse' },
  drought: { id: 'drought', name: 'Kuraklık', description: 'Mana yenilenmesi yarıya indi', kind: 'curse' },
  burning_ground: { id: 'burning_ground', name: 'Yanan Zemin', description: 'Rastgele zeminler tutuşuyor', kind: 'curse' },

  // --- takaslar: bir şey verir, bir şey alır ---
  glass_cannon: {
    id: 'glass_cannon', name: 'Cam Kanon', kind: 'tradeoff',
    description: 'Verdiğin hasar %45 artar, aldığın hasar %35 artar',
  },
  swarm: {
    id: 'swarm', name: 'Sürü', kind: 'tradeoff',
    description: 'Canavar sayısı %60 artar, canları %40 azalır',
  },
  frenzy: {
    id: 'frenzy', name: 'Cinnet', kind: 'tradeoff',
    description: 'Canavarlar %35 daha hızlı saldırır, %30 daha az vurur',
  },
  brittle_foes: {
    id: 'brittle_foes', name: 'Çatlak Kabuk', kind: 'tradeoff',
    description: 'Canavarların savunması yok, ama %25 daha sert vuruyorlar',
  },
} as const;

/** Sayısal etkiler tek yerde: sunucu bunları okuyor, arayüz açıklamayı. */
export const MODIFIER_EFFECTS = {
  glassCannonPlayerDamage: 1.45,
  glassCannonDamageTaken: 1.35,
  swarmCountMult: 1.6,
  swarmHpMult: 0.6,
  frenzyCooldownMult: 0.65,
  frenzyDamageMult: 0.7,
  brittleDamageMult: 1.25,
  fragileDamageTaken: 1.2,
  hasteSpeedMult: 1.3,
} as const;
