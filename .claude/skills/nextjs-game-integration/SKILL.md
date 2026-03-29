---
name: nextjs-game-integration
description: Activate when working on game page orchestration, hooks (useGameSocket, useGameLoop, useSound), phase transitions, sound integration, canvas lifecycle, environment variables, build configuration, or the connection between Next.js App Router and the game engine.
globs:
  - "src/app/game/**"
  - "src/hooks/**"
  - "src/game/**"
  - "src/app/layout.tsx"
  - "src/app/globals.css"
  - "tailwind.config.ts"
  - "next.config.js"
  - "package.json"
---

# Next.js + Game Engine Entegrasyonu -- Dungeon Mates

Bu skill, Next.js App Router ile oyun motorunun nasil birlestigini tanimlar.
Dungeon Mates'e ozgu mimari, akis ve entegrasyon noktalari.

---

## 1. Sayfa Yapisi: Server vs Client

### Landing Page -- `src/app/page.tsx`

Dikkat: Su an `'use client'` direktifi var cunku useState/useRouter kullaniyor.
Idealde SEO icin server component olmali ama mevcut interaktif tasarim nedeniyle client.

- Oyuncu adi girisi, oda olusturma/katilma, solo mod secimi
- Router ile `game/page.tsx`'e yonlendirme: `/game?name=X&room=new` veya `/game?mode=solo`
- Framer Motion animasyonlari (LandingPage bileseni)
- PixelHero onizleme ve sinif aciklamalari

### Game Page -- `src/app/game/page.tsx` (~925 satir)

Tum oyun orcestrasyon mantiginin yasadigi yer. `'use client'` zorunlu.

**Yapisi:**
```
GamePageWrapper (export default)
  +-- Suspense boundary (useSearchParams icin zorunlu)
        +-- GamePage (asil oyun mantigi)
              |-- useGameSocket() -- baglanti + state
              |-- useGameLoop() -- render dongusu
              |-- useSound() -- ses yoneticisi
              |-- Canvas element (ref ile)
              +-- UI katmanlari (AnimatePresence ile gecisler)
```

---

## 2. Oyun Orkestrasyon Akisi (GamePhase)

Phase tipleri (`shared/types.ts`):
```
'lobby' | 'class_select' | 'playing' | 'boss' | 'victory' | 'defeat' | 'game_over'
```

Tam akis:

```
[Baglanti Kurulur]
  |
  v
WaitingScreen --(connected)--> Lobby (oda kodu, oyuncu listesi, zorluk secimi)
  |
  v
ClassSelect --(sinif sec + hazir)--> class_select -> playing
  |
  v
StoryIntro --(ilk kez playing'e girerken, storyShownRef ile bir kez gosterilir)
  |
  v
TutorialOverlay --(localStorage kontrolu, ilk oyunda gosterilir)
  |
  v
Playing (Canvas + HUD aktif, kat 1-10)
  |
  |---> FloorTransition (her kat gecisinde, floorCompleteEvent veya dungeon.currentFloor degisimi)
  |     +-- playFloorMusic(floor) + startAmbience(floor)
  |
  |---> BossIntro (kat 5: Orumcek Kralice, kat 10: Mor'Khan)
  |     +-- phase === 'boss' && prevPhase === 'playing'
  |
  +---> GameOverScreen (victory veya defeat)
        +-- gameOverStats: kills, damage, gold, floors, time, MVP, party stats
```

### Phase Gecis Mantigi

`game/page.tsx` icindeki `useEffect(() => {...}, [phase])`:
- `class_select -> playing`: StoryIntro goster (bir kez), sonraki seferde Tutorial
- `playing -> boss`: BossIntro goster
- Diger gecisler: LoadingScreen (2sn timer)

---

## 3. State Yonetimi: useGameSocket Tek Kaynak

`src/hooks/useGameSocket.ts` (~390 satir) -- tum baglanti ve oyun state'i burada.

### Dondurulen Degerler

