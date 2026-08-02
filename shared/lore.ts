// ==========================================
// Dungeon Mates — Zephara Anlatısı
//
// Hikâye dokuz ayrı dosyaya dağılmıştı: prolog kendi metnini, kat geçişi kendi
// metnini, dükkân kendi diyaloğunu taşıyordu ve hiçbiri diğerini bilmiyordu.
// İki isim çoktan ayrılmıştı bile — anlatı boyunca kral "Karanmir"ken can
// çubuğunda "Kral Mor'Khan" yazıyordu. Tek kaynak burası.
//
// Anlatının şekli
//
// Oyuncuya söylenen şey: aşağıda lanetli bir kral var, onu öldür.
// Aşağıda bulduğu şey: kral başarısız olmadı. Başardı.
//
// Ateş-i Kadim sönüyordu; Karanmir onu kendine bağladı ve hâlâ yanıyor olmasının
// bedeli şehir oldu. Yani zindanın dibindeki şey bir canavar değil, altı yüz
// yıldır sönmeyi reddeden bir adam. Onu öldürmek Ateş'i söndürür — biri yerine
// geçmezse. Oyuncunun indiği şey bir infaz değil, bir devir teslim.
//
// Her katın kendi açığa çıkışı var (`reveal`), böylece inmek yalnızca zorlaşmak
// değil, öğrenmek de oluyor.
// ==========================================

export type ActId = 1 | 2 | 3;

export type Act = {
  id: ActId;
  roman: string;
  name: string;
  /** Perdenin sorusu — oyuncunun o üç-dört katta peşinde olduğu şey. */
  question: string;
  floors: number[];
};

export const ACTS: readonly Act[] = [
  {
    id: 1, roman: 'Perde I', name: 'Yüzey',
    question: 'Bu şehre ne oldu?',
    floors: [1, 2, 3, 4],
  },
  {
    id: 2, roman: 'Perde II', name: 'Derinlikler',
    question: 'Neden hâlâ kimse çıkmadı?',
    floors: [5, 6, 7],
  },
  {
    id: 3, roman: 'Perde III', name: 'Ateşin Kalbi',
    question: 'Kral canavar mı, yoksa kilit mi?',
    floors: [8, 9, 10],
  },
];

export type FloorLore = {
  name: string;
  /** Kata girerken görünen kısa tarif. */
  lore: string;
  /**
   * Kat temizlenince açığa çıkan şey. Sırayla okunduğunda kralın laneti değil,
   * seçimi anlatan bir zincir kuruyor.
   */
  reveal: string;
  icon: string;
};

