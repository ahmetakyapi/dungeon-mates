---
name: nextjs-anti-patterns
description: Activate when writing or reviewing React components, hooks, pages, or any file inside src/ to catch Next.js App Router anti-patterns specific to the Dungeon Mates game project. Also activate when a type-check or build error appears.
globs:
  - "src/**/*.{ts,tsx}"
  - "shared/types.ts"
---

# Next.js Anti-Patterns -- Dungeon Mates

Bu skill, Dungeon Mates projesine ozgu anti-pattern'lari yakalar.
Her madde, projede gercekten olusabilecek bir hatayi hedefler.

---

## 1. useEffect ile Browser Tespiti

YANLIS: useEffect icinde `window` kontrol edip state set etmek.

```tsx
// KOTU
const [isTouch, setIsTouch] = useState(false);
useEffect(() => {
  setIsTouch('ontouchstart' in window);
}, []);
```

Bu projede `useGameLoop.ts` zaten touch tespitini yapar ve `isTouchDevice` doner.
Yeni bir bilesenin bunu tekrar yapmasina gerek yok -- `useGameLoop` donusunu kullan.

Genel kural: Eger browser-only bilgi bir hook'tan zaten geliyorsa, ayri bir useEffect ile tekrar tespit etme.

---

## 2. useEffect ile Veri Fetch

Bu proje REST API kullanmaz -- tum gercek zamanli veri Socket.IO uzerinden gelir.
`useGameSocket` tek kaynak. Asla sunlari yapma:

```tsx
// KOTU -- bu projede fetch yok
useEffect(() => {
  fetch('/api/game-state').then(...)
}, []);
```

Yeni bir veri ihtiyaci varsa `useGameSocket` icerisine event ekle, ayri fetch yapma.

---

## 3. useEffect ile URL Okuma

YANLIS: useEffect icinde `window.location` okumak.

```tsx
// KOTU
useEffect(() => {
  const room = new URLSearchParams(window.location.search).get('room');
}, []);
```

DOGRU: `useSearchParams()` hook'u zaten `game/page.tsx`'de kullaniliyor.
Room ve name parametreleri `searchParams.get('room')` ve `searchParams.get('name')` ile render sirasinda okunur.

---

## 4. useState ile Turetilmis (Derived) Deger

YANLIS: gameState'ten hesaplanabilecek degeri useState ile ayri tutmak.

```tsx
// KOTU -- gameState'ten turetilmeli
const [playerHp, setPlayerHp] = useState(100);
useEffect(() => {
  if (gameState?.players[playerId]) {
    setPlayerHp(gameState.players[playerId].hp);
  }
}, [gameState]);
```

DOGRU: useMemo veya dogrudan hesaplama kullan.

```tsx
// DOGRU
const localPlayer = gameState?.players[playerId];
const playerHp = localPlayer?.hp ?? 0;

// veya useMemo (pahaliysa)
const abilityCooldownPct = useMemo(() => {
  if (!localPlayer || localPlayer.abilityCooldownTicks <= 0) return 0;
  return Math.min(localPlayer.abilityCooldownTicks / maxCd, 1);
}, [localPlayer?.abilityCooldownTicks, localPlayer?.class]);
```

Onemli: `gameState` zaten 20 tick/sn guncellendiginden, turetilmis deger otomatik guncellenir.

---

## 5. Pages Router Kalintilari (App Router'da Yasak)

Bu proje Next.js 14 App Router kullanir. Asla sunlari kullanma:

| Yasak | Neden |
|---|---|
| `getServerSideProps` | App Router'da yok -- server component dogrudan async olabilir |
| `getStaticProps` | App Router'da yok -- `generateStaticParams` veya dogrudan fetch |
| `next/head` | App Router'da yok -- `metadata` export veya `generateMetadata` kullan |
| `next/router` (`useRouter` from `next/router`) | `next/navigation` kullan |
| `_app.tsx`, `_document.tsx` | `layout.tsx` ve `template.tsx` kullan |