| Deger | Tip | Aciklama |
|---|---|---|
| `connectionState` | `'disconnected' \| 'connecting' \| 'connected'` | Baglanti durumu |
| `gameState` | `GameState \| null` | Server'dan gelen tam oyun durumu (20 tick/sn) |
| `playerId` | `string` | Yerel oyuncunun ID'si |
| `players` | `Record<string, PlayerState>` | Oyuncu listesi |
| `phase` | `GamePhase` | Mevcut oyun fazesi |
| `roomCode` | `string` | 4 karakterli oda kodu |
| `isSolo` | `boolean` | Solo mod mu |
| `soloDeathsRemaining` | `number` | Solo modda kalan can |
| `error` | `string` | Hata mesaji |
| `damageEvents` | `DamageEvent[]` | Hasar/iyilesme/altin olaylari |
| `monsterKillEvents` | array | Canavar oldurme olaylari |
| `roomClearedEvents` | `number[]` | Temizlenen oda ID'leri |
| `floorCompleteEvent` | `number \| null` | Kat tamamlama olayi |
| `chatMessages` | `ChatMessage[]` | Sohbet mesajlari |
| `reconnectAttempt` | `number` | Yeniden baglanti denemesi sayisi |

### Aksiyonlar

| Fonksiyon | Aciklama |
|---|---|
| `createRoom(name)` | Yeni oda olustur |
| `createSoloRoom(name)` | Solo oyun baslat |
| `joinRoom(code, name)` | Mevcut odaya katil |
| `selectClass(class)` | Sinif sec (warrior/mage/archer) |
| `ready()` | Hazir bildir |
| `sendInput(input)` | Oyuncu girdisi gonder (hareket, saldiri) |
| `sendChat(text)` | Sohbet mesaji gonder |
| `retryConnection()` | Baglanti yeniden dene |

### Onemli Kurallar

- **Tek socket instance**: `socketRef` ile useRef icinde tutuluyor. Baska yerde `io()` cagirilmaz.
- **Typed events**: `Socket<ServerEvents, ClientEvents>` -- `shared/types.ts`'den gelir.
- **Visibility handler**: Sekme gizlendiginde pause, gorunur olunca reconnect dener.
- **Reconnect politikasi**: 10 deneme, 15sn timeout, exponential backoff.

---

## 4. Ses Entegrasyon Noktalari

`useSound()` hook'u `SoundManager` singleton'ina erisim saglar.

### Faz Gecislerinde Ses

| Olay | Ses Aksiyonu | Tetikleyen |
|---|---|---|
| Playing basladiktan sonra (story/tutorial bitti) | `playFloorMusic(1)` + `startAmbience(1)` | Manuel tetik (story/tutorial onComplete) |
| Kat gecisi (floor N -> N+1) | `playFloorMusic(N+1)` + `startAmbience(N+1)` | `useEffect` on `gameState.dungeon.currentFloor` degisimi |
| Boss fazesine giris | `playBossMusic()` | Boss intro onComplete |
| Zafer | `playVictory()` | GameOverScreen mount |
| Yenilgi | `playDefeat()` | GameOverScreen mount |
| Unmount / disconnect | `stopMusic()` + `stopAmbience()` | useEffect cleanup |

### Oyun Ici Sesler

| Olay | Metod |
|---|---|
| Saldiri (sinifa gore) | `playSwordSlash()` / `playArrowShoot()` / `playFireball()` |
| Hasar alma | `playPlayerHurt()` / `playMonsterHurt()` |
| Olum | `playDeath()` |
| Loot toplama | `playLootPickup()` / `playGoldPickup()` / `playHealthPotion()` |
| Oda temizleme | `playRoomCleared()` |
| Seviye atlama | `playLevelUp()` |
| Kapi/sandik/merdiven | `playDoorOpen()` / `playChestOpen()` / `playStairsDescend()` |

### AudioContext Baslatma

Web Audio API kullanici etkilesimi gerektirir. `useSound.ts` bunu soyle cozer:
- `useEffect` icinde `click` ve `touchstart` listener'lari eklenir (`{ once: true }`)
- Ilk etkilesimde `SoundManager.getInstance()` cagirilarak AudioContext baslatilir
- `require()` ile lazy load yapilir (SSR-safe)

---

## 5. Canvas Yasam Dongusu: useGameLoop

`src/hooks/useGameLoop.ts` (~296 satir)

### Mount Akisi

1. `canvasRef.current` kontrol edilir
2. Touch cihazi tespiti (`ontouchstart` veya `maxTouchPoints`)
3. **Lazy import** ile modulleri yukle:
   - `GameRenderer` -- ana render pipeline
   - `InputManager` -- klavye + gamepad
   - `TouchControls` -- mobil joystick + butonlar (sadece touch cihazda)
4. Canvas boyutlandirma (`resize` event listener)
5. `requestAnimationFrame` dongusu baslatilir

