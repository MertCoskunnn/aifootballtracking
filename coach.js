// Hoca katmanı: ölçümleri kurallarla puana ve düzeltme önerisine çevirir.
// Her kuralın dayanağı RESEARCH.md'de (Ş1..Ş8, P1..P5).
// ideal: [alt, üst] aralığı, tol: aralığın dışında puanın 0'a düştüğü uzaklık.

const RULES = {
  shot: [
    { key: 'supportOffset', ref: 'Ş1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.45, -0.05], tol: 0.30, weight: 3,
      low: 'Destek ayağın topun çok gerisinde kalmış. Topa uzanıyorsun, şut zayıflar ve top havalanır. Destek ayağını topun hizasına bas.',
      high: 'Destek ayağın topun önüne geçmiş. Top havaya kalkar. Destek ayağını topun hizasına ya da biraz gerisine bas.' },
    { key: 'trunk', ref: 'Ş3', name: 'Gövde açısı', unit: '°', ideal: [-18, 3], tol: 15, weight: 3,
      low: 'Çok geriye yaslanıyorsun, top havalanır. Temas anında göğsünü biraz öne al.',
      high: 'Öne kapanıyorsun. Elit oyuncular temasta dik ya da hafif geride durur.' },
    { key: 'supportKnee', ref: 'Ş2', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 2,
      low: 'Destek dizin kilitli, düz basıyorsun. Dizini hafif bük, darbeyi emsin ve dengen artsın.',
      high: 'Destek dizin çok bükülmüş, çöküyorsun. Destek bacağını daha sağlam tut.' },
    { key: 'backswing', ref: 'Ş4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 35, weight: 2,
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, kamçı etkisi oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama bozulabilir.' },
    // minFps: 30 fps'de diz iki kare arasında ~39° açılıyor, gerçek veride art arda 128°/54°/7°
    // görüldü. Bu çözünürlükte ölçüm tesadüfe kalıyor, puana ancak 50+ fps'de girer (METRICS.md).
    { key: 'kickKnee', ref: 'Ş5', name: 'Temas anında diz', unit: '°', ideal: [30, 60], tol: 25, weight: 1, minFps: 50,
      low: 'Temas geç oluyor: top ayağına gelmeden bacağın tamamen açılmış. Temas anını biraz öne çek.',
      high: 'Temas erken oluyor: dizin daha açılmadan topa değiyorsun. Temas anını biraz geciktir.' },
    { key: 'armOpen', ref: 'Ş7', name: 'Karşı kol', unit: '°', ideal: [35, 110], tol: 30, weight: 1,
      low: 'Karşı kolun gövdene yapışık. Kolunu yana aç, gövde dönüşü ve denge için gerekli.',
      high: 'Karşı kolun çok yukarıda, dengeyi bozabilir.' },
    { key: 'followHip', ref: 'Ş8', name: 'Takip (kalça fleksiyonu)', unit: '°', ideal: [65, 125], tol: 30, weight: 2,
      low: 'Vuruştan sonra uyluğun öne kalkmıyor, bacağını hedefe doğru savur.',
      high: 'Takip çok yüksek, top da havalanıyor olabilir. Vuruşun ardından bacağını gereğinden fazla kaldırma.' },
  ],
  pass: [
    { key: 'supportOffset', ref: 'P1', name: 'Destek ayağı konumu', unit: 'bacak', ideal: [-0.2, 0.1], tol: 0.3, weight: 3,
      low: 'Destek ayağın topun gerisinde. Pası uzanarak atıyorsun, isabet düşer. Ayağını topun yanına bas.',
      high: 'Destek ayağın topun önünde. Pas havalanır. Ayağını topun yanına bas.' },
    { key: 'trunk', ref: 'P3', name: 'Gövde açısı', unit: '°', ideal: [-10, 8], tol: 15, weight: 3,
      low: 'Geriye yaslanıyorsun, pas yerden gitmez. Gövdeni topun üstünde tut.',
      high: 'Çok öne kapanıyorsun. Gövden dik ya da hafif öne eğik olsun.' },
    { key: 'backswing', ref: 'P5', name: 'Salınım', unit: '°', ideal: [40, 100], tol: 35, weight: 2,
      low: 'Salınım çok kısa, pasın gücü yetmeyebilir.',
      high: 'Pası şut gibi atıyorsun. Pas isabet işidir, salınımı kısalt.' },
    { key: 'followRise', ref: 'P4', name: 'Takip', unit: 'bacak', ideal: [0.05, 0.45], tol: 0.3, weight: 2,
      low: 'Topa vurup bırakıyorsun. Ayağın kısa bir takiple hedefe doğru devam etsin.',
      high: 'Takip çok yüksek, pas havalanır. Kısa ve alçak takip yap.' },
    { key: 'supportKnee', ref: 'P1', name: 'Destek dizi', unit: '°', ideal: [15, 45], tol: 20, weight: 1,
      low: 'Destek dizin kilitli. Hafif bük, denge artar.',
      high: 'Destek dizin çok bükülmüş.' },
  ],
  // Frikik / falsolu vuruş: arkadan kamera, ölçümler measureFreeKick()'ten gelir (RESEARCH.md F1..F5)
  freekick: [
    { key: 'supportLateral', ref: 'F2', name: 'Destek ayağının topa yanal mesafesi', unit: 'bacak', ideal: [0.05, 0.40], tol: 0.25, weight: 3,
      low: 'Destek ayağın topa çok yakın ya da yanlış tarafta duruyor, vuruş bacağının salınım alanı daralıyor. Ayağını topun yanına, biraz dışına bas.',
      high: 'Destek ayağın topun çok uzağında, denge ve isabet kaybediyorsun. Ayağını topa biraz yaklaştır.' },
    { key: 'crossing', ref: 'F5', name: 'Takibin çaprazlaması', unit: 'bacak', ideal: [0.3, 1.0], tol: 0.4, weight: 3,
      low: 'Vuruştan sonra bacağın gövdenin önünden karşı tarafa geçmiyor, sarma takip eksik. Topa vurduktan sonra ayağın karşı omzuna doğru devam etsin.',
      high: 'Takip çok fazla çaprazlıyor, kontrolü kaybedebilirsin. Sarmayı biraz kıs.' },
    { key: 'trunkLateral', ref: 'F3', name: 'Gövdenin yana yatışı', unit: '°', ideal: [5, 22], tol: 15, weight: 2,
      low: 'Gövden dik ya da yanlış tarafa yatık. Gövdeni destek ayağının tarafına hafifçe yatır, vuruş bacağın serbest kalsın.',
      high: 'Gövden destek tarafına çok yatmış, denge ve temas noktası kayabilir. Yatışı azalt.' },
    { key: 'backswing', ref: 'F4', name: 'Kurma (geri salınım)', unit: '°', ideal: [85, 130], tol: 40, weight: 2,
      low: 'Bacağını yeterince kurmuyorsun. Topuğun kalçana doğru gelsin, dönüş ve spin oradan doğar.',
      high: 'Kurma çok abartılı, zamanlama ve denge bozulabilir.' },
    { key: 'approachAngle', ref: 'F1', name: 'Yaklaşma açısı', unit: '°', ideal: [20, 50], tol: 30, weight: 2,
      low: 'Kameraya çok dik (düz) koşuyorsun. Topa hafif çapraz bir çizgiyle yaklaş, ayağın topun altına/yanına daha rahat girer.',
      high: 'Yaklaşma çok açılı, denge ve zamanlama bozulabilir. Açıyı biraz kapat.' },
  ],
};

// Aralığın içindeyse 100, dışındaysa uzaklığa göre doğrusal düşüş
function scoreOf(v, [lo, hi], tol) {
  if (v >= lo && v <= hi) return 100;
  const off = v < lo ? lo - v : v - hi;
  return Math.max(0, Math.round(100 * (1 - off / tol)));
}

const fmt = (v, unit) => (unit === '°' ? `${Math.round(v)}°` : `${v.toFixed(2)} ${unit}`);

export function evaluate(m, mode) {
  const rules = RULES[mode];
  const items = rules.map((r) => {
    const v = m[r.key];
    // Ölçülemeyen değer (nokta görünmüyor vb.) puana katılmaz, "ölçülemedi" diye gösterilir
    if (!Number.isFinite(v)) return { ...r, value: v, shown: 'ölçülemedi', score: null, tip: null };
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
  return { total, items, focus: worst.slice(0, 2), verdict: verdict(total, mode) };
}

function verdict(t, mode) {
  const what = mode === 'shot' ? 'şut' : mode === 'freekick' ? 'frikik' : 'pas';
  if (t >= 85) return `Temiz bir ${what}. Tekniğin oturmuş, şimdi tekrar sayısı.`;
  if (t >= 65) return `İyi ${what}, ama birkaç detay seni geri tutuyor. Aşağıdaki iki şeye odaklan.`;
  if (t >= 45) return `Temel var, teknik dağınık. Önce en düşük puanlı maddeyi düzelt.`;
  return `Bu ${what} baştan kurulmalı. Tek tek gidelim, önce destek ayağı ve gövde.`;
}
