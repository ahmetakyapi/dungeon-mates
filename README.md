<p align="center">
  <img src="https://img.shields.io/badge/Next.js-14-black?logo=next.js" alt="Next.js" />
  <img src="https://img.shields.io/badge/Socket.IO-4.7-white?logo=socket.io&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/TypeScript-5.4-blue?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Tailwind-3.4-38bdf8?logo=tailwind-css&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/Framer_Motion-11-ff69b4?logo=framer&logoColor=white" alt="Framer Motion" />
</p>

<h1 align="center">Dungeon Mates</h1>

<p align="center">
  <strong>Co-op Zindan Macerası</strong><br/>
  <em>2–4 kişilik gerçek zamanlı multiplayer pixel art dungeon crawler</em>
</p>

<p align="center">
  Arkadaşlarınla birlikte zindanın derinliklerine dal.<br/>
  Prosedürel olarak üretilen karanlık zindanlarda canavarlarla savaş, loot topla, boss'ları yen.
</p>

---

## Oyun Hakkında

**Dungeon Mates**, tarayıcıda çalışan bir co-op zindan oyunudur. Kurulum ve hesap yok: tek başına başlarsın ya da bir oda kurup dört haneli kodu (veya davet bağlantısını) arkadaşlarına gönderirsin. Hedef, Zephara'nın 10 katını inip Taht Salonu'nda Kral Karanmir'e ulaşmak. Zindanlar her oyunda yeniden üretilir; zorluk oyuncu sayısına göre ölçeklenir. Hikâyenin tamamı `STORY.md` dosyasında.

### Nasıl Oynanır

1. **Tek Oyna** — Solo sefer, 3 can hakkı. Sınıfını seçip hazır olduğunda başlar.
2. **Oda Kur** — 4 haneli oda kodu alırsın; kodu ya da davet bağlantısını paylaş.
3. **Odaya Katıl** — Kodu gir ya da davet bağlantısını aç, ismini yaz.
4. **Oyunu Başlat** — Odada en az iki kişi olunca herkes sınıf seçimine geçer; geç kalan arkadaş sınıf seçimi sırasında da katılabilir.
5. **Zindana İn** — Her katı temizle, merdiveni bul; 3, 5, 7, 8 ve 10. katlarda boss var.

### Kontroller

| Eylem | Masaüstü | Dokunmatik |
|-------|----------|------------|
| Hareket | WASD / Ok Tuşları | Ekranın solunda sürükle |
| Nişan | Fare | Saldırı tuşunu sürükle |
| Saldırı | Sol Tık / Space | ⚔️ tuşu (basılı tutunca seri saldırı) |
| Takla | Q | Takla tuşu |
| Yetenek | E | ✨ tuşu |
| Ultimate (5. seviyeden) | F | ★ tuşu |
| Etkileşim (sandık, merdiven) | R | 🔑 tuşu (yakındayken belirir) |
| Koşu | Shift | — |
| Karakter Özeti | Tab | — |
| Duraklat | Esc | ⚙️ tuşu |

---

## Kahraman Sınıfları

Değerlerin tek kaynağı `shared/classes.ts`.

| Sınıf | Rol | Can | Saldırı | Savunma | Hız | Yetenek (E) |
|-------|-----|----:|--------:|--------:|----:|-------------|
| **Savaşçı** | Ön Saf | 120 | 18 | 10 | 2,2 | Kalkan Duvarı — 4 sn boyunca hasarı %70 azaltır |
| **Büyücü** | Alan Hasarı | 70 | 20 | 3 | 2,0 | Buz Fırtınası — çevreye hasar ve yavaşlatma |
| **Okçu** | Menzil | 90 | 12 | 5 | 2,8 | Ok Yağmuru — yelpaze şeklinde 5 ok |
| **Şifacı** | Destek | 85 | 10 | 6 | 2,2 | Şifa Dalgası — yakındaki takımı iyileştirir |

---

## Katlar ve Canavarlar