### Render Dongusu (Her Frame)

```
requestAnimationFrame callback:
  1. deltaTime hesapla
  2. isPausedRef kontrol et (visibility change'de true olur)
  3. InputManager'dan girdi oku -> onInput callback
  4. gameStateRef.current ile renderer.render() cagir
  5. FPS say (her saniye guncelle)
```

### Unmount Temizligi

- `cancelAnimationFrame`
- Renderer destroy
- InputManager destroy
- TouchControls destroy
- Resize listener kaldir
- `game-canvas-active` class'ini kaldir
- Wake lock serbest birak

### Wake Lock (Mobil)

`navigator.wakeLock.request('screen')` ile ekranin kapanmasi engellenir.
Sadece oyun aktifken istenir, unmount'ta serbest birakilir.

### Visibility Change Handling

- `document.hidden === true` -> `isPausedRef.current = true` (render dongusu durur)
- `document.hidden === false` -> `isPausedRef.current = false` (devam eder)
- Socket reconnect ayri olarak `useGameSocket` icinde handle edilir

---

## 6. Environment Variables

### Client Tarafi (NEXT_PUBLIC_ prefix zorunlu)

| Degisken | Varsayilan | Aciklama |
|---|---|---|
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | Socket.IO sunucu URL'i |

`useGameSocket.ts` icinde kullanilir:
```tsx
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
```

### Server Tarafi

| Degisken | Varsayilan | Aciklama |
|---|---|---|
| `PORT` | `3001` | Socket.IO sunucu portu |
| `ALLOWED_ORIGINS` | `http://localhost:3002` | CORS izinli origin'ler (virgul ayrimli) |

---

## 7. Build Komutlari ve Amaclar

```bash
npm run dev           # concurrently: dev:server + dev:client
npm run dev:client    # next dev --turbo -p 3002 (Turbopack, hizli HMR)
npm run dev:server    # tsx watch server/index.ts (hot reload)
npm run build         # next build (production frontend)
npm run build:server  # tsc -p tsconfig.server.json (server JS ciktisi dist/)
npm run start         # next start (production frontend serve)
npm run start:server  # node dist/server/index.js (production server)
npx tsc --noEmit      # Tip kontrolu -- HER degisiklik sonrasi calistir
```

Production deploy akisi:
1. `npm run build` -- Next.js frontend
2. `npm run build:server` -- TypeScript server -> `dist/server/`
3. Frontend: Vercel, Server: ayri Node.js host (veya ayni makinede)

---

## 8. Tailwind Custom Token'lar (dm-* Prefix)

`tailwind.config.ts` icinde tanimli:

```tsx
colors: {
  dm: {
    bg: '#0a0e17',       // Ana arkaplan
    surface: '#111827',   // Kart/panel yuzey
    border: '#1f2937',    // Sinir rengi
    accent: '#8b5cf6',    // Mor vurgu (ana tema rengi)
    gold: '#f59e0b',      // Altin/skor rengi
    health: '#ef4444',    // Can cubugu kirmizi
    mana: '#3b82f6',      // Mana cubugu mavi
    xp: '#10b981',        // XP/deneyim yesil
  },
}
```

Kullanim ornekleri:
- `bg-dm-bg` -- sayfa arkaplan
- `text-dm-accent` -- mor vurgulu metin
- `border-dm-border` -- panel sinir
- `text-dm-gold` -- skor/altin gosterimi

### Font Tanimlari

```tsx
fontFamily: {
  pixel: ['"Press Start 2P"', 'monospace'],  // Retro pixel font
  body: ['Inter', 'sans-serif'],              // Okunakli govde font
}
```

Kullanim: `font-pixel` (basliklar, HUD), `font-body` (aciklamalar, UI metni)

---

## 9. Font Yukleme -- layout.tsx

```tsx
import { Inter, Press_Start_2P } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const pressStart2P = Press_Start_2P({
  weight: '400',
  subsets: ['latin'],
  variable: '--font-pixel',
  display: 'swap',
});
```

CSS variable'lari `<html>` tag'ine eklenir: `className="dark ${inter.variable} ${pressStart2P.variable}"`

`display: 'swap'` ile font yuklenene kadar fallback gosterilir (FOUT > FOIT).

---

## 10. CSS Animasyonlari -- globals.css

### Genel Utility Class'lar

