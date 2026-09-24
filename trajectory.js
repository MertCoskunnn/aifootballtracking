// Saf modül: temastan sonra topun izlediği yol (oyunlardaki "şut çizgisi" için).
// DOM'a bağlı değil, Node ile test edilir (bkz. tests/trajectory.test.mjs).
//
// Her karede birden çok top adayı olabilir (kalabalık antrenmanda yerde duran başka toplar,
// bulut/kafa gibi yanlış tespitler). Topu temas noktasından başlayıp kare kare en yakın adayla
// takip ederiz; aday son bilinen yerden çok uzaktaysa (sıçrama) başka bir toptur, alınmaz.
// Ard arda MAX_MISS kare top bulunamazsa top kadrajdan çıkmış sayılır, yol biter.

export const MAX_MISS = 6;

/**
 * frames: [{ balls: [{x,y}] }], contact: temas karesi indeksi, start: temas anındaki top {x,y}.
 * maxStep: bir karede topun gidebileceği en uzun yol (piksel); kaçırılan kare sayısıyla büyür.
 * Dönen: [{ i, x, y }] — temas karesinden başlayan, zaman sıralı noktalar.
 */
export function ballFlight(frames, contact, start, maxStep) {
  const path = [{ i: contact, x: start.x, y: start.y }];
  let last = path[0], vx = 0, vy = 0, miss = 0;
  for (let i = contact + 1; i < frames.length && miss < MAX_MISS; i++) {
    const gap = i - last.i;
    // Beklenen yer: son hız ile ileri tahmin (düz giden topu diğer toplardan ayırır)
    const px = last.x + vx * gap, py = last.y + vy * gap;
    let best = null, bestD = maxStep * gap;
    for (const b of frames[i]?.balls || []) {
      const d = Math.hypot(b.x - px, b.y - py);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) { miss++; continue; }
    miss = 0;
    vx = (best.x - last.x) / gap; vy = (best.y - last.y) / gap;
    last = { i, x: best.x, y: best.y };
    path.push(last);
  }
  return path;
}

// --- Eğri oturtma: RANSAC + ağırlıklı en küçük kareler ---
// Amaç: ballFlight'ın kare-kare "en yakın komşu" izlemesi tek bir yanlış tespitte kancalanabiliyor
// ve 25 fps'te noktadan noktaya zıplıyor (oyunlardaki gibi akıcı değil). Burada topun 2D ekran
// yörüngesine ikinci dereceden bir eğri (x,y ayrı ayrı τ=t-contactT'nin polinomu) oturtuyoruz;
// RANSAC yanlış tespitleri (yerde duran başka top, bulut/kafa vb.) dışarıda bırakıyor, sonra
// kalan "doğru" noktalara ağırlıklı en küçük kareler ile son eğri çiziliyor. Bu eğriden istenen
// herhangi bir zamanda ara nokta (flightAt) ve yumuşak animasyon için kuyruk (flightTrail) üretilir.

// Temas noktası (τ=0 civarı) diğer noktalara göre çok daha güvenilir: kullanıcının işaretlediği
// gerçek top konumu. Son ağırlıklı uydurmada bu noktayı bu kadar kat ağırlıkla "sabitliyoruz" —
// tam bir katı kısıt değil (tek kötü kareden gelen küçük gürültüye karşı dayanıklı kalsın diye),
// ama eğrinin başlangıcı neredeyse hep temas noktasından geçsin diye baskın.
const ANCHOR_WEIGHT = 10;

// RANSAC inlier eşiği topun çapına (w) göre ölçeklenir: küçük/uzak topta dar tolerans,
// büyük/yakın topta geniş tolerans. w bilinmiyorsa makul bir varsayılana düşer.
const DEFAULT_BALL_WIDTH = 20;
const MIN_THRESHOLD_PX = 4;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return undefined;
  const mid = n >> 1;
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function estimateBallWidth(points, forced) {
  if (Number.isFinite(forced) && forced > 0) return forced;
  const ws = points.map((p) => p.w).filter((w) => Number.isFinite(w) && w > 0);
  return ws.length ? median(ws) : DEFAULT_BALL_WIDTH;
}

// 3x3 doğrusal sistemi Cramer kuralıyla çözer; dejenere (tekil) ise null döner.
function solve3(A, b) {
  const det = (M) =>
    M[0][0] * (M[1][1] * M[2][2] - M[1][2] * M[2][1]) -
    M[0][1] * (M[1][0] * M[2][2] - M[1][2] * M[2][0]) +
    M[0][2] * (M[1][0] * M[2][1] - M[1][1] * M[2][0]);
  const D = det(A);
  if (Math.abs(D) < 1e-9) return null;
  const withCol = (col) => A.map((row, i) => row.map((v, j) => (j === col ? b[i] : v)));
  return [det(withCol(0)) / D, det(withCol(1)) / D, det(withCol(2)) / D];
}

