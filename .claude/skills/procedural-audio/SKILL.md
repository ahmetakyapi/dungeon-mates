---
name: procedural-audio
description: Activate when working on SoundManager.ts, useSound.ts, or any audio-related code. Covers Web Audio API synthesizer, per-floor music, ambient sounds, and sound effect design.
---

# Procedural Audio — Web Audio API Synthesizer

Tum sesler Web Audio API ile runtime'da sentezlenir — ses dosyasi yok.

## Mimari

```
SoundManager (singleton, ~780 satir)
  ├── AudioContext lifecycle
  ├── SFX (saldiri, hasar, loot, UI)
  ├── Per-floor muzik (katmanli sentez)
  ├── Ambient katmanlari (su, ruzgar, fisildama, kalp atisi)
  └── Volume / Mute kontrol

useSound.ts (~98 satir)
  └── React hook wrapper — her metod useCallback ile sarilir
```

## Per-Floor Muzik Sistemi

`playFloorMusic(floor)` — kat bazli katmanli sentez:

| Katman | Baslangiç Kati | Dalga | Aciklama |
|---|---|---|---|
| Bass | Kat 1 | Triangle | C minor pentatonik, temel ritm |
| Melodi | Kat 3 | Sine | Ust melodi, pentatonik notalar |
| Dissonans | Kat 5 | Sawtooth (detuned) | Gerilim, hafif detune |
| Perkusyon | Kat 7 | Noise burst | Ritm vuruslari, kat 9+'da her beat |

Tempo: 60 BPM (kat 1) → 84 BPM (kat 10), lineer artis.

`playDungeonMusic()` → dahili olarak `playFloorMusic(1)` cagirir (geriye uyumluluk).

## Ambient Ses Katmanlari

`startAmbience(floor)` / `stopAmbience()`:

| Ses | Baslangiç Kati | Yontem |
|---|---|---|
| Su damlaları | Kat 1 | Sine ping, rastgele aralik |
| Ruzgar | Kat 3 | Filtered noise, yavas sweep |
| Fisiltilar | Kat 6 | Detuned sine cluster, dusuk volume |
| Kalp atisi | Kat 9 | Low-freq sine pulse, 72 BPM |

- Her katman `setInterval` ile calisir
- `stopAmbience()` tum interval'leri temizler
- Mute durumunda ambient sessiz ama interval devam eder

## Saldiri Ses Cesitliligi

Her saldiri sesinde ±10% frekans randomizasyon:

```typescript
const variation = 0.9 + Math.random() * 0.2; // 0.9 - 1.1
osc.frequency.value = baseFreq * variation;
```

| Sinif | Metod | Temel Ses |
|---|---|---|
| Savasci | `playSwordSlash()` | Noise burst + high sweep |
| Okcu | `playArrowShoot()` | Short sine ping + noise |
| Buyucu | `playFireball()` | Low sweep + harmonic |

## Ayak Sesi

`playFootstep()`:
- 220ms cooldown (cok sik calmayi onler)
- Bandpass-filtered noise burst
- Rastgele frekans varyasyonu (dogal ses)

## Muzik State Yonetimi

```
Oyun basladi → playFloorMusic(1) + startAmbience(1)
Kat gecisi    → playFloorMusic(yeniKat) + startAmbience(yeniKat)
Boss fazi     → stopMusic() + stopAmbience() + playBossAppear() → playBossMusic()
Zafer         → stopMusic() + stopAmbience() + playVictory()
Yenilgi       → stopMusic() + stopAmbience() + playDefeat()
Unmount       → stopMusic() + stopAmbience()
```

Entegrasyon: `game/page.tsx`'deki useEffect'lerde phase ve floor degisimlerinde tetiklenir.

## Yeni Ses Ekleme Sirasi

1. `SoundManager.ts` → yeni metod yaz (oscillator + gain + envelope)
2. `useSound.ts` → `useCallback` wrapper ekle + useMemo return objesine ekle
3. `game/page.tsx` → uygun useEffect veya event handler'da cagir

## AudioContext Lifecycle

```typescript
// Ilk kullanici etkilesimi gerekli (browser politikasi)
window.addEventListener('click', () => getManager(), { once: true });
window.addEventListener('touchstart', () => getManager(), { once: true });
```

- Singleton pattern: `SoundManager.getInstance()`
- `destroy()` → `stopMusic()` + `stopAmbience()` + context close

## Performans Kurallari

- Oscillator'leri yeniden kullan (mumkunse)
- `stop()` sonrasi oscillator garbage collect olur — yenisini olustur
- Gain envelope icin `linearRampToValueAtTime` kullan (click onleme)
- Cok fazla eslestirme ambient interval olusturma — mevcut katmanlari kontrol et
