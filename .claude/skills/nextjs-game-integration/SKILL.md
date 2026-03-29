---
name: nextjs-game-integration
description: Activate when working on game/page.tsx, the game orchestration flow, phase transitions, sound integration, canvas lifecycle, or connecting Next.js App Router with the game engine.
---

# Next.js ↔ Game Engine Integration

## Oyun Orkestrasyon Akisi (game/page.tsx ~925 satir)

```
WaitingScreen (connectionState: connecting/disconnected)
  ↓ connected
Lobby (oda kodu, oyuncu listesi, zorluk gostergesi)
  ↓ createRoom/joinRoom → class_select
ClassSelect (3 sinif secimi + hazir butonu)
  ↓ herkes hazir → playing
StoryIntro (Zephara hikayesi, kat intro)
  ↓ animasyon bitti veya skip
TutorialOverlay (4 slide: kontroller, siniflar, zindan, ipuclari)
  ↓ tamamlandi
PLAYING (Canvas + HUD + ChatBox + VirtualJoystick)
  ↓ kat tamamlandi
FloorTransition (kat lore, istatistikler, sonraki kat bilgisi)
  ↓ devam
PLAYING (sonraki kat)
  ↓ boss kati (5 veya 10)
BossIntro (mid-boss veya final boss sinematik)
  ↓ animasyon bitti
BOSS PHASE (boss HP bar gorunur)
  ↓ boss yenildi
Victory / Defeat (GameOverScreen)
```

## State Yonetimi

`useGameSocket` TEK kaynak — tum state buradan gelir:

```typescript
const {
  connectionState,  // 'connecting' | 'connected' | 'disconnected'
  phase,            // GamePhase (lobby, class_select, playing, boss, victory, defeat)
  gameState,        // Tam oyun state'i (players, monsters, loot, dungeon)
  playerId,         // Bu client'in ID'si
  players,          // Oyuncu listesi
  error,            // Baglanti/oda hatasi
  reconnectAttempt, // Yeniden baglanti deneme sayisi
  retryConnection,  // Manuel yeniden baglanti
  // ... event'ler ve action'lar
} = useGameSocket();
```

## Ses Entegrasyon Noktalari

```typescript
// Phase degisimi
useEffect(() => {
  if (phase === 'playing') {
    sound.playFloorMusic(floor);    // Kata ozel muzik
    sound.startAmbience(floor);     // Kata ozel ortam sesleri
  }
  if (phase === 'boss') {
    sound.stopMusic();
    sound.stopAmbience();
    sound.playBossAppear();
    setTimeout(() => sound.playBossMusic(), 1500);
  }
  if (phase === 'victory') { sound.stopMusic(); sound.stopAmbience(); sound.playVictory(); }
  if (phase === 'defeat') { sound.stopMusic(); sound.stopAmbience(); sound.playDefeat(); }
}, [phase, gameState?.dungeon.currentFloor]);

// Kat gecisi
if (currentFloor > previousFloor) {
  sound.playFloorMusic(currentFloor);
  sound.startAmbience(currentFloor);
}

// Unmount
useEffect(() => {
  return () => { sound.stopMusic(); sound.stopAmbience(); };
}, [sound]);
```

## Canvas Lifecycle

```
useGameLoop hook:
  mount → canvas ref al → GameRenderer olustur → InputManager olustur
       → requestAnimationFrame baslat → wake lock (mobil)

  her frame → gameState'i renderer'a ver → render() → particle update

  unmount → cancelAnimationFrame → renderer.destroy() → input.destroy()
          → wake lock birak
```

- `useEffect` icinde lazy import: `import('@/game/renderer/GameRenderer')`
- Canvas context bir kez alinir, saklanir
- Visibility change: `document.hidden` → pause, geri gelince `lastTimeRef` sifirla

## Floor Gecis Tespiti

```typescript
// game/page.tsx
useEffect(() => {
  const currentFloor = gameState.dungeon.currentFloor;
  if (currentFloor > previousFloorRef.current) {
    setShowFloorTransition(true);
    // Muzik ve ambiyans guncelle
    sound.playFloorMusic(currentFloor);
    sound.startAmbience(currentFloor);
  }
  previousFloorRef.current = currentFloor;
}, [gameState?.dungeon.currentFloor]);
```

## Boss Intro Tetikleme

```typescript
// Phase 'boss' oldugunda
useEffect(() => {
  if (phase === 'boss' && !bossIntroShownRef.current) {
    setShowBossIntro(true);
    bossIntroShownRef.current = true;
  }
}, [phase]);

// BossIntro floor prop alir — kat 5: mid-boss, kat 10: final boss
<BossIntro onComplete={handleBossIntroComplete} floor={gameState?.dungeon.currentFloor} />
```

## Environment Variables

| Degisken | Taraf | Kullanim |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | Client | Socket.IO URL (varsayilan: http://localhost:3001) |
| `PORT` | Server | Socket.IO portu (varsayilan: 3001) |
| `ALLOWED_ORIGINS` | Server | CORS origin listesi |

## Tailwind Custom Token'lar

```
dm-bg, dm-surface, dm-border    — arkaplan katmanlari
dm-accent (#8b5cf6)             — mor vurgu rengi
dm-gold (#f59e0b)               — altin/onemli
dm-health                       — kirmizi (HP)
dm-mana                         — mavi (mana)
pixel-border                    — pixel art border utility
glow-purple, glow-gold          — CSS glow efektleri
```

## CSS Animasyonlari (globals.css)

```
minimap-danger-pulse    — kirmizi nabiz (canavar olan oda)
minimap-boss-glow       — altin parlama (boss odasi)
minimap-stairs-beacon   — mavi isaret (merdiven)
minimap-current-border  — beyaz border animasyonu (mevcut oda)
```