// Ağırlıklı ikinci derece polinom uydurma: v(τ) = c0 + c1·τ + c2·τ². Normal denklemler.
// n=3 ve ağırlıklar eşitse tam (kalıntısız) çözüme denk gelir — RANSAC'ın minimal örneklemesi
// ve son ağırlıklı uydurma aynı fonksiyonu kullanabilir.
function quadFit(taus, vals, weights) {
  let S0 = 0, S1 = 0, S2 = 0, S3 = 0, S4 = 0, T0 = 0, T1 = 0, T2 = 0;
  for (let i = 0; i < taus.length; i++) {
    const w = weights ? weights[i] : 1;
    const t = taus[i], t2 = t * t;
    S0 += w; S1 += w * t; S2 += w * t2; S3 += w * t2 * t; S4 += w * t2 * t2;
    const v = vals[i];
    T0 += w * v; T1 += w * t * v; T2 += w * t2 * v;
  }
  return solve3([[S0, S1, S2], [S1, S2, S3], [S2, S3, S4]], [T0, T1, T2]);
}

// RANSAC için minimal (3 noktalı) örnek adayları üretir. Deterministik: Math.random YOK, testler
// kararlı kalsın diye. τ'ya göre sıralayıp erken/orta/geç üçte birlik dilimlerden temsilci noktalar
// seçip aralarında kombinasyon kuruyoruz — gerçek yörünge zamana yayılı, yanlış tespitler genelde
// değil, bu yüzden bu "erken+orta+geç" örnekleme gerçek eğriyi bulmakta güçlü bir önsezi verir.
// Az sayıda noktada (<=12) tüm kombinasyonları dener (ucuz).
function candidateTriples(sortedIdx, pts) {
  const n = sortedIdx.length;
  if (n <= 12) {
    const out = [];
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        for (let k = j + 1; k < n; k++) out.push([sortedIdx[i], sortedIdx[j], sortedIdx[k]]);
    return out;
  }
  const third = Math.floor(n / 3);
  const low = sortedIdx.slice(0, third), mid = sortedIdx.slice(third, third * 2), high = sortedIdx.slice(third * 2);
  const K = 6;
  const pick = (arr) => {
    if (arr.length <= K) return arr;
    const step = arr.length / K;
    const out = [];
    for (let i = 0; i < K; i++) out.push(arr[Math.floor(i * step)]);
    return out;
  };
  const out = [];
  for (const a of pick(low)) for (const b of pick(mid)) for (const c of pick(high)) {
    if (pts[a].tau === pts[b].tau || pts[b].tau === pts[c].tau || pts[a].tau === pts[c].tau) continue;
    out.push([a, b, c]);
  }
  return out;
}

/**
 * points: [{t,x,y,w?}] — ballFlight çıktısına (veya collectCandidates'a) frames'ten t eklenmiş hali;
 * w varsa (top genişliği) eşik ölçeklemede kullanılır. contactT: temas karesinin t'si (τ=0 burası).
 * Dönen: { coef:{x0,vx,ax,y0,vy,ay}, contactT, tEnd, inliers, rmsPx } ya da yetersiz konsensüs varsa null.
 */
