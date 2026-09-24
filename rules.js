// Kural matrisi (cp-16-kural-matrisi): (vuruş türü × ayak × açı) → hangi referans oyuncuya göre
// ölçüldüğümüz, hangi kuralların geçerli olduğu, her kuralın eşiği ve kaynağı. Ya da kombinasyon
// hiç ölçülemiyorsa { olculemez: true, mesaj } — coach.js'in eskiden MIN_COVERAGE ile "dolaylı"
// yakaladığı durumu (yanlış açı → çoğu madde NaN → düşük kapsam) burada AÇIKÇA, kullanıcı bir şey
// ölçmeye çalışmadan önce söylüyoruz (app.js runAnalysis, cp-15-secmeli-menu'nun seçim menüsüyle
// birlikte çalışır: kullanıcı zaten açıyı kendi seçiyor).
//
// Bu dosya saf veri + saf fonksiyon: DOM'a, MediaPipe'a bağlı değil, Node ile test edilir
// (tests/rules.test.mjs). coach.js puanlama motoru RULES/CONTEXT_OVERRIDES/MIN_COVERAGE'ı
// buradan okur — "coach.js puanlamayı bu matristen okusun" kararı (GECE-PLANI). evaluate()'in
// imzası değişmedi (evaluate(m, mode, context)), sadece verinin kaynağı değişti.
//
// Her kural nesnesi: key (metrics.js'teki ölçüm alanı), ref (RESEARCH.md/RESEARCH-VURUS-TURLERI.md
// madde no'su), name, unit, ideal: [alt, üst] aralığı, tol: aralığın dışında puanın 0'a düştüğü
// uzaklık, weight: toplam puandaki ağırlığı, source: eşiğin nereden geldiği (kaynak + güven notu),
// low/high: aralığın altında/üstünde gösterilecek düzeltme cümlesi, drill: tek başına yapılabilecek
// saha alıştırması. info:true olan kurallar (ör. PL4) hiç puanlanmaz, sadece bilgi gösterir.