- **10 kat, 3 perde**: Yüzey (1–4), Derinlikler (5–7), Ateşin Kalbi (8–10). Kat adları ve hikâye `shared/lore.ts` içinde.
- **12 canavar türü**: sıçan, balçık, yarasa, iskelet, örümcek, goblin, zehirli mantar, hayalet, gargoyle, kara şövalye, fantom, lav balçığı. Elit canavarlar ek bir özellik (affix) taşır.
- **5 boss**: Demirci Koruyucu (kat 3), Selvira — Örümcek Kraliçe (5), Taş Muhafız (7), Alev Şövalyesi (8), Karanmir (10, final).
- Düşman saldırıları üç aşamalıdır — hazırlık, vuruş, toparlanma. Vurulacak alan hazırlık sırasında zeminde görünür; alandan zamanında çıkan hasar almaz.

### Oyuncu Sayısına Göre Ölçek

| | Solo | 2 Kişi | 3 Kişi | 4 Kişi |
|---|:---:|:---:|:---:|:---:|
| Harita Boyutu | 48×48 | 56×56 | 64×64 | 72×72 |
| Canavar Çarpanı | 0,85× | 1,5× | 1,9× | 2,4× |

Kaynak: `server/dungeon/DungeonGenerator.ts`.

---

## Teknik Mimari

```
Tarayıcı (Next.js)          WebSocket           Sunucu (Node.js)
┌──────────────────┐       (Socket.IO)       ┌──────────────────┐
│  React UI        │ ◄──────────────────────►│  GameRoom        │
│  Canvas Renderer │    gerçek zamanlı       │  Monster AI      │
│  Input Manager   │    20 tick/sn           │  Collision       │
│  Sound Engine    │                         │  Dungeon Gen     │
│  Particle System │                         │  Loot System     │
└──────────────────┘                         └──────────────────┘
         │                                           │
     shared/types.ts  ◄── Ortak tip tanımları ──►  shared/types.ts
```

### Sunucu Otoritesi

Tüm oyun mantığı sunucu tarafında çalışır. Client sadece input gönderir ve state render eder — **hile önleme** için server-authoritative mimari.

- **Tick Rate**: 20 FPS (50ms aralık)
- **Input Throttle**: Client ~22fps (45ms) ile input gönderir
- **One-shot Actions**: Saldırı / yetenek / etkileşim ayrı socket event olarak gönderilir (kayıp önleme)
- **State Broadcast**: Her tick'te tam oyun durumu tüm client'lara yayınlanır

### Render Pipeline

Oyun HTML5 Canvas üzerinde pixel-art tarzında render edilir:

1. **Mantıksal Çözünürlük** — 480×270 (masaüstü), 280×210 (mobil)
2. **Offscreen Buffer** — Piksel artifact'larını önlemek için
3. **Render Katmanları** — Zemin → Çevre Dekor → Loot → Canavarlar → Mermiler → Oyuncular → Parçacıklar → Sis → UI
4. **Dinamik Aydınlatma** — Entity bazlı ışık (meşale, oyuncu, canavar, loot)
5. **Fog of War** — 3 durumlu (gizli / keşif / görünür)
6. **Kalite Otomatiği** — FPS izleme ile otomatik kalite ayarlama (Low / Medium / High)

### Prosedürel Sprite Sistemi

Oyundaki tüm sprite'lar **prosedürel olarak çizilir** — sprite sheet kullanılmaz. Her karakter, canavar, tile ve efekt piksel piksel Canvas API ile oluşturulur:

- **~2.600 satır** sprite render kodu
- Her canavar için benzersiz animasyon (yürüme, saldırı, ölüm, özel efektler)
- Frame bazlı animasyon sistemi (8 FPS anim tick)
- Offscreen sprite cache ile performans optimizasyonu
- Hasar flash, nefes alma, pelerin dalgalanma gibi detaylar

### Parçacık Sistemi

Pool bazlı parçacık motoru (768 öncelik önbellekli parçacık):

