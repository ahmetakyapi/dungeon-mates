---
name: multiplayer-netcode
description: Activate when working on useGameSocket.ts, GameRoom.ts, server/index.ts, Socket.IO events, reconnection logic, or any multiplayer networking code.
---

# Multiplayer Netcode — Socket.IO

## Mimari

**Server authoritative** — client ASLA combat sonucu hesaplamaz.
Client sadece input gonderir, server state hesaplar ve broadcast eder.

```
Client (input) → Server (simulate) → Client (render)
        ↑ 22fps/45ms      20fps/50ms ↓     60fps
```

## Tick Protokolu

| Taraf | Rate | Aciklama |
|---|---|---|
| Server tick | 20 FPS (50ms) | `setInterval` ile GameRoom.update() |
| Client input | ~22 FPS (45ms throttle) | `performance.now()` ile throttle |
| Client render | 60 FPS | `requestAnimationFrame` |
| Movement interpolation | 0.35 lerp | Server tick'leri arasi yumusatma |

## Socket Event Tipleri

**Surekli (continuous):** Her tick gonderilir
- `player:input` — yon + sprint (throttle edilmis)

**Tek seferlik (one-shot):** Kayip onleme icin ayri event
- `player:attack` — buffer'lanir, throttle atlamaz
- `player:use_ability` — buffer'lanir
- `player:interact` — buffer'lanir (sandik, merdiven)

```typescript
// useGameSocket.ts pattern
if (input.attack) pendingAttackRef.current = true;
// Throttle sonrasi:
if (pendingAttackRef.current) {
  socket.emit('player:attack');
  pendingAttackRef.current = false;
}
```

## State Broadcast

Her tick'te FULL state broadcast — delta encoding YOK.

```typescript
// GameRoom.ts → her tick
io.to(roomCode).emit('game:state', fullGameState);
```

`GameState` icerigi: players, monsters, projectiles, loot, dungeon, doors, chests.
Client tarafinda `setGameState(data)` ile state guncellenir.

## Transport Stratejisi

```typescript
// Client (useGameSocket.ts)
io(serverUrl, {
  transports: ['polling', 'websocket'],  // polling ONCE — mobil guvenilirlik
  upgrade: true,
  timeout: 15000,          // 60s'den dusuruldu
  reconnectionAttempts: 10, // Infinity'den dusuruldu
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// Server (index.ts)
new Server(httpServer, {
  transports: ['polling', 'websocket'],
  allowUpgrades: true,
  pingInterval: 10000,   // 25s'den dusuruldu
  pingTimeout: 20000,    // 60s'den dusuruldu
});
```

## Reconnection

1. `connect_error` → hata mesaji goster
2. `reconnect_attempt` → deneme sayisi goster
3. `reconnect_failed` (10 deneme sonrasi) → "Tekrar Dene" butonu
4. `visibilitychange` → sayfa geri geldiginde `socket.connect()` cagir
5. `io server disconnect` → otomatik reconnect

```typescript
// Visibility handler — mobil arka plan/on plan
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && socket && !socket.connected) {
    socket.connect();
  }
});
```

## Yeni Socket Event Ekleme

Sirasi:
1. `shared/types.ts` → `ServerEvents` ve/veya `ClientEvents` interface'ine ekle
2. `server/GameRoom.ts` → event emit et
3. `src/hooks/useGameSocket.ts` → `socket.on()` ile dinle + state guncelle + cleanup
4. `src/app/game/page.tsx` → yeni state'i UI'a bagla

## Zorluk Olcekleme

| Oyuncu Sayisi | Zorluk | Zindan Boyutu | Canavar Sayisi |
|---|---|---|---|
| 1 (Solo) | Kolay | Kucuk | Az |
| 2 | Normal | Orta | Normal |
| 3 | Zor | Buyuk | Cok |
| 4 | Cok Zor | En buyuk | En cok |

`DUNGEON_SIZE_BY_PLAYERS` ve `DIFFICULTY_MULTIPLIER_BY_PLAYERS` sabitleri `GameRoom.ts`'te.

## Socket.IO Kurallari

- `useGameSocket.ts` disinda socket instance OLUSTURMA
- Her `socket.on()` icin `return () => socket.off()` cleanup ZORUNLU
- `connect_error` handler olmadan baglanti kodu yazma
- Client'ta `socket.emit` sadece `useGameSocket` hook icerisinden