export const RULES = {
  shot: [
    { key: 'supportOffset', ref: 'Ş1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.45, -0.05], tol: 0.30, weight: 3,
      source: '[K] Petrolo 2024 (Alcock 2012 topuk-top mesafesi), METRICS.md Ş1 — eksen tanımı asıl çalışmada belirsiz, orta güven',
      low: 'Destek ayağın topun çok gerisinde kalmış. Topa uzanıyorsun, şut zayıflar ve top havalanır. Destek ayağını topun hizasına bas.',
      high: 'Destek ayağın topun önüne geçmiş. Top havaya kalkar. Destek ayağını topun hizasına ya da biraz gerisine bas.',
      drill: 'Topun yanına yere bir çizgi çiz (destek ayağının basacağı yer), koşarak gelip her vuruşta tam o çizgiye bas, 10 tekrar.' },
    { key: 'trunk', ref: 'Ş3', name: 'Gövde açısı', unit: '°', ideal: [-18, 3], tol: 15, weight: 3,
      source: '[K] Lees 2010 (yetenekli/profesyonel oyuncular), Petrolo 2024 (elit erkek 5.8±8.3° geriye), METRICS.md Ş3, yüksek güven',
      low: 'Çok geriye yaslanıyorsun, top havalanır. Temas anında göğsünü biraz öne al.',
      high: 'Öne kapanıyorsun. Elit oyuncular temasta dik ya da hafif geride durur.',
      drill: 'Temas anında gövdeni dik tutmayı hedefle: telefonunu yandan sabitleyip 10 şutu izle, omuzların kalçanın gerisine düşmesin.' },
    { key: 'supportKnee', ref: 'Ş2', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 2,
      source: '[K] Lees 2010 (basışta 26°, temasta 42°), Petrolo 2024 (elit erkek temasta 21.4±7.4°), METRICS.md Ş2, yüksek güven',
      low: 'Destek dizin kilitli, düz basıyorsun. Dizini hafif bük, darbeyi emsin ve dengen artsın.',
      high: 'Destek dizin çok bükülmüş, çöküyorsun. Destek bacağını daha sağlam tut.',
      drill: 'Destek ayağını hafif bükük bas, kilitlenmiş dizle değil: yavaş tempoda 10 yaklaşma-basış tekrarı yap, dizindeki hafif yayı hisset.' },
    { key: 'backswing', ref: 'Ş4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 35, weight: 2,
      source: '[K] Petrolo 2024 (maksimum diz büküşü 93.3±5.2°), METRICS.md Ş4, yüksek güven',
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, kamçı etkisi oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama bozulabilir.',
      drill: 'Vuruş öncesi topuğunu kalçana doğru çek: yavaş çekimde 10 kurma-vuruş tekrarı yap, tam kurmayı hisset.' },
    // minFps: 30 fps'de diz iki kare arasında ~39° açılıyor, gerçek veride art arda 128°/54°/7°
    // görüldü. Bu çözünürlükte ölçüm tesadüfe kalıyor, puana ancak 50+ fps'de girer (METRICS.md).
    { key: 'kickKnee', ref: 'Ş5', name: 'Temas anında diz', unit: '°', ideal: [30, 60], tol: 25, weight: 1, minFps: 50,
      source: '[K] Petrolo 2024 (elit erkek 35.3±10.0 – 55.0±7.5°), METRICS.md Ş5 — 30 fps altında bilgi amaçlı, orta güven',
      low: 'Temas geç oluyor: top ayağına gelmeden bacağın tamamen açılmış. Temas anını biraz öne çek.',
      high: 'Temas erken oluyor: dizin daha açılmadan topa değiyorsun. Temas anını biraz geciktir.',
      drill: 'Temas anında bacağının tam açılmasını hedefle: yavaş tempoda vurup topa değdiğin anda dizinin düzleştiğini hisset, 10 tekrar.' },
    { key: 'armOpen', ref: 'Ş7', name: 'Karşı kol', unit: '°', ideal: [35, 110], tol: 30, weight: 1,
      source: '[K] Petrolo 2024 (temasta 48.2±11.7° abdüksiyon), Lees 2010/Shan & Westerhoff 2005, METRICS.md Ş7, orta güven',
      low: 'Karşı kolun gövdene yapışık. Kolunu yana aç, gövde dönüşü ve denge için gerekli.',
      high: 'Karşı kolun çok yukarıda, dengeyi bozabilir.',
      drill: 'Vuruşa girerken karşı kolunu bilinçli yana aç: topsuz da olur, 10 vuruş provası boyunca kolunu yana açık tutmayı alışkanlık yap.' },
    { key: 'followHip', ref: 'Ş8', name: 'Takip (kalça fleksiyonu)', unit: '°', ideal: [65, 125], tol: 30, weight: 2,
      source: '[K] Petrolo 2024 (takip sonunda kalça fleksiyonu 97±16° erkek), METRICS.md Ş8, yüksek güven',
      low: 'Vuruştan sonra uyluğun öne kalkmıyor, bacağını hedefe doğru savur.',
      high: 'Takip çok yüksek, top da havalanıyor olabilir. Vuruşun ardından bacağını gereğinden fazla kaldırma.',
      drill: 'Vurduktan sonra bacağını durdurma: uyluğunu göğsüne doğru kaldırmaya devam ettiği hissi ile 10 tekrar yap.' },
  ],
  pass: [
    { key: 'supportOffset', ref: 'P1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.2, 0.1], tol: 0.3, weight: 3,
      source: '[K] mesafenin isabeti etkilediği bulgusu (RESEARCH.md P1), [T] sayısal eşik — düşük-orta güven',
      low: 'Destek ayağın topun gerisinde. Pası uzanarak atıyorsun, isabet düşer. Ayağını topun yanına bas.',
      high: 'Destek ayağın topun önünde. Pas havalanır. Ayağını topun yanına bas.',
      drill: 'Topun yanına bir işaret koy, her paste destek ayağını o işarete değecek şekilde bas, 10 tekrar.' },
    { key: 'trunk', ref: 'P3', name: 'Gövde açısı', unit: '°', ideal: [-10, 8], tol: 15, weight: 3,
      source: '[K] RESEARCH.md P3 (gövde/vücut eğimi isabetle ilişkili), Ş3 aralığından türetilmiş, orta güven',
      low: 'Geriye yaslanıyorsun, pas yerden gitmez. Gövdeni topun üstünde tut.',
      high: 'Çok öne kapanıyorsun. Gövden dik ya da hafif öne eğik olsun.',
      drill: 'Pas atarken gövdeni topun üstünde tut, geriye yaslanma: 10 pası düz bir çizgiye, gövdeni dik tutarak at.' },
    { key: 'backswing', ref: 'P5', name: 'Salınım', unit: '°', ideal: [40, 100], tol: 35, weight: 2,
      source: '[K] RESEARCH.md P5 ("pas şut değildir, abartılı salınım gerekmez"), [T] sayısal eşik — düşük-orta güven',
      low: 'Salınım çok kısa, pasın gücü yetmeyebilir.',
      high: 'Pası şut gibi atıyorsun. Pas isabet işidir, salınımı kısalt.',
      drill: 'Salınımı kısa ve kontrollü tut: bacağını kısa bir sallanışla vurup topu bir hedefe (çizgi/koni) göndermeyi 10 tekrar dene.' },
    { key: 'followRise', ref: 'P4', name: 'Takip', unit: 'bacak', ideal: [0.05, 0.45], tol: 0.3, weight: 2,
      source: '[K] RESEARCH.md P4 (takip evresinde ayak/uyluk açıları isabetle ilişkili), [T] sayısal eşik — düşük-orta güven',
      low: 'Topa vurup bırakıyorsun. Ayağın kısa bir takiple hedefe doğru devam etsin.',
      high: 'Takip çok yüksek, pas havalanır. Kısa ve alçak takip yap.',
      drill: 'Vurduktan sonra ayağını kısa ve alçak bir takiple hedefe doğru uzat: 10 pas boyunca ayağını yerden çok kaldırma.' },
    { key: 'supportKnee', ref: 'P1', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 1,
      source: 'Ş2 ile aynı kaynak (Lees 2010, Petrolo 2024) — pas için ayrı bir çalışma yok, yüksek güven (genel diz mekaniği)',
      low: 'Destek dizin kilitli. Hafif bük, denge artar.',
      high: 'Destek dizin çok bükülmüş.',
      drill: 'Destek dizini hafif bükük tut, kilitlenmiş bacakla basma: hafif yaylı bir duruşla 10 pas at.' },
  ],
  // Frikik / falsolu vuruş: arkadan kamera, ölçümler measureFreeKick()'ten gelir (RESEARCH.md F1..F5)
  freekick: [
    { key: 'supportLateral', ref: 'F2', name: 'Destek ayağının topa yanal mesafesi', unit: 'bacak', ideal: [0.05, 0.40], tol: 0.25, weight: 3,
      source: '[K] Bessenouci 2019/2020 (destek ayağı-top mesafesi denge/isabeti etkiliyor), [T] sayısal eşik — düşük-orta güven',
      low: 'Destek ayağın topa çok yakın ya da yanlış tarafta duruyor, vuruş bacağının salınım alanı daralıyor. Ayağını topun yanına, biraz dışına bas.',
      high: 'Destek ayağın topun çok uzağında, denge ve isabet kaybediyorsun. Ayağını topa biraz yaklaştır.',
      drill: 'Topun yanına, biraz dışına bir çizgi koy: destek ayağını her frikikte o çizgiye hizala, 10 tekrar.' },
    { key: 'crossing', ref: 'F5', name: 'Takibin çaprazlaması', unit: 'bacak', ideal: [0.3, 1.0], tol: 0.4, weight: 3,
      source: '[L] Asai 2002 (dışmerkezli temas) + koçluk konsensüsü, [T] sayısal eşik — düşük-orta güven',
      low: 'Vuruştan sonra bacağın gövdenin önünden karşı tarafa geçmiyor, sarma takip eksik. Topa vurduktan sonra ayağın karşı omzuna doğru devam etsin.',
      high: 'Takip çok fazla çaprazlıyor, kontrolü kaybedebilirsin. Sarmayı biraz kıs.',
      drill: 'Vurduktan sonra ayak bileğinin karşı bacağını geçmesini bilinçli hedefle: karşı omzuna doğru sarmaya devam ederek 10 tekrar.' },
    { key: 'trunkLateral', ref: 'F3', name: 'Gövdenin yana yatışı', unit: '°', ideal: [5, 22], tol: 15, weight: 2,
      source: '[K] Lees 2010 (profesyonellerde temasta vuruş yapmayan tarafa 10° ve 16°), Messi M0 referans fotoğrafı (~9°), METRICS.md F3, yüksek güven (yön)',
      low: 'Gövden dik ya da yanlış tarafa yatık. Gövdeni destek ayağının tarafına hafifçe yatır, vuruş bacağın serbest kalsın.',
      high: 'Gövden destek tarafına çok yatmış, denge ve temas noktası kayabilir. Yatışı azalt.',
      drill: 'Vuruş anında omuzlarını destek ayağının tarafına hafifçe yatır: 10 frikikte bu hafif yatışı bilinçli tekrarla.' },
    { key: 'backswing', ref: 'F4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 40, weight: 2,
      source: 'Ş4 ile aynı kaynak (Petrolo 2024) — arkadan açıdan büküş küçük gösterebilir, orta güven',
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, dönüş ve spin oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama ve denge bozulabilir.',
      drill: 'Bacağını iyice kur, topuğun kalçana yaklaşsın: yavaş tempoda tam kurma-vuruş provası, 10 tekrar.' },
    { key: 'approachAngle', ref: 'F1', name: 'Yaklaşma açısı', unit: '°', ideal: [20, 50], tol: 30, weight: 2,
      source: '[L] Isokawa & Lees 1988 (Lees 2010 incelemesinde), [T] arkadan-kamera proxy eşiği — orta güven',
      low: 'Kameraya çok dik (düz) koşuyorsun. Topa hafif çapraz bir çizgiyle yaklaş, ayağın topun altına/yanına daha rahat girer.',
      high: 'Yaklaşma çok açılı, denge ve zamanlama bozulabilir. Açıyı biraz kapat.',
      drill: 'Kaleye 20-40° açıyla 5 adımlık bir koşu çizgisi belirle (huni ya da çizgiyle işaretle), her seferinde aynı çizgiden yaklaş, 10 tekrar.' },
  ],
  // Plase (iç taraf, yerleştirme bitiriş): yandan kamera, measure() kullanılır (Ş/P ile aynı yol).
  // RESEARCH-VURUS-TURLERI.md §1: plase "zayıflatılmış bir pas değil, zayıflatılmış bir frikik" —
  // güç değil, dizin açılma hızı ve destek ayağının konumu işi görüyor. PL1 (yaklaşma açısı),
  // PL3 (destek ayağı yönü) ve PL6 (temas yüksekliği) YANDAN kamerada ölçülemiyor (§5: yanal/derinlik
  // ekseninde kalan bilgiler), bu yüzden kasıtlı olarak eklenmedi — RESEARCH bunu açıkça uyarıyor.
  placement: [
    // PL2: destek ayağı ön-arka konumu, pas P1 ile aynı gerekçe/aralık (top yerden ve kontrollü gider).
    { key: 'supportOffset', ref: 'PL2', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.2, 0.1], tol: 0.3, weight: 3,
      source: '[T] RESEARCH-VURUS-TURLERI.md PL2 (Hay 1993, doğrulanmamış) — P1 ile aynı aralık, düşük güven',
      low: 'Destek ayağın topun gerisinde kalmış. Plase kontrollü bir vuruştur, uzanma; ayağını topun yanına bas.',
      high: 'Destek ayağın topun önüne geçmiş. Ayağını topun yanına ya da biraz gerisine bas.',
      drill: 'Topun yanına bir çizgi çiz, destek ayağın her seferinde o çizgiye değecek şekilde 10 plase vuruşu yap.' },
    // Gövde: P3 ile aynı mantık — top yerden ve kontrollü gider, aşırı geriye yaslanma falsoyu bozar.
    { key: 'trunk', ref: 'P3', name: 'Gövde açısı', unit: '°', ideal: [-10, 8], tol: 15, weight: 3,
      source: 'P3 ile aynı kaynak/gerekçe (RESEARCH.md P3), orta güven',
      low: 'Geriye yaslanıyorsun, top havalanır ve kontrolü kaybolur. Gövdeni topun üstünde tut.',
      high: 'Çok öne kapanıyorsun. Gövden dik ya da hafif öne eğik olsun.',
      drill: 'Plase vuruşunda gövdeni pas atar gibi kontrollü ve dik tut, gücü bacağından al: 10 tekrar.' },
    { key: 'supportKnee', ref: 'Ş2', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 2,
      source: 'Ş2 ile aynı kaynak (Lees 2010, Petrolo 2024) — genel diz mekaniği, yüksek güven',
      low: 'Destek dizin kilitli, düz basıyorsun. Dizini hafif bük, denge ve kontrol artsın.',
      high: 'Destek dizin çok bükülmüş, çöküyorsun. Destek bacağını daha sağlam tut.',
      drill: 'Destek ayağını hafif bükük tut, kilitlenmiş dizle değil: hafif yaylı bir duruşla 10 plase vuruşu yap.' },
    // Kurma: RESEARCH PL4 yorumu (plase güç değil kontrol) — Ş4/F4'ten daha dar bir pencere.
    { key: 'backswing', ref: 'Ş4', name: 'Kurma (geri salınım)', unit: '°', ideal: [60, 110], tol: 35, weight: 1,
      source: '[T] RESEARCH-VURUS-TURLERI.md §1 (plase güç değil kontrol işi) — Ş4 penceresinin daraltılmış hali, düşük-orta güven',
      low: 'Bacağını hiç kurmuyorsun, top kontrolsüz gider. Topuğunu biraz kalçana çek.',
      high: 'Kurma çok abartılı: plase güç değil kontrol işidir, tam şut gibi kurmana gerek yok.',
      drill: 'Kurmayı abartma; plasede güç değil kontrol işe yarar. Bacağını tam kalçana kadar değil yarısına kadar çekip hızlıca vur, 10 tekrar.' },
    // Takip (kalça fleksiyonu): Ş8'in daralmış hali — plasede şut kadar yüksek bir takibe gerek yok.
    { key: 'followHip', ref: 'Ş8', name: 'Takip (kalça fleksiyonu)', unit: '°', ideal: [45, 100], tol: 30, weight: 1,
      source: '[T] Ş8 penceresinin daraltılmış hali (plase daha kısa takip gerektirir) — düşük-orta güven',
      low: 'Vuruştan sonra uyluğun öne kalkmıyor, top güçsüz ve kontrolsüz gidebilir. Bacağını hedefe doğru kısa bir takiple uzat.',
      high: 'Takip çok yüksek: bu şut davranışı, plasede daha kısa ve kontrollü bir takip yeterli.',
      drill: 'Vurduktan sonra ayağını durdurma, kısa ve kontrollü bir takiple hedefe doğru devam ettir: 10 tekrar.' },
    // PL4 (bilgi, PUANA GİRMEZ): vuran dizin açısal hızının kalça yatay hızına oranı. Alcock 2012
    // (RESEARCH-VURUS-TURLERI.md, "Frodo için özet" madde 1-2): plase/curl'de temas anındaki AYAK
    // hızı şutla aynı çıkabiliyor, ama dizin AÇISAL hızı daha yüksek (kamçı gibi çözülüyor); şutta
    // ise yaklaşma/kalça DOĞRUSAL hızı yüksek. Bu oranın şutla plaseyi ayıran en net kinematik imza
    // olduğu söyleniyor ama sayısal eşik yok [T] — kalibrasyon bekliyor, minFps kuralına benzer bir
    // mekanizmayla ("info: true") sadece bilgi olarak gösterilir, toplam puanı etkilemez.
    { key: 'kneeAngVelRatio', ref: 'PL4', name: 'Diz açısal hızı / yaklaşma hızı oranı', unit: '×', weight: 0, info: true,
      source: '[K] Alcock 2012 (yön: plasede oran şuttan belirgin yüksek), [T] sayısal eşik — kalibrasyon bekliyor, bilgi amaçlı',
      drill: 'Yaklaşırken yavaşla, gücü bacağını koşturmaktan değil dizini hızlı çözmekten al: yarı hızda yaklaşıp son adımda dizi hızlı boşalt, topu köşeye yerleştirmeyi hedefle.' },
  ],
};