export const FLOOR_LORE: Readonly<Record<number, FloorLore>> = {
  1: {
    name: 'Yıkık Kapılar',
    lore: 'Zephara\'nın kapıları içeriden sürgülenmiş. Kimse girmesin diye değil — kimse çıkmasın diye.',
    reveal: 'Sürgüler içeriden çekilmiş. Bunu yapan biri, kendini de içeride bıraktığını biliyordu.',
    icon: '🚪',
  },
  2: {
    name: 'Sessiz Sokaklar',
    lore: 'Evler boş, sofralar kurulu. İskeletler hâlâ nöbet yerlerinde duruyor.',
    reveal: 'Nöbetçiler kaçmamış. Altı yüz yıldır aynı köşeleri tutuyorlar — kimse onlara "bitti" demedi.',
    icon: '🏚️',
  },
  3: {
    name: 'Demircinin Ocağı',
    lore: 'Dökümhaneler soğumuş. Çekiç sesleri kesileli çok olmuş, ama ocak hâlâ sıcak.',
    reveal: 'Son döküm bir silah değildi. Bir zincirdi — ve ölçüleri bir insanın bileğine göreydi.',
    icon: '🔨',
  },
  4: {
    name: 'Terkedilmiş Pazar',
    lore: 'Tezgâhlar devrilmiş, altınlar yerde. Kimse eğilip almamış.',
    reveal: 'Altına kimsenin dokunmaması tesadüf değil. Burada para değerini kaybetmeden önce insanlar kaybetti.',
    icon: '⚖️',
  },
  5: {
    name: 'Dokuyucunun Evi',
    lore: 'Selvira\'nın karantina hattı. Ağlar duvar değil, mühür. Bir fısıltı: "Geçmeyin."',
    reveal: 'Selvira düşman değildi. Aşağıyı yukarıdan ayırmakla görevliydi ve görevini hâlâ bırakmadı. Onu geçmek, onu ikna etmek değil — yenmek zorunda kalmaktı.',
    icon: '🕸️',
  },
  6: {
    name: 'Yıkık Kütüphane',
    lore: 'Zephara\'nın bütün bilgisi buradaydı. Şimdi sayfaları yalnızca hayaletler çeviriyor.',
    reveal: 'Bağlama ayini yarım kalmamış. Sonuna kadar okunmuş. Son satırın kenarına biri titrek bir elle not düşmüş: "Bedeli ben ödeyeceğim."',
    icon: '📚',
  },
  7: {
    name: 'Taş Bahçeler',
    lore: 'Bir zamanlar burada çiçek açardı. Şimdi her şey taş — ve heykeller kaçarken donmuş.',
    reveal: 'Heykeller aşağı bakmıyor. Hepsi yukarı, kapıya doğru koşuyordu. Taş kesilmeleri lanet değil, merhametti: yayılmadan durduruldular.',
    icon: '🗿',
  },
  8: {
    name: 'Lav Nehirleri',
    lore: 'Sıcaklık dayanılmaz. Magmanın arasından tek bir yol geçiyor.',
    reveal: 'Bu lav yerin altından gelmiyor. Yukarıdan, taht salonundan akıyor. Ateş-i Kadim hâlâ yanıyor — ve taşıyıcısını da yakıyor.',
    icon: '🌋',
  },
  9: {
    name: 'Ruhlar Tapınağı',
    lore: 'Dualar lanete dönmüş. Rahiplerin ruhları huzur arıyor ve bulamıyor.',
    reveal: 'Rahipler krala dua etmiyordu. Onun yerine geçmeye gönüllü olmuşlardı ve reddedildiler. Karanmir yükü kimseyle paylaşmadı.',
    icon: '⛩️',
  },
  10: {
    name: 'Taht Salonu',
    lore: 'Karanmir burada bekliyor. Altı yüz yıldır, her saniyeyi hatırlayarak.',
    reveal: 'Ateş sende. Karanmir\'in bıraktığı yerden yanıyor. Şimdi soru şu: yukarı çıkarken onu yanında mı taşıyacaksın, yoksa arkanda mı bırakacaksın?',
    icon: '👑',
  },
};

export type BossLore = {
  /** Can çubuğunda ve anlatıda kullanılan tek isim. */
  name: string;
  title: string;
  floor: number;
  /** Dövüş başlarken. */
  intro: string[];
  /** Yenildiğinde. */
  fall: string;
};