export function fitFlight(points, contactT, opts = {}) {
  if (!Array.isArray(points) || points.length < 3) return null;
  const pts = points
    .filter((p) => Number.isFinite(p?.t) && Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .map((p) => ({ t: p.t, x: p.x, y: p.y, w: p.w, tau: p.t - contactT }));
  const distinctTau = new Set(pts.map((p) => p.tau));
  if (pts.length < 3 || distinctTau.size < 3) return null;

  const ballW = estimateBallWidth(pts, opts.ballWidth);
  const threshold = Math.max(MIN_THRESHOLD_PX, ballW * 0.5);

  // Temas noktası: |τ| en küçük olan nokta (genelde tam τ=0, kullanıcının işaretlediği top).
  let anchorIdx = 0;
  for (let i = 1; i < pts.length; i++) if (Math.abs(pts[i].tau) < Math.abs(pts[anchorIdx].tau)) anchorIdx = i;

  const sortedIdx = pts.map((_, i) => i).sort((a, b) => pts[a].tau - pts[b].tau);
  const triples = candidateTriples(sortedIdx, pts);

  let bestInliers = null, bestAvgErr = Infinity;
  for (const [i, j, k] of triples) {
    const taus = [pts[i].tau, pts[j].tau, pts[k].tau];
    const fx = quadFit(taus, [pts[i].x, pts[j].x, pts[k].x]);
    const fy = quadFit(taus, [pts[i].y, pts[j].y, pts[k].y]);
    if (!fx || !fy) continue;
    const inliers = [];
    let sumErr = 0;
    for (let p = 0; p < pts.length; p++) {
      const tau = pts[p].tau, tau2 = tau * tau;
      const px = fx[0] + fx[1] * tau + fx[2] * tau2;
      const py = fy[0] + fy[1] * tau + fy[2] * tau2;
      const d = Math.hypot(pts[p].x - px, pts[p].y - py);
      if (d <= threshold) { inliers.push(p); sumErr += d; }
    }
    if (inliers.length < 3) continue;
    const avgErr = sumErr / inliers.length;
    if (inliers.length > (bestInliers?.length ?? 0) || (inliers.length === bestInliers?.length && avgErr < bestAvgErr)) {
      bestInliers = inliers; bestAvgErr = avgErr;
    }
  }
  if (!bestInliers || bestInliers.length < 3) return null;

  const inlierSet = new Set(bestInliers);
  inlierSet.add(anchorIdx); // temas noktası her zaman içeride
  const idxs = [...inlierSet];

  const taus = idxs.map((i) => pts[i].tau);
  const weights = idxs.map((i) => (i === anchorIdx ? ANCHOR_WEIGHT : 1));
  const fx = quadFit(taus, idxs.map((i) => pts[i].x), weights);
  const fy = quadFit(taus, idxs.map((i) => pts[i].y), weights);
  if (!fx || !fy) return null;

  let sumSq = 0;
  for (const i of idxs) {
    const tau = pts[i].tau, tau2 = tau * tau;
    const px = fx[0] + fx[1] * tau + fx[2] * tau2;
    const py = fy[0] + fy[1] * tau + fy[2] * tau2;
    sumSq += (pts[i].x - px) ** 2 + (pts[i].y - py) ** 2;
  }
  const rmsPx = Math.sqrt(sumSq / idxs.length);
  const tEnd = Math.max(...idxs.map((i) => pts[i].t));

  return {
    coef: { x0: fx[0], vx: fx[1], ax: fx[2], y0: fy[0], vy: fy[1], ay: fy[2] },
    contactT,
    tEnd,
    inliers: idxs.map((i) => ({ t: pts[i].t, x: pts[i].x, y: pts[i].y })),
    rmsPx,
  };
}

/** fit üzerinde herhangi bir t anındaki top konumu. */
export function flightAt(fit, t) {
  const tau = t - fit.contactT, tau2 = tau * tau;
  const { x0, vx, ax, y0, vy, ay } = fit.coef;
  return { x: x0 + vx * tau + ax * tau2, y: y0 + vy * tau + ay * tau2 };
}

/**
 * Animasyonun o anki kuyruğu: [{x,y,alpha,width}], kuyruk ucu (en eski) alpha≈0/ince,
 * baş (en yeni, tNow) alpha=1/kalın. tNow temas anından önceyse [] döner. Top kadrajdan
 * çıktıysa (tNow, fit.tEnd'i aştıysa) en fazla extendSec kadar ileri ekstrapole edilir.
 */
export function flightTrail(fit, tNow, { extendSec = 0.5, tailSec = 0.35, samples = 24 } = {}) {
  if (!fit || tNow <= fit.contactT) return [];
  const end = Math.min(tNow, fit.tEnd + extendSec);
  if (end <= fit.contactT) return [];
  const start = Math.max(fit.contactT, end - tailSec);
  const n = Math.max(2, samples);
  const out = [];
  for (let k = 0; k < n; k++) {
    const frac = k / (n - 1); // 0 = kuyruk ucu (en eski), 1 = baş (en yeni)
    const t = start + (end - start) * frac;
    const { x, y } = flightAt(fit, t);
    out.push({ x, y, alpha: frac, width: 1 + 5 * frac });
  }
  return out;
}

/** Sönmeyen, soluk tam yol (temastan tNow'a kadar, fit.tEnd'i aşmaz): [{x,y}]. */
export function flightPath(fit, tNow, samples = 40) {
  if (!fit || tNow <= fit.contactT) return [];
  const end = Math.min(tNow, fit.tEnd);
  if (end <= fit.contactT) return [];
  const n = Math.max(2, samples);
  const out = [];
  for (let k = 0; k < n; k++) {
    const t = fit.contactT + (end - fit.contactT) * (k / (n - 1));
    out.push(flightAt(fit, t));
  }
  return out;
}

/**
 * fitFlight için aday nokta havuzu: contact karesinden başlayıp maxSec saniye boyunca
 * HER karedeki TÜM top tespitlerini toplar (ballFlight'ın aksine tek adaya indirgemez) —
 * RANSAC hangisinin gerçek yörünge olduğuna kendi karar versin diye. Dönen: [{t,x,y,w}].
 */
export function collectCandidates(frames, contact, maxSec = 1.5) {
  const out = [];
  if (!Array.isArray(frames) || contact == null || contact < 0 || contact >= frames.length) return out;
  const t0 = frames[contact]?.t ?? 0;
  for (let i = contact; i < frames.length; i++) {
    const f = frames[i];
    if (!f) continue;
    if (f.t - t0 > maxSec) break;
    for (const b of f.balls || []) out.push({ t: f.t, x: b.x, y: b.y, w: b.w });
  }
  return out;
}