// Hareketli topa vuruş BAĞLAMI (mod değil): oyuncunun kendi sürdüğü ya da bir pastan gelen topa
// vurması, duran topa göre destek ayağı ve kurma davranışını değiştiriyor (RESEARCH-VURUS-TURLERI.md
// §2, H1/H3 — Palucci Vieira 2019 [özet], Egan 2007 [K]). evaluate()'e context.movingBall=true
// geldiğinde ilgili modun ilgili kuralları burada tanımlı genişletilmiş aralıklarla değerlendirilir.
// Sadece shot ve placement etkileniyor: RESEARCH'te pass/freekick için ayrı bir H bulgusu yok.
export const CONTEXT_OVERRIDES = {
  shot: {
    // H1: hareketli topta destek ayağı-top mesafesi daha uzun kabul edilebilir, alt sınır genişledi.
    supportOffset: { ideal: [-0.55, -0.05], tol: 0.35 },
    // H3: tam kurmaya zaman yoktur, genlik küçülür (Egan ve ark. 2007).
    backswing: { ideal: [70, 115] },
  },
  placement: {
    supportOffset: { ideal: [-0.35, 0.1], tol: 0.35 },
    backswing: { ideal: [70, 115] },
  },
};

// cp-14a-olcum-yeterliligi: kapsam eşiği. Puanlanan kuralların ağırlık toplamı, puanlanabilir
// kuralların ağırlık toplamının bu oranının altında kalırsa evaluate() puan üretmez (coach.js).
// Neden: Ronaldo'nun arkadan çekilmiş bir şutunda 7 kuraldan sadece Ş7 ölçülebiliyordu, kalanı
// görünürlük yüzünden "ölçülemedi"ydi; eski kod yine de tek maddenin ortalamasını alıp 100 veriyordu.
export const MIN_COVERAGE = 0.5;

