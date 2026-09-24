// Hoca katmanı: ölçümleri kurallarla puana ve düzeltme önerisine çevirir.
// Her kuralın dayanağı RESEARCH.md'de (Ş1..Ş8, P1..P5) ya da plase/hareketli top için
// RESEARCH-VURUS-TURLERI.md'de (PL1..PL6, H1..H5).
// ideal: [alt, üst] aralığı, tol: aralığın dışında puanın 0'a düştüğü uzaklık.
// drill: tek başına, ekipmansız (ya da huni/çizgiyle) yapılabilecek 1 cümlelik saha alıştırması —
// "yarın sahada neyi farklı yaparsan bu sayı düzelir" sorusuna somut bir cevap (GECE-PLANI.md).

const RULES = {
  shot: [
    { key: 'supportOffset', ref: 'Ş1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.45, -0.05], tol: 0.30, weight: 3,
      low: 'Destek ayağın topun çok gerisinde kalmış. Topa uzanıyorsun, şut zayıflar ve top havalanır. Destek ayağını topun hizasına bas.',
      high: 'Destek ayağın topun önüne geçmiş. Top havaya kalkar. Destek ayağını topun hizasına ya da biraz gerisine bas.',
      drill: 'Topun yanına yere bir çizgi çiz (destek ayağının basacağı yer), koşarak gelip her vuruşta tam o çizgiye bas, 10 tekrar.' },
    { key: 'trunk', ref: 'Ş3', name: 'Gövde açısı', unit: '°', ideal: [-18, 3], tol: 15, weight: 3,
      low: 'Çok geriye yaslanıyorsun, top havalanır. Temas anında göğsünü biraz öne al.',
      high: 'Öne kapanıyorsun. Elit oyuncular temasta dik ya da hafif geride durur.',
      drill: 'Temas anında gövdeni dik tutmayı hedefle: telefonunu yandan sabitleyip 10 şutu izle, omuzların kalçanın gerisine düşmesin.' },
    { key: 'supportKnee', ref: 'Ş2', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 2,
      low: 'Destek dizin kilitli, düz basıyorsun. Dizini hafif bük, darbeyi emsin ve dengen artsın.',
      high: 'Destek dizin çok bükülmüş, çöküyorsun. Destek bacağını daha sağlam tut.',
      drill: 'Destek ayağını hafif bükük bas, kilitlenmiş dizle değil: yavaş tempoda 10 yaklaşma-basış tekrarı yap, dizindeki hafif yayı hisset.' },
    { key: 'backswing', ref: 'Ş4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 35, weight: 2,
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, kamçı etkisi oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama bozulabilir.',
      drill: 'Vuruş öncesi topuğunu kalçana doğru çek: yavaş çekimde 10 kurma-vuruş tekrarı yap, tam kurmayı hisset.' },
    // minFps: 30 fps'de diz iki kare arasında ~39° açılıyor, gerçek veride art arda 128°/54°/7°
    // görüldü. Bu çözünürlükte ölçüm tesadüfe kalıyor, puana ancak 50+ fps'de girer (METRICS.md).
    { key: 'kickKnee', ref: 'Ş5', name: 'Temas anında diz', unit: '°', ideal: [30, 60], tol: 25, weight: 1, minFps: 50,
      low: 'Temas geç oluyor: top ayağına gelmeden bacağın tamamen açılmış. Temas anını biraz öne çek.',
      high: 'Temas erken oluyor: dizin daha açılmadan topa değiyorsun. Temas anını biraz geciktir.',
      drill: 'Temas anında bacağının tam açılmasını hedefle: yavaş tempoda vurup topa değdiğin anda dizinin düzleştiğini hisset, 10 tekrar.' },
    { key: 'armOpen', ref: 'Ş7', name: 'Karşı kol', unit: '°', ideal: [35, 110], tol: 30, weight: 1,
      low: 'Karşı kolun gövdene yapışık. Kolunu yana aç, gövde dönüşü ve denge için gerekli.',
      high: 'Karşı kolun çok yukarıda, dengeyi bozabilir.',
      drill: 'Vuruşa girerken karşı kolunu bilinçli yana aç: topsuz da olur, 10 vuruş provası boyunca kolunu yana açık tutmayı alışkanlık yap.' },
    { key: 'followHip', ref: 'Ş8', name: 'Takip (kalça fleksiyonu)', unit: '°', ideal: [65, 125], tol: 30, weight: 2,
      low: 'Vuruştan sonra uyluğun öne kalkmıyor, bacağını hedefe doğru savur.',
      high: 'Takip çok yüksek, top da havalanıyor olabilir. Vuruşun ardından bacağını gereğinden fazla kaldırma.',
      drill: 'Vurduktan sonra bacağını durdurma: uyluğunu göğsüne doğru kaldırmaya devam ettiği hissi ile 10 tekrar yap.' },
  ],
  pass: [
    { key: 'supportOffset', ref: 'P1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.2, 0.1], tol: 0.3, weight: 3,
      low: 'Destek ayağın topun gerisinde. Pası uzanarak atıyorsun, isabet düşer. Ayağını topun yanına bas.',
      high: 'Destek ayağın topun önünde. Pas havalanır. Ayağını topun yanına bas.',
      drill: 'Topun yanına bir işaret koy, her paste destek ayağını o işarete değecek şekilde bas, 10 tekrar.' },
    { key: 'trunk', ref: 'P3', name: 'Gövde açısı', unit: '°', ideal: [-10, 8], tol: 15, weight: 3,
      low: 'Geriye yaslanıyorsun, pas yerden gitmez. Gövdeni topun üstünde tut.',
      high: 'Çok öne kapanıyorsun. Gövden dik ya da hafif öne eğik olsun.',
      drill: 'Pas atarken gövdeni topun üstünde tut, geriye yaslanma: 10 pası düz bir çizgiye, gövdeni dik tutarak at.' },
    { key: 'backswing', ref: 'P5', name: 'Salınım', unit: '°', ideal: [40, 100], tol: 35, weight: 2,
      low: 'Salınım çok kısa, pasın gücü yetmeyebilir.',
      high: 'Pası şut gibi atıyorsun. Pas isabet işidir, salınımı kısalt.',
      drill: 'Salınımı kısa ve kontrollü tut: bacağını kısa bir sallanışla vurup topu bir hedefe (çizgi/koni) göndermeyi 10 tekrar dene.' },
    { key: 'followRise', ref: 'P4', name: 'Takip', unit: 'bacak', ideal: [0.05, 0.45], tol: 0.3, weight: 2,
      low: 'Topa vurup bırakıyorsun. Ayağın kısa bir takiple hedefe doğru devam etsin.',
      high: 'Takip çok yüksek, pas havalanır. Kısa ve alçak takip yap.',
      drill: 'Vurduktan sonra ayağını kısa ve alçak bir takiple hedefe doğru uzat: 10 pas boyunca ayağını yerden çok kaldırma.' },
    { key: 'supportKnee', ref: 'P1', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 1,
      low: 'Destek dizin kilitli. Hafif bük, denge artar.',
      high: 'Destek dizin çok bükülmüş.',
      drill: 'Destek dizini hafif bükük tut, kilitlenmiş bacakla basma: hafif yaylı bir duruşla 10 pas at.' },
  ],
  // Frikik / falsolu vuruş: arkadan kamera, ölçümler measureFreeKick()'ten gelir (RESEARCH.md F1..F5)
  freekick: [
    { key: 'supportLateral', ref: 'F2', name: 'Destek ayağının topa yanal mesafesi', unit: 'bacak', ideal: [0.05, 0.40], tol: 0.25, weight: 3,
      low: 'Destek ayağın topa çok yakın ya da yanlış tarafta duruyor, vuruş bacağının salınım alanı daralıyor. Ayağını topun yanına, biraz dışına bas.',
      high: 'Destek ayağın topun çok uzağında, denge ve isabet kaybediyorsun. Ayağını topa biraz yaklaştır.',
      drill: 'Topun yanına, biraz dışına bir çizgi koy: destek ayağını her frikikte o çizgiye hizala, 10 tekrar.' },
    { key: 'crossing', ref: 'F5', name: 'Takibin çaprazlaması', unit: 'bacak', ideal: [0.3, 1.0], tol: 0.4, weight: 3,
      low: 'Vuruştan sonra bacağın gövdenin önünden karşı tarafa geçmiyor, sarma takip eksik. Topa vurduktan sonra ayağın karşı omzuna doğru devam etsin.',
      high: 'Takip çok fazla çaprazlıyor, kontrolü kaybedebilirsin. Sarmayı biraz kıs.',
      drill: 'Vurduktan sonra ayak bileğinin karşı bacağını geçmesini bilinçli hedefle: karşı omzuna doğru sarmaya devam ederek 10 tekrar.' },
    { key: 'trunkLateral', ref: 'F3', name: 'Gövdenin yana yatışı', unit: '°', ideal: [5, 22], tol: 15, weight: 2,
      low: 'Gövden dik ya da yanlış tarafa yatık. Gövdeni destek ayağının tarafına hafifçe yatır, vuruş bacağın serbest kalsın.',
      high: 'Gövden destek tarafına çok yatmış, denge ve temas noktası kayabilir. Yatışı azalt.',
      drill: 'Vuruş anında omuzlarını destek ayağının tarafına hafifçe yatır: 10 frikikte bu hafif yatışı bilinçli tekrarla.' },
    { key: 'backswing', ref: 'F4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 40, weight: 2,
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, dönüş ve spin oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama ve denge bozulabilir.',
      drill: 'Bacağını iyice kur, topuğun kalçana yaklaşsın: yavaş tempoda tam kurma-vuruş provası, 10 tekrar.' },
    { key: 'approachAngle', ref: 'F1', name: 'Yaklaşma açısı', unit: '°', ideal: [20, 50], tol: 30, weight: 2,
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
      low: 'Destek ayağın topun gerisinde kalmış. Plase kontrollü bir vuruştur, uzanma; ayağını topun yanına bas.',
      high: 'Destek ayağın topun önüne geçmiş. Ayağını topun yanına ya da biraz gerisine bas.',
      drill: 'Topun yanına bir çizgi çiz, destek ayağın her seferinde o çizgiye değecek şekilde 10 plase vuruşu yap.' },
    // Gövde: P3 ile aynı mantık — top yerden ve kontrollü gider, aşırı geriye yaslanma falsoyu bozar.
    { key: 'trunk', ref: 'P3', name: 'Gövde açısı', unit: '°', ideal: [-10, 8], tol: 15, weight: 3,
      low: 'Geriye yaslanıyorsun, top havalanır ve kontrolü kaybolur. Gövdeni topun üstünde tut.',
      high: 'Çok öne kapanıyorsun. Gövden dik ya da hafif öne eğik olsun.',
      drill: 'Plase vuruşunda gövdeni pas atar gibi kontrollü ve dik tut, gücü bacağından al: 10 tekrar.' },
    { key: 'supportKnee', ref: 'Ş2', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 2,
      low: 'Destek dizin kilitli, düz basıyorsun. Dizini hafif bük, denge ve kontrol artsın.',
      high: 'Destek dizin çok bükülmüş, çöküyorsun. Destek bacağını daha sağlam tut.',
      drill: 'Destek ayağını hafif bükük tut, kilitlenmiş dizle değil: hafif yaylı bir duruşla 10 plase vuruşu yap.' },
    // Kurma: RESEARCH PL4 yorumu (plase güç değil kontrol) — Ş4/F4'ten daha dar bir pencere.
    { key: 'backswing', ref: 'Ş4', name: 'Kurma (geri salınım)', unit: '°', ideal: [60, 110], tol: 35, weight: 1,
      low: 'Bacağını hiç kurmuyorsun, top kontrolsüz gider. Topuğunu biraz kalçana çek.',
      high: 'Kurma çok abartılı: plase güç değil kontrol işidir, tam şut gibi kurmana gerek yok.',
      drill: 'Kurmayı abartma; plasede güç değil kontrol işe yarar. Bacağını tam kalçana kadar değil yarısına kadar çekip hızlıca vur, 10 tekrar.' },
    // Takip (kalça fleksiyonu): Ş8'in daralmış hali — plasede şut kadar yüksek bir takibe gerek yok.
    { key: 'followHip', ref: 'Ş8', name: 'Takip (kalça fleksiyonu)', unit: '°', ideal: [45, 100], tol: 30, weight: 1,
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
      drill: 'Yaklaşırken yavaşla, gücü bacağını koşturmaktan değil dizini hızlı çözmekten al: yarı hızda yaklaşıp son adımda dizi hızlı boşalt, topu köşeye yerleştirmeyi hedefle.' },
  ],
};

