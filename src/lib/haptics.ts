// ==========================================
// Dungeon Mates — Dokunsal geri bildirim
//
// TouchControls zaten düğmelere basınca titriyordu, ama oyunun kendisi hiç
// titremiyordu: hasar almak, bir yaratığı öldürmek, seviye atlamak, boss'un
// gelmesi — telefonda bunların hiçbirinin fiziksel karşılığı yoktu. Masaüstünde
// ekran sarsıntısı bu işi görüyor; dokunmatikte küçük ekran ve parmağın altında
// kalan görüntü yüzünden sarsıntı tek başına yetmiyor.
//
// Titreşim isteğe bağlı olmalı: hem pil hem de erişilebilirlik (vestibüler
// rahatsızlık) açısından. Ekran sarsıntısı ayarı sıfıra çekilmişse titreşim de
// susar — ikisi de aynı "fiziksel geri bildirim istemiyorum" tercihinin parçası.
// ==========================================

/** Kalıp adları; süreler ms cinsinden titreşim/duraklama dizileri. */
const PATTERNS = {
  /** Hafif dokunuş — ganimet, etkileşim. */
  light: [8],
  /** Yaratık öldürme — kısa ve tatmin edici. */
  kill: [14],
  /** Oyuncu hasar aldı — biraz daha uzun, uyarı niteliğinde. */
  hurt: [30],
  /** Kritik durum: can azaldı. Çift darbe, panik hissi. */
  critical: [22, 40, 22],
  /** Seviye atlama — yükselen üçlü. */
  levelUp: [10, 30, 14, 30, 20],
  /** Boss girişi — ağır ve yavaş. */
  boss: [60, 50, 60],
  /** Ölüm. */
  death: [90],
} as const;

export type HapticPattern = keyof typeof PATTERNS;

let enabled = true;

/**
 * Titreşimi aç/kapat. Ayarlardaki ekran sarsıntısı sıfırlanınca burası da
 * kapanır — ikisi aynı tercihin iki yüzü.
 */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/** Cihaz gerçekten titreşim destekliyor mu? Masaüstü tarayıcılar desteklemez. */
export function hapticsSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';
}

/**
 * Bir kalıbı çal. Desteklenmiyorsa ya da kapalıysa sessizce hiçbir şey yapmaz —
 * çağıran taraf kontrol etmek zorunda kalmasın.
 */
export function haptic(pattern: HapticPattern): void {
  if (!enabled || !hapticsSupported()) return;
  try {
    navigator.vibrate(PATTERNS[pattern] as unknown as number[]);
  } catch {
    // Bazı tarayıcılar kullanıcı etkileşimi olmadan çağrılınca atar; yut.
  }
}