| Class | Aciklama |
|---|---|
| `.pixel-render` | `image-rendering: pixelated` -- pixel art icin |
| `.glass` | Glass morphism efekti (blur 16px + dusuk opaklik border) |
| `.glass-strong` | Daha opak glass varyant |
| `.pixel-border` | 2px solid border + inset glow |
| `.glow-purple` | Mor text-shadow glow |
| `.glow-gold` | Altin text-shadow glow |
| `.glow-purple-pulse` | Pulsing mor glow animasyonu (4s infinite) |

### HUD Animasyonlari

| Animasyon | Class | Kullanim |
|---|---|---|
| `hp-flash` | `.hp-flash` | Can cubugu hasar aldiginda parlama |
| `low-hp-pulse` | `.low-hp-pulse` | Dusuk HP'de titresim (0.8s) |
| `boss-damage-delay` | -- | Boss HP bar'inda gecikmeli hasar gosterimi |
| `kill-feed-in` / `kill-feed-out` | -- | Kill feed giris/cikis animasyonu |
| `heart-break` | `.heart-break` | Solo mod kalp kirilma (can kaybetme) |
| `heart-last-pulse` | `.heart-last-pulse` | Son kalp titresimi |

### Minimap Animasyonlari

| Animasyon | Class | Aciklama |
|---|---|---|
| `minimap-blink` | `.minimap-blink` | Oyuncu noktasi yanip sonme (0.8s) |
| `minimap-enemy-pulse` | `.minimap-enemy-pulse` | Dusman noktasi titresimi (1.2s) |
| `minimap-danger-pulse` | `.minimap-danger-pulse` | Temizlenmemis oda tehlike gostergesi (1.5s) |
| `minimap-boss-glow` | `.minimap-boss-glow` | Boss odasi parlama (1s) |
| `minimap-stairs-beacon` | `.minimap-stairs-beacon` | Merdiven sinyal animasyonu (SVG r degisimi) |
| `minimap-current-border` | `.minimap-current-border` | Mevcut oda sinir titresimi |

### Diger

| Animasyon | Aciklama |
|---|---|
| `boss-pulse` | Boss metni icin kirmizi glow pulse |
| `chat-pulse` | Yeni mesajda sohbet kutusu glow |
| `typewriter` + `blinkCaret` | Landing page typewriter efekti |
| `purplePulse` | Hero basligi icin pulsing mor glow |
| `toast-slide-out` | Toast bildirim cikis animasyonu |

### Mobil Oyun Canvas

`.game-canvas-active` class'i `<html>` ve `<body>`'ye eklenir (sadece touch cihazlarda):
- `touch-action: none` -- browser gestures'i engelle
- `-webkit-touch-callout: none` -- long-press menu'yu engelle
- `overscroll-behavior: none` -- pull-to-refresh engelle

`.safe-area-padding` -- notch'lu telefonlar icin `env(safe-area-inset-*)` padding.

---

## 11. Webpack Alias

`next.config.js` icinde `@shared` alias tanimli:

```js
config.resolve.alias['@shared'] = require('path').resolve(__dirname, 'shared');
```

Pratikte dosyalar `../../shared/types` veya `../../../shared/types` seklinde relative import kullaniyor.
Yeni dosyalarda `@shared/types` kullanilabilir ama tutarlilik icin mevcut pattern'i takip et.

---

## 12. Yeni Bilesen Eklerken Kontrol Listesi

- [ ] Bilesen oyunla ilgiliyse `src/components/game/` altina koy
- [ ] `'use client'` ilk satir mi?
- [ ] State `useGameSocket` donusunden mi turetiliyor? (useState ile kopyalama)
- [ ] Ses gerekiyorsa `useSound()` hook'undan metod cagir, dogrudan SoundManager import etme
- [ ] Canvas/Audio erisimine ihtiyac varsa SSR-safe pattern kullan (dynamic import veya useEffect lazy load)
- [ ] Framer Motion kullaniyorsan `EASE = [0.22, 1, 0.36, 1]` sabitini kullan
- [ ] Tailwind class'lari `dm-*` token'larini kullaniyor mu? Hardcoded renk yok
- [ ] Cleanup: useEffect icindeki listener'lar return'de temizleniyor mu?
- [ ] Phase gecisine bagliysa `game/page.tsx`'deki orkestrasyon akisina uygun mu?
- [ ] Tip guvenligi: `shared/types.ts`'den dogru type'lari import et
