// outcome.js — Top ne yaptı? (2026-09-24 gece, Mert'in ürün tanımının 2. adımı)
// Saf modül: trajectory.js#fitFlight'ın oturttuğu uçuş eğrisinden topun sonucunu okur.
// DOM yok, Node testli (tests/outcome.test.mjs).
//
// 2D tek kameranın sınırı: her açıdan her şey okunmaz, okunamayan alan null kalır.
//   Yandan: kalkış açısı (top yerden mi gitti, havalandı mı) ve hız (bacak boyu/sn) okunur.
//           Sağ-sol sapma okunamaz (derinlik ekseninde kalır).
//   Arkadan: sağa-sola sapma ve falso (yana kıvrılma) okunur. Kalkış açısı güvenilir değil
//           (uzaklaşan top perspektif yüzünden görüntüde zaten yukarı gider), hız da kısalır.
// Eşiklerin hepsi [T]: Mert'in etiketli videolarıyla kalibre edilecek.

export const OUTCOME_T = {
  lowDeg: 8,        // [T] bu açının altı: top yerden gitti
  highDeg: 25,      // [T] bu açının üstü: top havalandı
  weakLegPerSec: 12, // [T] yandan: bundan yavaş top "zayıf" (ayak üstü şut ~25-30 m/s ≈ 30 bacak/sn)
  sideDeg: 10,      // [T] arkadan: dikeyden bu kadar sapma "yana gitti"
  curvePerSec: 0.8, // [T] arkadan: yanal ivme / hız oranı, üstü "falso var"
};

const deg = (r) => (r * 180) / Math.PI;

/**
 * Top uçarken kameraya göre derinlikte ne yapıyor? Uçuşun ilk ve son yarısındaki top genişliklerinin
 * medyanlarını karşılaştırır. < 0.75: belirgin küçülüyor (kameradan uzaklaşıyor), > 1.33: büyüyor.
 * Neden gerekli (Messi antrenman klibi, 2026-09-24 gece): oyuncu yandan görünüyor ama top arkadaki
 * kaleye, yani kameradan uzağa gidiyor. Perspektif yüzünden görüntüde yukarı tırmanıp yavaşlıyor
 * gibi görünüyor; eski kod bunu "havalandı (52°), yavaş" diye okudu. Derinlikte giden topun
 * yandan kalkış açısı ve hızı okunamaz. Veri yetersizse null.
 */