export const BOSS_LORE: Readonly<Record<string, BossLore>> = {
  boss_forge_guardian: {
    name: 'Demirci Koruyucu', title: 'Son Dökümün Bekçisi', floor: 3,
    intro: [
      'Ocak bir kez daha kızarıyor.',
      '"Zinciri ben döktüm. Kimsenin kırmasına izin veremem."',
    ],
    fall: 'Çekiç yere düşüyor. Altı yüz yıl sonra, ilk defa sessizlik.',
  },
  boss_spider_queen: {
    name: 'Selvira', title: 'Dokuyucu, Karantinanın Bekçisi', floor: 5,
    intro: [
      'Ağlar geriliyor. Karanlıkta sekiz göz açılıyor.',
      '"Geri dön. Yalvarıyorum. Aşağısı yukarıya bulaşmasın diye buradayım."',
    ],
    fall: '"Kapıyı... kapatın arkanızdan." Ağlar gevşiyor. Hat düştü.',
  },
  boss_stone_warden: {
    name: 'Taş Muhafız', title: 'Bahçenin Merhameti', floor: 7,
    intro: [
      'Bahçe kıpırdıyor. Heykeller değil — muhafız.',
      '"Onları ben taşlaştırdım. Yayılmasınlar diye. Sen de kaçmaya çalışacak mısın?"',
    ],
    fall: 'Taş çatlıyor. Altından çıkan şey bir canavar değil, yorgun bir yüz.',
  },
  boss_flame_knight: {
    name: 'Alev Şövalyesi', title: 'Ateşin Son Muhafızı', floor: 8,
    intro: [
      'Lav yarılıyor. İçinden zırhlı bir siluet yükseliyor.',
      '"Bu ısıyı taşımayı ben bile beceremedim. Sen mi başaracaksın?"',
    ],
    fall: 'Zırh soğuyor. İçi boş. Yıllardır boşmuş.',
  },
  boss_demon: {
    name: 'Karanmir', title: 'Zephara\'nın Son Kralı', floor: 10,
    intro: [
      'Taht salonu ısınıyor. Işık tahttan değil, üzerinde oturandan geliyor.',
      '"Beni öldürmeye geldin. Anlıyorum. Ben de bir zamanlar bunun çözüm olduğunu sanmıştım."',
      '"Ateş sönüyordu. Onu kendime bağladım. Şehir bedeli oldu."',
      '"Şimdi göster bana — sen daha iyi bir taşıyıcı mısın?"',
    ],
    fall: 'Karanmir dizlerinin üstüne çöküyor. Yüzünde acı değil — rahatlama var.\n"Sıra sende. Onu söndürme."',
  },
};

/** Açılış anlatısı. Her satır kendi sahnesi. */
export const PROLOGUE: readonly string[] = [
  'Ateş-i Kadim altı yüz yıl Zephara\'yı ısıttı.',
  'Sonra sönmeye başladı.',
  '"Hesaplarım doğru. İki yüz yıl içinde bu şehir karanlığa gömülecek."',
  'Kral Karanmir onu söndürmeye bırakmadı. Kendine bağladı.',
  'Ateş yanmaya devam etti. Bedelini şehir ödedi.',
  'Zephara uyandığında halkı insan değildi — kralı ise ne diri ne ölü.',
  'Kapılar içeriden sürgülendi.',
  'Altı yüz yıl kimse inmedi. Bugüne kadar.',
];

/**
 * Oyuncunun neden indiği.
 *
 * Bir bahane değil, bir bağ: dört sınıf da mührü atanların soyundan geliyor ve
 * Ateş yalnızca onlara sesleniyor. Aşağıya inmelerinin sebebi cesaret değil,
 * duyabiliyor olmaları.
 */
export const CALLING: readonly string[] = [
  'Sen kapıları mühürleyenlerin soyundansın.',
  'Ateş, üzerinde işareti olanlara seslenir. Altı yüz yıldır sessizdi.',
  'Geçen hafta yeniden başladı.',
];

/** Zafer sonrası kapanış — soruyu açık bırakır. */
export const EPILOGUE: readonly string[] = [
  'Karanmir düştü. Ateş sönmedi.',
  'Şimdi sende yanıyor — sıcak, ağır ve sabırsız.',
  'Yukarı çıkan merdiven altı yüz yıldır ilk kez boş.',
  'Onu ne yapacağın sana kalmış.',
];

/** Tüccar Arin'in perde perde değişen tavrı. */
export const MERCHANT_LINES: Readonly<Record<ActId, string>> = {
  1: 'Yukarıdan gelen ilk müşterim. Altının varsa, Zephara\'nın kalıntılarından bir şeyler bulurum.',
  2: 'Selvira\'yı geçtiniz demek. O hattı ben de aşamamıştım. Aşağısı artık sizin sorununuz.',
  3: 'Bu kadar aşağı inen olmamıştı. Alabildiğinizi alın — geri dönerseniz anlatırsınız.',
};

export function merchantLine(floor: number): string {
  if (floor <= 4) return MERCHANT_LINES[1];
  if (floor <= 7) return MERCHANT_LINES[2];
  return MERCHANT_LINES[3];
}

export function actForFloor(floor: number): Act {
  return ACTS.find((a) => a.floors.includes(floor)) ?? ACTS[0];
}