- **30+ efekt** — Hit spark, kan, büyü patlaması, ateş izi, zehir bulutu, ağ atışı, hayalet faz, boss slam...
- **Öncelik sistemi** — Ambient parçacıklar (düşük) combat'tan önce geri dönüştürülür
- **Fizik** — Yerçekimi, sürtünme, açı bazlı hız

### Zindan Üretimi

**BSP (Binary Space Partition)** algoritması ile prosedürel zindan üretimi:

- Dengeli oda dağılımından rastgele şekilli, birbirine bağlı odalar üretir
- Oda boyutları: 7×7 – 13×13 tile arası
- Koridorlarla bağlantı, kapı yerleştirme
- Boss odası, başlangıç odası, sandık ve merdiven yerleştirme
- Harita boyutu oyuncu sayısına göre dinamik

### Ses Motoru

Web Audio API tabanlı retro ses sentezleyici:

- Prosedürel ses efektleri (dalga formu sentezi)
- Sınıf bazlı saldırı sesleri (kılıç, ateş topu, ok)
- Cooldown / debounce sistemi (ses üstüste binmez)

---

## Proje Yapısı

```
dungeon-mates/
├── shared/
│   └── types.ts                 # Ortak tip tanımları, sabitler, istatistikler
├── server/
│   ├── index.ts                 # Socket.IO sunucu giriş noktası
│   ├── GameRoom.ts              # Oda yönetimi, oyun döngüsü, combat
│   ├── entities/
│   │   ├── Player.ts            # Oyuncu entity, sınıf yetenekleri
│   │   ├── Monster.ts           # Canavar durumu ve saldırı döngüsü
│   │   └── Projectile.ts        # Mermi fiziği, çarpışma
│   └── dungeon/
│       └── DungeonGenerator.ts  # BSP zindan üretici
└── src/
    ├── app/
    │   ├── page.tsx             # Landing page
    │   ├── game/page.tsx        # Ana oyun sayfası (tüm fazlar)
    │   ├── layout.tsx           # Root layout, fontlar, metadata
    │   └── globals.css          # Global stiller, animasyonlar
    ├── components/
    │   ├── game/
    │   │   ├── HUD.tsx              # HP, mana, minimap, combo sayacı
    │   │   ├── ClassSelect.tsx      # Sınıf seçim ekranı
    │   │   ├── TutorialOverlay.tsx  # Oyun içi tutorial
    │   │   ├── GameOverScreen.tsx   # Bitiş istatistikleri
    │   │   ├── ChatBox.tsx          # Oyun içi sohbet
    │   │   ├── WaitingScreen.tsx    # Sunucu bekleme ekranı
        │   │   └── ...                  # +11 diğer bileşen
    │   └── ui/
    │       ├── PixelButton.tsx      # Pixel-art buton
    │       └── PixelInput.tsx       # Pixel-art input
    ├── hooks/
    │   ├── useGameSocket.ts     # WebSocket bağlantı & event yönetimi
    │   ├── useGameLoop.ts       # Oyun döngüsü (requestAnimationFrame)
    │   └── useSound.ts          # Ses efekt yönetimi
    └── game/
        ├── renderer/
        │   ├── GameRenderer.ts      # Ana canvas render (~2.100 satır)
        │   ├── SpriteRenderer.ts    # Prosedürel sprite çizim (~2.600 satır)
        │   └── ParticleSystem.ts    # Parçacık motoru (~1.100 satır)
        ├── audio/
        │   └── SoundManager.ts      # Web Audio sentezleyici
        └── input/
            ├── InputManager.ts      # Klavye + gamepad girdi yönetimi
            └── TouchControls.ts     # Mobil joystick ve aksiyon tuşları
```


---

## Kurulum

### Gereksinimler

- Node.js 18+
- npm 9+

### Yerel Geliştirme

```bash
# Repo'yu klonla
git clone https://github.com/ahmetakyapi/dungeon-mates.git
cd dungeon-mates

# Bağımlılıkları kur
npm install

# Geliştirme sunucusunu başlat (client + server aynı anda)
npm run dev
```