Layout.tsx'deki metadata zaten dogru sekilde tanimli:

```tsx
export const metadata: Metadata = { ... };
export const viewport: Viewport = { ... };
```

---

## 6. Server Component'lerde Seri Await

Server component'lerde birden fazla async islem varsa paralel calistir:

```tsx
// KOTU -- seri, yavas
const data1 = await fetchA();
const data2 = await fetchB();

// DOGRU -- paralel
const [data1, data2] = await Promise.all([fetchA(), fetchB()]);
```

Not: Bu projede server component'ler (layout.tsx, page.tsx landing) su an async degil.
Ama ileride SSR veri eklenmesi durumunda bu kurali uygula.

---

## 7. Server Kodunu Client'tan Import Etme (KRITIK)

`server/` dizini ASLA `src/` icinden import edilemez. Bu proje server-authoritative mimariye sahip.

```tsx
// OLUMCUL HATA
import { GameRoom } from '../../../server/GameRoom';
import { Monster } from '../../../server/entities/Monster';
import { DungeonGenerator } from '../../../server/dungeon/DungeonGenerator';
```

**Tek kopru dosyasi:** `shared/types.ts`

- Type'lar, sabitler (TICK_RATE, TILE_SIZE, vb.) ve enum'lar sadece buradan gelir.
- Server logic, entity davranislari ve dungeon uretimi istemci tarafinda YOKTUR.
- `shared/types.ts` disinda `server/` ile `src/` arasinda hicbir import baglantisi olmamali.

Webpack alias `@shared` tanimli ama pratikte `../../shared/types` veya `../../../shared/types` kullaniliyor.

---

## 8. 'use client' Direktifi Yerlestirme Hatalari

