---
name: context-management
description: Activate when context window is getting large, when working across multiple large files simultaneously, when planning multi-step refactors, or when the task spans more than 3 files over 500 lines each.
---

# Context Management — 18k LOC Proje Stratejisi

40 kaynak dosya, ~18.000 satır TypeScript. 6 dosya 500+ satır.

## Büyük Dosyalar (Dikkat!)

| Dosya | Satır | Tehlike |
|---|---|---|
| `SpriteRenderer.ts` | ~2600 | En büyük dosya — tamamını okuma |
| `GameRenderer.ts` | ~2200 | Freeze frame, interpolation, render pipeline |
| `HUD.tsx` | ~1630 | Minimap, skor, boss bar — büyük ama bağımsız bölümler |
| `GameRoom.ts` | ~1120 | Server game loop — client koduyla karıştırma |
| `ParticleSystem.ts` | ~1100 | Pool-based — allocation kurallarına dikkat |
| `game/page.tsx` | ~925 | Ana orkestratör — tüm state burada |
| `SoundManager.ts` | ~780 | Per-floor müzik + ambient katmanları |
| `Monster.ts` | ~740 | 14 canavar AI |

**ASLA aynı anda açma:**
- `GameRenderer.ts` + `SpriteRenderer.ts` = ~4800 satır → context patlar

## Güvenli Bağımsız Dosyalar

Diğer dosyaları etkilemeden düzenlenebilir:
- `src/components/game/*.tsx` — UI bileşenleri (HUD hariç, o büyük)
- `src/game/audio/SoundManager.ts` — izole ses motoru
- `server/dungeon/DungeonGenerator.ts` — bağımsız BSP algoritması
- `src/game/input/TouchControls.ts` — mobil input
- `src/game/renderer/Camera.ts` — kamera sistemi

## Birlikte Değişmesi Gereken Dosyalar

| Değişiklik | Etkilenen dosyalar |
|---|---|
| Yeni `MonsterType` | `shared/types.ts` → `Monster.ts` → `SpriteRenderer.ts` → `GameRoom.ts` → `HUD.tsx` |
| Yeni socket event | `shared/types.ts` → `GameRoom.ts` → `useGameSocket.ts` → `game/page.tsx` |
| Yeni loot tipi | `shared/types.ts` → `GameRoom.ts` → `GameRenderer.ts` |
| Yeni kat | `DungeonGenerator.ts` → `GameRoom.ts` → `FloorTransition.tsx` → `StoryIntro.tsx` → `LoadingScreen.tsx` |
| Yeni ses | `SoundManager.ts` → `useSound.ts` → `game/page.tsx` |

## Büyük Dosyayla Çalışma Stratejisi

```
1. grep/Read ile değiştirilecek bölümü bul (satır aralığı)
2. Sadece o bölümü oku (offset + limit)
3. Edit ile değiştir
4. npx tsc --noEmit ile doğrula
5. Sonraki dosyaya geç
```

## Agent Kullanım Stratejisi

Bu projede paralel agent pattern'ı çok etkili:

**Ne zaman agent kullan:**
- 3+ bağımsız dosyada değişiklik gerektiğinde
- Büyük dosyalarda (500+ satır) araştırma/grep
- Bağımsız görevler: ses + render + server aynı anda

**Agent bölme kuralı:**
- Her agent'a bağımsız dosya grubu ver (çakışma olmasın)
- `shared/types.ts` değişiyorsa → ÖNCE types'ı değiştir, SONRA agent'ları başlat
- Agent sonrası → `npx tsc --noEmit` ile entegrasyon doğrula

**Örnek paralel görev bölümü:**
```
Agent 1: SoundManager.ts + useSound.ts (ses)
Agent 2: GameRenderer.ts + Camera.ts (render)
Agent 3: server/*.ts (backend)
Agent 4: components/game/*.tsx (UI)
```

## Context Doluluk Sinyalleri

Bunları görürsen `/compact` çalıştır:
- Var olan bir fonksiyonu "oluşturuyorsun"
- Import path'leri karıştırıyorsun
- `shared/types.ts`'deki tipleri yanlış hatırlıyorsun
- Aynı değişikliği tekrar öneriyorsun