Tarayıcıda aç: **http://localhost:3002**

Sunucu otomatik olarak `localhost:3001` üzerinde çalışır.

### Kontrol Betikleri

```bash
npx tsc --noEmit        # tip kontrolü
npm run check:lobby     # çok oyunculu lobi: başlatma, geç katılım, hazır olma
npm run check:combat    # ayrıca: decals, hazards, revive, shop, modifiers, audio, boss
npm run check:smoke     # çalışan sunucuya karşı gerçek bir solo oyun (DM_SERVER ile port)
```

### Environment Variables

```env
NEXT_PUBLIC_WS_URL=http://localhost:3001   # WebSocket sunucu URL'i
PORT=3001                                   # Sunucu portu
ALLOWED_ORIGINS=*                           # CORS izinleri (production'da domain belirt)
```

---

## Deploy

### Frontend — Vercel

```bash
npm run build
```

Vercel'de environment variable olarak `NEXT_PUBLIC_WS_URL` değerini backend sunucu adresine ayarla.

### Backend — Render / Railway / VPS

```bash
npm run build:server
npm run start:server
```

> **Render Free Tier**: Sunucu uykuya geçebilir (~30–50sn). Oyun, sunucu uyanana kadar animasyonlu bekleme ekranı gösterir (ipuçları, ilerleme çubuğu, zindan animasyonu).

Environment variable olarak `ALLOWED_ORIGINS` değerini frontend domain'ine ayarla.

---

## Tech Stack

| Katman | Teknoloji | Amaç |
|--------|-----------|------|
| Framework | Next.js 14 (App Router) | SSR, routing, build |
| Gerçek Zaman | Socket.IO 4.7 | WebSocket multiplayer |
| Render | HTML5 Canvas | Pixel-art oyun render |
| UI | React 18 + Framer Motion | Animasyonlu arayüz |
| Stil | Tailwind CSS 3.4 | Responsive tasarım |
| Ses | Web Audio API | Prosedürel ses sentezi |
| Dil | TypeScript 5.4 (strict) | End-to-end tip güvenliği |
| ID | nanoid | Benzersiz entity kimlikleri |

---

## Özellikler

- **Gerçek Zamanlı Co-op** — 2–4 oyuncu, oda kodu ile anında bağlantı
- **Davet Bağlantısı** — Bağlantıyı açan arkadaş ismini yazıp doğrudan odaya katılır
- **Solo Mod** — Tek başına 3 canla oyna
- **Prosedürel Zindanlar** — Her oyun benzersiz harita
- **12 Canavar + 5 Boss** — Farklı AI, sprite ve zorluk
- **4 Kahraman Sınıfı** — Benzersiz yetenekler ve oyun tarzları
- **Dinamik Zorluk** — Oyuncu sayısına göre otomatik ölçekleme
- **Pixel Art Görseller** — 2.500+ satır prosedürel sprite kodu
- **Dinamik Aydınlatma** — Entity bazlı ışık ve gölge sistemi
- **Parçacık Efektleri** — 30+ efekt, 768 parçacık havuzu
- **Mobil Destek** — Dokunmatik kontroller, responsive UI
- **Gamepad Desteği** — Xbox / PlayStation controller uyumluluğu
- **Oyun İçi Sohbet** — Gerçek zamanlı takım iletişimi
- **Fog of War** — Keşif bazlı görünüm sistemi
- **Loot Sistemi** — 5 farklı drop, sınıf bazlı denge
- **Seviye Atlama** — XP sistemi, stat büyümesi
- **Boss Savaşı** — Özel mekanikler, sahne efektleri
- **Sunucu Otoritesi** — Hile önleme mimari
- **4K Destek** — 3xl / 4xl breakpoint'ları ile ultra geniş ekran uyumu

---

<p align="center">
  <sub>Ahmet Akyapı tarafından geliştirilmiştir.</sub>
</p>