`'use client'` dosyanin **mutlak ilk satiri** olmali (comment'lerden bile once).

```tsx
// KOTU -- import'tan sonra
import { useState } from 'react';
'use client'; // GECERSIZ -- cok gec

// KOTU -- yorum'dan sonra
// Bu bir game bileseni
'use client'; // Bazi bundler'larda calismaz

// DOGRU
'use client';

import { useState } from 'react';
```

Bu projede 'use client' gereken her dosya:
- `src/app/game/page.tsx`
- `src/components/game/*.tsx` (18 bilesen)
- `src/hooks/*.ts` (3 hook)
- `src/app/page.tsx` (landing, useState kullandigi icin)

'use client' GEREKTIRMEYEN:
- `src/app/layout.tsx` -- Server Component, font + metadata
- `shared/types.ts` -- Saf type/sabit dosyasi
- `src/game/**/*.ts` -- Sinif dosyalari, React hook degil (dynamic import ile yuklenir)

---

## 9. Framer Motion Server Component'te

Framer Motion (`motion.*`, `AnimatePresence`, `useScroll`, `useTransform`) SADECE client component'lerde calisir.

```tsx
// KOTU -- layout.tsx Server Component'tir
import { motion } from 'framer-motion';
export default function RootLayout() {
  return <motion.div>...</motion.div>; // HATA
}
```

Bu projede animasyonlu tum bilesenler zaten 'use client' -- bu kurali korumaya devam et.
Yeni bir layout veya server component'e Framer Motion ekleme.

---

## 10. Socket.IO Server Component'te

Socket.IO (`io()`, `socket.on`, `socket.emit`) SADECE client tarafinda calisir.

```tsx
// KOTU -- server component'te socket
import { io } from 'socket.io-client';
const socket = io('...'); // Server'da calisirken hata verir
```

Bu projede tek socket instance `useGameSocket.ts` hook'unda olusturulur.
Baska hicbir yerde `io()` cagirma. Socket islemi gerekiyorsa `useGameSocket`'e yeni event ekle.

---

## 11. useSearchParams icin Suspense Siniri Eksik

`useSearchParams()` App Router'da Suspense boundary gerektirir, yoksa build hatasi verir.

```tsx
// KOTU -- Suspense yok
export default function GamePage() {
  const params = useSearchParams(); // Build hatasi
  return <div>{params.get('room')}</div>;
}

// DOGRU -- game/page.tsx'deki mevcut pattern
export default function GamePageWrapper() {
  return (
    <Suspense fallback={<div className="...">Yukleniyor...</div>}>
      <GamePage />
    </Suspense>
  );
}
```

`game/page.tsx` bunu zaten dogru uyguluyor: `GamePageWrapper` (export default) Suspense icinde `GamePage`'i sarar.

---

## 12. Canvas ve Audio Bilesenleri icin Dynamic Import

Canvas renderer ve SoundManager browser API'leri kullanir (Canvas 2D, Web Audio API).
Server-side render sirasinda bu API'ler mevcut degildir.

Bu projede kullanilan pattern:
- `useGameLoop.ts` icinde renderer/input `useEffect` icerisinde lazy import edilir (mount sonrasi)
- `useSound.ts` icinde `SoundManager` lazy `require()` ile yuklenir (ilk interaction'da)

Yeni Canvas veya Audio bileseni ekliyorsan:

```tsx
// DOGRU -- dynamic import ile SSR'dan kac
const GameCanvas = dynamic(() => import('@/components/game/GameCanvas'), {
  ssr: false,
});

// veya useEffect icinde lazy import (mevcut pattern)
useEffect(() => {
  import('@/game/renderer/GameRenderer').then(({ GameRenderer }) => {
    renderer = new GameRenderer(canvas);
  });
}, []);
```

---

## 13. Render Dongusunde Allocation (Performans Anti-Pattern)

Bu oyun projesi icin kritik -- render dongusunde `new`, spread, `map`, `filter` yasak.

```tsx
// KOTU -- her frame'de yeni array olusur
const aliveMonsters = Object.values(gameState.monsters).filter(m => m.alive);

// KOTU -- her render'da yeni obje
const style = { ...baseStyle, color: playerColor };
```

UI bilesenlerinde (HUD, overlay'ler) bu kural esnetilebilir cunku bunlar 60fps render dongusunde degil.
Ama `GameRenderer.ts`, `SpriteRenderer.ts`, `ParticleSystem.ts` icinde kesinlikle uyulmali.

---

## 14. Socket Listener Temizligi Eksik

useEffect icinde socket listener ekleniyorsa cleanup zorunlu:

```tsx
// KOTU -- memory leak
useEffect(() => {
  socket.on('gameState', handler);
}, []);

// DOGRU
useEffect(() => {
  socket.on('gameState', handler);
  return () => {
    socket.off('gameState', handler);
  };
}, []);
```

`useGameSocket.ts` tum listener'lari cleanup eder. Yeni event ekliyorsan ayni pattern'i takip et.

---

## Ozet Kontrol Listesi

Yeni bir dosya yazarken veya mevcut dosyayi duzenlerken:

- [ ] `server/` dizininden `src/` icine import var mi? YASAK
- [ ] `shared/types.ts` disinda server-client kopru var mi? YASAK
- [ ] `'use client'` dosyanin ilk satiri mi?
- [ ] useEffect icinde browser tespiti mi yapiliyor? Hook'tan al
- [ ] gameState'ten turetilmis deger useState'te mi? useMemo veya dogrudan hesapla
- [ ] Pages Router API'si kullanilmis mi? (getServerSideProps, next/head, next/router)
- [ ] Server Component'te Framer Motion veya Socket.IO var mi?
- [ ] useSearchParams Suspense icinde mi?
- [ ] Canvas/Audio bileseni SSR-safe mi? (dynamic import veya useEffect lazy load)
- [ ] Socket listener cleanup var mi?
- [ ] Render dongusunde allocation var mi?