// --- (vuruş türü × açı) → ölçülebilir mi? -----------------------------------------------------
// Kod bunu zaten measure() (ön-arka düzlem: Ş/P/PL kuralları) ile measureFreeKick() (yanal düzlem:
// F kuralları) ayrımıyla ve RESEARCH.md/RESEARCH-VURUS-TURLERI.md'nin kamera notlarıyla
// belirliyordu (şut/pas/plase: tam yandan; frikik: arkadan ya da çapraz arkadan — yandan çekimde
// F2/F3 hiç ölçülemez, derinlik kaybolur). Burada tek bir tabloya açıkça alındı.
const ANGLE_OK = { shot: 'side', pass: 'side', placement: 'side', freekick: 'behind' };

const ANGLE_MESSAGE = {
  shot: 'Ayak üstü şut arkadan ölçülemez, yandan çek.',
  pass: 'Pas arkadan ölçülemez, yandan çek.',
  placement: 'Plase arkadan ölçülemez, yandan çek.',
  freekick: 'Frikik yandan ölçülemez, arkadan ya da çapraz arkadan çek.',
};

// --- (vuruş türü × ayak) → referans oyuncu ----------------------------------------------------
// Ürün kararı (PRODUCT-PLAN, GECE-PLANI): Ayak üstü şut (sağ ve sol) → Ronaldo. Plase sol → Messi,
// Plase sağ → Neymar. Frikik sol → Messi, Frikik sağ → Neymar. Pas: referans oyuncu yok, sadece
// araştırma eşikleri (RESEARCH.md P1-P5).
//
// DÜRÜSTLÜK NOTU: Ronaldo ve Neymar için henüz sabit kameralı idman referans klibi YOK (bkz.
// METRICS.md "Referans taraması" — elimizdeki profesyonel yayın klipleri kalibrasyona uygun değil).
// Bu yüzden eşik SAYILARI RULES'takiyle birebir aynı kalıyor (literatür + Messi'nin gerçek ölçümü,
// METRICS.md) — sahte bir "Ronaldo'nun dizi 47° açılır" gibi uydurma sayı YOK. `note` alanı bunu
// açıkça işaretliyor, gerçek klip geldiğinde sadece o hücre güncellenecek.
const MESSI_SOURCE = 'METRICS.md ölçümlerinden (Messi referans fotoğraf/video, MV1/MV2/M0/M1)';
// Denetim notu: bu metin doğrudan kullanıcıya gösteriliyor (app.js runAnalysis rapor başlığı,
// "Referans: X (...) — <note>"). Eskiden "[T] ... (sahte ölçüm yok)" gibi iç/geliştirici notasyonu
// sızdırıyordu; kullanıcı için sade tutuluyor, ayrıntı yukarıdaki DÜRÜSTLÜK NOTU yorumunda kalıyor.
const PENDING = 'referans ölçümü bekleniyor';

