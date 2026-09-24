// Hoca katmanı: ölçümleri kurallarla puana ve düzeltme önerisine çevirir.
// cp-16-kural-matrisi: kural TANIMLARI (RULES/CONTEXT_OVERRIDES/MIN_COVERAGE) artık burada
// yaşamıyor — rules.js'in (vuruş türü × ayak × açı) matrisinden okunuyor, coach.js sadece
// puanlama MOTORU (scoreOf/evaluate). Her kuralın dayanağı (RESEARCH.md Ş1..Ş8/P1..P5,
// RESEARCH-VURUS-TURLERI.md PL1..PL6/H1..H5) artık rules.js'teki her kural nesnesinin
// `source` alanında da var, yorum satırlarına ek olarak.
// evaluate()'in imzası DEĞİŞMEDİ (evaluate(m, mode, context)) — geriye uyumlu, mevcut testler
// ve app.js'in "elle düzelt" akışı aynen çalışır. rules.js'teki getRuleSet(mode, foot, angle)
// ise app.js'in ölçmeden ÖNCE "bu açıdan bu vuruş türü ölçülür mü, referans kim" sorusuna
// cevap verdiği ayrı bir katman (app.js runAnalysis).
import { RULES, CONTEXT_OVERRIDES, MIN_COVERAGE } from './rules.js?v=29';

export { MIN_COVERAGE };

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
  // Kapsam: puanlanabilir kurallar = info olmayan VE (minFps varsa) fps şartını sağlayan kurallar.
  // Ş5 gibi düşük fps yüzünden bilinçli dışlanan bir kural paydaya GİRMEZ — yoksa "13 kuraldan 1'i
  // ölçüldü ama payda da zaten küçüktü" diye kapsam yapay olarak şişer.
  const scorable = rules.filter((r) => !r.info && (!r.minFps || (m.fps ?? 30) >= r.minFps));
  const scorableWeight = scorable.reduce((a, r) => a + r.weight, 0);
  const scoredWeight = scored.reduce((a, i) => a + i.weight, 0);
  const coverage = scorableWeight > 0 ? scoredWeight / scorableWeight : 0;
  // movingBall: rapor bu bayrak true ise "hareketli topa vuruş kuralları uygulandı" satırını
  // gösterir (app.js). Sadece kurallar GERÇEKTEN değiştiyse (applyContext) true olur; ör. pass/
  // freekick'te top hareketli olsa da CONTEXT_OVERRIDES tanımlı olmadığından burada false kalır.
  if (coverage < MIN_COVERAGE) {
    // Eskiden (scored.length === 0 durumunda) burada hata fırlatılırdı. Artık hiç ölçüm olmaması
    // da "yetersiz kapsam"ın bir özel hali: kullanıcıya çökme yerine ne çekmesi gerektiğini söylüyoruz.
    return {
      total: null,
      coverage,
      insufficient: true,
      items,
      focus: [],
      verdict: insufficientVerdict(mode, scorable.length - scored.length, scorable.length),
      movingBall: applyContext,
    };
  }
  const total = Math.round(scored.reduce((a, i) => a + i.score * i.weight, 0) / scoredWeight);
  const worst = [...scored].sort((a, b) => a.score * a.weight - b.score * b.weight).filter((i) => i.tip);
  return { total, coverage, insufficient: false, items, focus: worst.slice(0, 2), verdict: verdict(total, mode), movingBall: applyContext };
}

// Kapsam MIN_COVERAGE'ın altında kalınca (Ronaldo örneğindeki gibi tek madde ölçülüp geri kalanı
// kamera açısından dolayı görünmüyorsa, ya da plase/frikikte hiçbir madde ölçülemiyorsa) çağrılır.
// Hoca dilinde: kaç madde eksik olduğunu söyler, moda göre doğru çekim açısını önerir.
function insufficientVerdict(mode, missing, scorableCount) {
  const what = mode === 'shot' ? 'şut' : mode === 'freekick' ? 'frikik' : mode === 'placement' ? 'plase' : 'pas';
  const tip = mode === 'freekick'
    ? 'arkadan ya da çapraz arkadan, tüm vücut kadrajda çeksen'
    : 'tam yandan, telefon sabit, tüm vücut ve top kadrajda çeksen';
  return `Bu ${what} için ${missing}/${scorableCount} madde ölçülemedi, güvenilir bir puan veremem. Temas karesinde vücudunun büyük kısmı kadraj dışında ya da kapalı kalmış. ${tip}, hepsi ölçülebilir.`;
}

function verdict(t, mode) {
  const what = mode === 'shot' ? 'şut' : mode === 'freekick' ? 'frikik' : mode === 'placement' ? 'plase' : 'pas';
  if (t >= 85) return `Temiz bir ${what}. Tekniğin oturmuş, şimdi tekrar sayısı.`;
  if (t >= 65) return `İyi ${what}, ama birkaç detay seni geri tutuyor. Aşağıdaki iki şeye odaklan.`;
  if (t >= 45) return `Temel var, teknik dağınık. Önce en düşük puanlı maddeyi düzelt.`;
  return `Bu ${what} baştan kurulmalı. Tek tek gidelim, önce destek ayağı ve gövde.`;
}