export function depthTrend(inliers) {
  const pts = (inliers || []).filter((p) => p.w > 0).sort((a, b) => a.t - b.t);
  if (pts.length < 4) return null;
  const med = (a) => { const s = a.map((p) => p.w).sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
  const half = Math.floor(pts.length / 2);
  const ratio = med(pts.slice(half)) / med(pts.slice(0, half));
  return ratio < 0.75 ? 'uzaklaşıyor' : ratio > 1.33 ? 'yaklaşıyor' : 'yanal';
}

/**
 * fit: fitFlight çıktısı ({ coef: {vx, ax, vy, ay}, ... }) ya da null.
 * angle: 'side' | 'behind'. legPx: vuran oyuncunun bacak boyu (piksel), hız ölçeği için.
 * Dönen: null (iz yoksa) ya da { angle, launchDeg, height, speed, speedLabel, sideDeg, direction, curve }
 *   height: 'yerden' | 'orta' | 'yüksek' | null · speedLabel: 'zayıf' | 'normal' | null
 *   direction: 'sol' | 'düz' | 'sağ' | null (görüntüdeki sol/sağ; arkadan çekimde oyuncunun sol/sağı)
 *   curve: 'var' | 'yok' | null
 */
export function readOutcome(fit, angle, legPx) {
  if (!fit || !fit.coef) return null;
  const { vx, vy, ax } = fit.coef;
  const v = Math.hypot(vx, vy);
  if (!(v > 0)) return null;
  const depth = depthTrend(fit.inliers);
  const out = { angle, depth, launchDeg: null, height: null, speed: null, speedLabel: null, sideDeg: null, direction: null, curve: null };
  if (angle === 'side' && depth && depth !== 'yanal') {
    // Top derinlikte gidiyor: yandan kalkış açısı ve hız okunamaz (bkz. depthTrend). Boş bırak.
    return out;
  }
  if (angle === 'side') {
    // Görüntüde y aşağı doğru artar: yukarı giden topta vy < 0.
    out.launchDeg = deg(Math.atan2(-vy, Math.abs(vx)));
    out.height = out.launchDeg < OUTCOME_T.lowDeg ? 'yerden' : out.launchDeg > OUTCOME_T.highDeg ? 'yüksek' : 'orta';
    if (legPx > 0) {
      out.speed = v / legPx;
      out.speedLabel = out.speed < OUTCOME_T.weakLegPerSec ? 'zayıf' : 'normal';
    }
  } else {
    // Arkadan: kaleye giden top görüntüde yukarı (vy < 0) gider. Dikeyden sapma = yön.
    out.sideDeg = deg(Math.atan2(vx, -vy));
    out.direction = Math.abs(out.sideDeg) < OUTCOME_T.sideDeg ? 'düz' : out.sideDeg > 0 ? 'sağ' : 'sol';
    // x = x0 + vx·τ + ax·τ² → yanal ivme 2·ax. Hıza bölünce ölçekten bağımsız bir kıvrılma oranı.
    out.curve = Math.abs((2 * ax) / v) > OUTCOME_T.curvePerSec ? 'var' : 'yok';
  }
  return out;
}

/**
 * Sonuçtan "sorun" etiketleri çıkarır: teşhis motoru (sebep.js) bu etiketleri açıklayan postür
 * hatasını arar. Hangi sonucun sorun olduğu vuruş türüne bağlı: frikikte havalanma istenir,
 * şutta/pasta istenmez; frikikte falso istenir. Yön (sol/sağ) sorun sayılmaz: hedef bilinmiyor.
 * Dönen: Set('yüksek' | 'zayıf' | 'falsosuz')
 */
export function outcomeProblems(outcome, mode) {
  const p = new Set();
  if (!outcome) return p;
  if (outcome.height === 'yüksek' && mode !== 'freekick') p.add('yüksek');
  if (outcome.speedLabel === 'zayıf' && mode === 'shot') p.add('zayıf');
  if (outcome.curve === 'yok' && mode === 'freekick') p.add('falsosuz');
  // Düz vuruşlarda (şut, pas) yana kıvrılma istenmez: frikik sarması yapılmış demektir.
  if (outcome.curve === 'var' && (mode === 'shot' || mode === 'pass')) p.add('kıvrıldı');
  return p;
}

/** Kullanıcıya gösterilecek tek cümlelik sonuç özeti ("Top: havalandı (32°), yavaş."). */
export function describeOutcome(o) {
  if (!o) return null;
  const parts = [];
  if (o.height) parts.push(o.height === 'yerden' ? 'yerden gitti' : o.height === 'yüksek' ? `havalandı (${Math.round(o.launchDeg)}°)` : `orta yükseklikte kalktı (${Math.round(o.launchDeg)}°)`);
  if (o.speedLabel) parts.push(o.speedLabel === 'zayıf' ? 'yavaş gitti' : 'hızlı gitti');
  if (o.direction) parts.push(o.direction === 'düz' ? 'düz gitti' : `${o.direction}a gitti`);
  if (o.curve) parts.push(o.curve === 'var' ? 'havada yana kıvrıldı (falso)' : 'kıvrılmadan gitti');
  if (!parts.length && o.angle === 'side' && (o.depth === 'uzaklaşıyor' || o.depth === 'yaklaşıyor')) {
    return `Top kameradan ${o.depth === 'uzaklaşıyor' ? 'uzaklaşarak' : 'yaklaşarak'} gitti; bu açıdan yüksekliği ve hızı güvenilir okunamaz.`;
  }
  return parts.length ? `Top ${parts.join(', ')}.` : null;
}
