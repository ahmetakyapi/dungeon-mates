// ==========================================
// Dungeon Mates — Kalıcı Ayarlar
//
// Grafik kalitesi ve FPS göstergesi page.tsx içinde düz useState'ti; her sayfa
// yenilemesinde sıfırlanıyordu. Ekran sarsıntısı şiddeti, flash kapatma ve
// azaltılmış hareket için hiçbir ayar yoktu — bu üçü de erişilebilirlik açısından
// isteğe bağlı olmalı (ışığa duyarlılık, hareket hastalığı).
// ==========================================

export type QualityLevel = 'low' | 'medium' | 'high';

export type GameSettings = {
  quality: QualityLevel;
  showFps: boolean;
  /** 0 = kapalı, 1 = tam. Ekran sarsıntısı çarpanı. */
  screenShake: number;
  /** Tam ekran parlamalar (kritik vuruş, boss girişi, ganimet). */
  screenFlash: boolean;
  /** Film grain, ısı bozulması gibi ambient post-processing. */
  ambientEffects: boolean;
  /** UI animasyonlarını azalt — sistem tercihini geçersiz kılar. */
  reducedMotion: boolean;
  /**
   * Saldırı telegrafları için yüksek kontrastlı renk. Zindanın en güvenlik-kritik
   * rengi bu: koyu taş üzerinde kırmızı tehlike alanı, kırmızı-yeşil renk körlüğü
   * olan oyuncular için en zor okunan kombinasyon.
   */
  highContrastTelegraph: boolean;
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
};

const STORAGE_KEY = 'dungeon-mates-settings-v1';

export const DEFAULT_SETTINGS: GameSettings = {
  quality: 'high',
  showFps: false,
  // Full strength was fatiguing over a 15-minute run. Still clearly present,
  // and the slider goes back to 1 for anyone who wants it.
  screenShake: 0.7,
  screenFlash: true,
  ambientEffects: true,
  reducedMotion: false,
  highContrastTelegraph: false,
  masterVolume: 0.5,
  sfxVolume: 0.7,
  musicVolume: 0.3,
  muted: false,
};

/** True when the OS asks for reduced motion. */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function loadSettings(): GameSettings {
  if (typeof window === 'undefined') return { ...DEFAULT_SETTINGS };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const stored = raw ? (JSON.parse(raw) as Partial<GameSettings>) : {};
    return {
      ...DEFAULT_SETTINGS,
      // Respect the OS preference as the default, but let an explicit choice win.
      reducedMotion: prefersReducedMotion(),
      ...stored,
    };
  } catch {
    return { ...DEFAULT_SETTINGS, reducedMotion: prefersReducedMotion() };
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode / quota — settings simply stay session-only.
  }
}