const REFERENCE = {
  shot: {
    right: { name: 'Ronaldo', note: PENDING },
    left: { name: 'Ronaldo', note: PENDING },
  },
  placement: {
    left: { name: 'Messi', note: MESSI_SOURCE },
    right: { name: 'Neymar', note: PENDING },
  },
  freekick: {
    left: { name: 'Messi', note: MESSI_SOURCE },
    right: { name: 'Neymar', note: PENDING },
  },
  pass: {
    right: { name: null, note: null },
    left: { name: null, note: null },
  },
};

/**
 * (vuruş türü × ayak × açı) → kural seti. app.js runAnalysis() ölçüme başlamadan önce bunu
 * çağırır: olculemez:true ise measure()/evaluate() hiç çalıştırılmaz, kullanıcıya doğrudan
 * hangi açıdan çekmesi gerektiği söylenir (coach.js'in MIN_COVERAGE'la dolaylı yakaladığı
 * "yanlış açı" durumunu burada açıkça, ölçmeden önce yakalıyoruz).
 *
 * mode: 'shot' | 'pass' | 'freekick' | 'placement'. foot: 'right' | 'left'. angle: 'side' | 'behind'.
 * Dönen (ölçülemezse): { olculemez: true, mesaj }
 * Dönen (ölçülebilirse): { olculemez: false, mode, foot, angle, referans, referansNotu, kurallar }
 *   kurallar: RULES[mode] (coach.js#evaluate'in kullandığı AYNI dizi — eşik/kaynak burada da okunabilir).
 */
export function getRuleSet(mode, foot, angle) {
  const okAngle = ANGLE_OK[mode];
  if (!okAngle) throw new Error(`Bilinmeyen vuruş türü: ${mode}`);
  if (angle !== 'side' && angle !== 'behind') throw new Error(`Bilinmeyen açı: ${angle}`);
  if (foot !== 'right' && foot !== 'left') throw new Error(`Bilinmeyen ayak: ${foot}`);
  if (angle !== okAngle) return { olculemez: true, mesaj: ANGLE_MESSAGE[mode] };
  const ref = REFERENCE[mode][foot];
  return {
    olculemez: false,
    mode, foot, angle,
    referans: ref.name,
    referansNotu: ref.note,
    kurallar: RULES[mode],
  };
}