// Hareketli topa vuruş BAĞLAMI (mod değil): oyuncunun kendi sürdüğü ya da bir pastan gelen topa
// vurması, duran topa göre destek ayağı ve kurma davranışını değiştiriyor (RESEARCH-VURUS-TURLERI.md
// §2, H1/H3 — Palucci Vieira 2019 [özet], Egan 2007 [K]). evaluate()'e context.movingBall=true
// geldiğinde ilgili modun ilgili kuralları burada tanımlı genişletilmiş aralıklarla değerlendirilir.
// Sadece shot ve placement etkileniyor: RESEARCH'te pass/freekick için ayrı bir H bulgusu yok.
const CONTEXT_OVERRIDES = {
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

// Aralığın içindeyse 100, dışındaysa uzaklığa göre doğrusal düşüş
function scoreOf(v, [lo, hi], tol) {
  if (v >= lo && v <= hi) return 100;
  const off = v < lo ? lo - v : v - hi;
  return Math.max(0, Math.round(100 * (1 - off / tol)));
}

const fmt = (v, unit) => (unit === '°' ? `${Math.round(v)}°` : unit === '×' ? `${Math.round(v)} ${unit}` : `${v.toFixed(2)} ${unit}`);

// context: { movingBall, ballSpeed } (analysis.js collectKicks/detectMovingBall'dan gelir,
// RESEARCH-VURUS-TURLERI.md §2/§4). Geriye uyumlu: verilmezse (ya da movingBall false ise)
// duran top kuralları aynen kullanılır, mevcut çağrılar (tests, "elle düzelt" akışı) değişmez.
export function evaluate(m, mode, context) {
  const overrides = CONTEXT_OVERRIDES[mode];
  const applyContext = !!(context && context.movingBall && overrides);
  const rules = applyContext
    ? RULES[mode].map((r) => (overrides[r.key] ? { ...r, ...overrides[r.key] } : r))
    : RULES[mode];
  const items = rules.map((r) => {
    const v = m[r.key];
    // Ölçülemeyen değer (nokta görünmüyor vb.) puana katılmaz, "ölçülemedi" diye gösterilir
    if (!Number.isFinite(v)) return { ...r, value: v, shown: 'ölçülemedi', score: null, tip: null };
    // Bilgi amaçlı ölçüm (ör. PL4 diz açısal hızı oranı): eşik kalibrasyon bekliyor, gösterilir
    // ama toplam puanı hiç etkilemez (minFps'e benzer bir mekanizma, bkz. RULES.placement).
    if (r.info) return { ...r, value: v, shown: `${fmt(v, r.unit)} (bilgi, puana girmez)`, score: null, tip: null };
    // Düşük fps'de güvenilmeyen ölçüm: gösterilir ama puana girmez
    if (r.minFps && (m.fps ?? 30) < r.minFps) return { ...r, value: v, shown: `${fmt(v, r.unit)} (bilgi: ${r.minFps}+ fps'de puanlanır)`, score: null, tip: null };
    const s = scoreOf(v, r.ideal, r.tol);
    const tip = s >= 80 ? null : v < r.ideal[0] ? r.low : r.high;
    return { ...r, value: v, shown: fmt(v, r.unit), score: s, tip };
  });
  const scored = items.filter((i) => i.score !== null);
  if (!scored.length) throw new Error('Hiçbir ölçüm yapılamadı. Temas karesinde oyuncunun tüm vücudu görünüyor mu?');
  const total = Math.round(
    scored.reduce((a, i) => a + i.score * i.weight, 0) / scored.reduce((a, i) => a + i.weight, 0)
  );
  const worst = [...scored].sort((a, b) => a.score * a.weight - b.score * b.weight).filter((i) => i.tip);
  // movingBall: rapor bu bayrak true ise "hareketli topa vuruş kuralları uygulandı" satırını
  // gösterir (app.js). Sadece kurallar GERÇEKTEN değiştiyse (applyContext) true olur; ör. pass/
  // freekick'te top hareketli olsa da CONTEXT_OVERRIDES tanımlı olmadığından burada false kalır.
  return { total, items, focus: worst.slice(0, 2), verdict: verdict(total, mode), movingBall: applyContext };
}

function verdict(t, mode) {
  const what = mode === 'shot' ? 'şut' : mode === 'freekick' ? 'frikik' : mode === 'placement' ? 'plase' : 'pas';
  if (t >= 85) return `Temiz bir ${what}. Tekniğin oturmuş, şimdi tekrar sayısı.`;
  if (t >= 65) return `İyi ${what}, ama birkaç detay seni geri tutuyor. Aşağıdaki iki şeye odaklan.`;
  if (t >= 45) return `Temel var, teknik dağınık. Önce en düşük puanlı maddeyi düzelt.`;
  return `Bu ${what} baştan kurulmalı. Tek tek gidelim, önce destek ayağı ve gövde.`;
}
