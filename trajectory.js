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
// cp-21-lag-incelemesi: bug raporunda "nişangah gerçek topun ~40-50px gerisinde kalıyor" şüphesi bu
// ağırlığa bağlandı. Sentetik testle ölçüldü (bkz. tests/trajectory.test.mjs "ANCHOR_WEIGHT lag
// incelemesi"): ağırlık 10'dan 1'e kadar değiştirilince ölçülen sapma pratikte DEĞİŞMİYOR (fark
// <1px) — çünkü ağırlık yalnız 4+ FARKLI τ'lu nokta varken (aşırı-belirlenmiş sistem) devreye
// giriyor; asıl büyük sapma (100+ px) az/erken veriyle UZAĞA ekstrapole etmekten kaynaklanıyordu
// (bkz. maxExtendSec, aşağıda ayrı düzeltildi). Yine de ölçülü bir önlem olarak biraz düşürüldü —
// tek kötü kareye karşı hâlâ baskın (4 kat), ama eskisi kadar aşırı değil.
const ANCHOR_WEIGHT = 4;

// cp-21-asiri-ekstrapolasyon: fit'in dataSpan'ine (tEnd-contactT) göre izin verilen ekstrapolasyon
// tavanı — bkz. fitFlight sonundaki maxExtendSec hesaplaması.
const MIN_EXTEND_SEC = 0.2;
const MAX_EXTEND_SEC = 0.5;

// RANSAC inlier eşiği topun çapına (w) göre ölçeklenir: küçük/uzak topta dar tolerans,
// büyük/yakın topta geniş tolerans. w bilinmiyorsa makul bir varsayılana düşer.
const DEFAULT_BALL_WIDTH = 20;
const MIN_THRESHOLD_PX = 4;

// cp-20-sabit-top: kalabalık/antrenman sahnesinde yerde duran BAŞKA bir top olabilir. O top her
// karede (neredeyse) aynı yerde göründüğü için RANSAC'a "mükemmel" bir sıfır-hız modeli sunar —
// uçan gerçek top ise 25 fps'te seyrek/bulanık tespit edilir ve daha az inlier toplar. Sonuç: RANSAC
// yanlışlıkla yerdeki topu seçebiliyordu (bkz. bug raporu: nişangah temas sonrası havadaki topa değil
// ~80px uzaktaki duran topa atlıyordu). İki savunma satırı:
//  1) collectCandidates(...,{contactAnchor}): temas ÖNCESİ sahnede duran (ve temas topunun kendisi
//     OLMAYAN) top kümelerini bulur, temas SONRASI adaylardan bu kümelere yakın olanları eler.
//  2) fitFlight: son çare olarak, oturttuğu eğri temastan sonraki ilk MIN_START_DISPLACEMENT_SEC
//     içinde en az MIN_START_DISPLACEMENT_FACTOR×topÇapı kadar uzaklaşmıyorsa (hız≈0 demektir,
//     muhtemelen bir sabit topa kilitlenmiştir) reddeder (null) — nişangah asla sabit topa atlamaz,
//     olsa olsa "iz yok" gösterir.
const STATIONARY_LOOKBACK_SEC = 0.5;
const STATIONARY_CLUSTER_MIN_FRAMES = 2;
const MIN_START_DISPLACEMENT_SEC = 0.2;
const MIN_START_DISPLACEMENT_FACTOR = 1.5;
// [T] Temas dışındaki iz noktalarının en az bu hızda (top çapı/sn) ilerlemesi gerekir (savunma #3).
// Ölçüm: Messi klibindeki yavaş nesne ~2.5 çap/sn; testteki yay çizen top ~10 çap/sn; yavaş pas ~23.
const MIN_FLIGHT_DIAM_PER_SEC = 5;
// [T] Temas → ilk iz noktası hızı, uçuşun erken hızının en fazla bu katı olabilir (hız kopukluğu).
const MAX_JUMP_RATIO = 5;
// [T] İzin ilk noktası temastan en geç bu kadar sonra olmalı (saniye).
const MAX_FIRST_GAP_SEC = 0.2;

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return undefined;
  const mid = n >> 1;
  return n % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

const avg = (nums) => nums.reduce((s, v) => s + v, 0) / nums.length;

// Temas ÖNCESİ ~lookbackSec içinde, birden çok karede aynı yerde kalan (kümelenen) top tespitleri —
// "duran toplar". Bunlardan temas ankorunun KENDİSİ olanı (asıl vurulacak top, o da vurulmadan önce
// durur) hariç tutulur: ankora bir top çapından daha yakın kümeler "temas topu" sayılır, elenmez.
function findStationaryDecoys(frames, contact, anchor, lookbackSec) {
  if (!anchor || !Array.isArray(frames)) return [];
  const contactT = frames[contact]?.t ?? 0;
  const pts = [];
  for (let i = contact - 1; i >= 0; i--) {
    const f = frames[i];
    if (!f) continue;
    if (contactT - f.t > lookbackSec) break;
    for (const b of f.balls || []) pts.push({ x: b.x, y: b.y, w: b.w });
  }
  if (pts.length < STATIONARY_CLUSTER_MIN_FRAMES) return [];
  const clusters = [];
  for (const p of pts) {
    const r = Math.max(6, (p.w || DEFAULT_BALL_WIDTH) * 0.6);
    const c = clusters.find((c) => Math.hypot(c.x - p.x, c.y - p.y) < r);
    if (c) { c.pts.push(p); c.x = avg(c.pts.map((q) => q.x)); c.y = avg(c.pts.map((q) => q.y)); }
    else clusters.push({ x: p.x, y: p.y, pts: [p] });
  }
  const anchorR = Math.max(10, anchor.w || DEFAULT_BALL_WIDTH);
  return clusters
    .filter((c) => c.pts.length >= STATIONARY_CLUSTER_MIN_FRAMES)
    .filter((c) => Math.hypot(c.x - anchor.x, c.y - anchor.y) > anchorR) // temas topunun kendisi değil
    .map((c) => ({ x: c.x, y: c.y, w: median(c.pts.map((p) => p.w).filter((w) => Number.isFinite(w))) || DEFAULT_BALL_WIDTH }));
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

  // Tek "en iyi" aday yerine sıralı aday listesi: en çok noktayı tutan aday son kontrollerde (hız,
  // savunma #2/#3) elenirse sıradakine geçilir. Messi klibinde en kalabalık aday yavaş kayan bir
  // nesneydi; gerçek uçuş ikinci sıradaydı ve eskiden hiç denenmiyordu.
  const candidates = [];
  const seen = new Set();
  for (const [i, j, k] of triples) {
    const taus = [pts[i].tau, pts[j].tau, pts[k].tau];
    const fx = quadFit(taus, [pts[i].x, pts[j].x, pts[k].x]);
    const fy = quadFit(taus, [pts[i].y, pts[j].y, pts[k].y]);
    if (!fx || !fy) continue;
    // Savunma #3 seçimin içinde: vurulmuş top hızında olmayan aday eğri hiç yarışmaz. Yoksa yavaş
    // kayan bir nesnenin çok sayıdaki tutarlı noktası, az tespit edilen gerçek uçuşu geride bırakır.
    const tLo = Math.min(...taus), tHi = Math.max(...taus);
    const midSpeed = Math.hypot(fx[1] + fx[2] * (tLo + tHi), fy[1] + fy[2] * (tLo + tHi));
    if (midSpeed < (opts.minFlightRate ?? MIN_FLIGHT_DIAM_PER_SEC) * ballW) continue;
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
    const key = inliers.join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ inliers, avgErr: sumErr / inliers.length });
  }
  candidates.sort((a, b) => (b.inliers.length - a.inliers.length) || (a.avgErr - b.avgErr));
  for (const c of candidates.slice(0, 20)) {
    const fit = finalizeFit(c.inliers, pts, anchorIdx, contactT, ballW, opts);
    if (fit) return fit;
  }
  return null;
}

// Aday bir inlier kümesinden son eğriyi kurar ve fiziksel kontrolleri uygular (sabit top, yavaş
// nesne). Geçemezse null: fitFlight bir sonraki adaya geçer.
function finalizeFit(bestInliers, pts, anchorIdx, contactT, ballW, opts) {
  const inlierSet = new Set(bestInliers);
  inlierSet.add(anchorIdx); // temas noktası her zaman içeride
  const idxs = [...inlierSet];

  const anchorWeight = opts.anchorWeight ?? ANCHOR_WEIGHT;
  const taus = idxs.map((i) => pts[i].tau);
  const weights = idxs.map((i) => (i === anchorIdx ? anchorWeight : 1));
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

  // cp-20-sabit-top savunması #2: eğri temastan sonraki ilk MIN_START_DISPLACEMENT_SEC içinde
  // yeterince uzaklaşmıyorsa (hız≈0) bir sabit topa kilitlenmiş olabilir — nişangah asla oraya
  // atlamasın diye null dönüyoruz (çağıran taraf "iz yok" gösterir, eski kare-tabanlı yedeğe düşmez).
  const minStartSec = opts.minStartSec ?? MIN_START_DISPLACEMENT_SEC;
  const minStartFactor = opts.minStartFactor ?? MIN_START_DISPLACEMENT_FACTOR;
  const startDx = fx[1] * minStartSec + fx[2] * minStartSec * minStartSec;
  const startDy = fy[1] * minStartSec + fy[2] * minStartSec * minStartSec;
  if (Math.hypot(startDx, startDy) < minStartFactor * ballW) return null;

  // Savunma #3 (2026-09-24 gece, Messi antrenman klibi): temas noktası DIŞINDAKİ iz noktaları
  // kendi aralarında vurulmuş bir topun hızıyla ilerlemeli. Gerçek veride RANSAC, kale tarafında
  // yavaşça kayan bir nesneye (kaleci eldiveni/başı; 0.8 sn'de ~40 px, saniyede ~2.5 top çapı)
  // kilitlendi; eğri temas noktasından oraya "atlayıp" savunma #2'yi geçti. Vurulmuş top, uzağa
  // gidip perspektifle kısalsa bile saniyede onlarca top çapı yol alır (yavaş bir pas ~5 m/s ≈ 23
  // çap/sn). Eşik [T] MIN_FLIGHT_DIAM_PER_SEC.
  // Uç noktalar arası mesafe yanıltır (yay çizip aynı yüksekliğe dönen top "yavaş" görünür) ve
  // titreşim yol uzunluğunu şişirir; bu yüzden temas dışı noktalara ayrı bir eğri oturtup o eğrinin
  // ortalama hızını ölçüyoruz.
  const flight = idxs.filter((i) => i !== anchorIdx).map((i) => pts[i]).sort((a, b) => a.tau - b.tau);
  const span = flight.length ? flight[flight.length - 1].tau - flight[0].tau : 0;
  const minRate = opts.minFlightRate ?? MIN_FLIGHT_DIAM_PER_SEC;
  // Vurulan top temastan hemen sonra görünür (Messi: 0.13 sn, referans 9: ilk karelerde). İz
  // temastan çok sonra başlıyorsa temas noktası uzaktaki başka bir nesneye bağlanmış demektir.
  if (flight.length && flight[0].tau - pts[anchorIdx].tau > (opts.maxFirstGapSec ?? MAX_FIRST_GAP_SEC)) return null;
  // 2-3 nokta: eğri oturtmak için az, iki uç arası düz hız yeterli.
  if (flight.length >= 2 && flight.length < 4 && span > 0.05) {
    const a = flight[0], b = flight[flight.length - 1];
    if (Math.hypot(b.x - a.x, b.y - a.y) / span < minRate * ballW) return null;
  }
  // 4+ nokta: ardışık noktalar arası hızların MEDYANI. Ortalama, iki yavaş küme arasındaki tek bir
  // sıçramayla şişiyordu (Messi klibinde gerçekten oldu); medyan buna dayanıklı, gerçek uçuşta ise
  // her adım hızlı. Aynı zamanlı (dt≈0) noktalar atlanır.
  if (flight.length >= 4 && span > 0.1) {
    const rates = [];
    for (let k = 1; k < flight.length; k++) {
      const dt = flight[k].tau - flight[k - 1].tau;
      if (dt > 1e-3) rates.push(Math.hypot(flight[k].x - flight[k - 1].x, flight[k].y - flight[k - 1].y) / dt);
    }
    // Sadece uçuşun İLK kısmı: kameradan uzaklaşan top (arkadan çekimde hep böyle) perspektif
    // yüzünden görüntüde giderek yavaşlar; vurulan top ise ilk karelerde her zaman hızlıdır.
    const early = rates.slice(0, Math.max(3, Math.ceil(rates.length / 3))).sort((a, b) => a - b);
    const earlyRate = early.length ? early[Math.floor(early.length / 2)] : 0;
    if (early.length && earlyRate < minRate * ballW) return null;
    // Hız kopukluğu: temas noktasından ilk iz noktasına "sıçrama" hızı, uçuşun erken hızından çok
    // büyükse bu bir top değil; eğri temas noktasını uzaktaki yavaş bir nesneye bağlamış (Messi
    // klibi: sıçrama 1380 px/sn, sonra ~90 px/sn). Gerçek topta ilk adım ile sonrakiler aynı
    // mertebede (1380 → 650-730). Eşik [T] MAX_JUMP_RATIO.
    const anchor = pts[anchorIdx];
    const jumpDt = flight[0].tau - anchor.tau;
    if (jumpDt > 1e-3 && earlyRate > 0) {
      const jumpRate = Math.hypot(flight[0].x - anchor.x, flight[0].y - anchor.y) / jumpDt;
      if (jumpRate > (opts.maxJumpRatio ?? MAX_JUMP_RATIO) * earlyRate) return null;
    }
  }

  // cp-21-asiri-ekstrapolasyon: temastan hemen sonra top birkaç kare içinde kadraj dışına
  // çıkarsa (ör. çok hızlı şut) gerçek veri penceresi (dataSpan = tEnd-contactT) çok kısa kalabilir
  // — ikinci derece eğriyi bu kısa pencereden SABİT extendSec (varsayılan 0.5sn) kadar ileri
  // ekstrapole etmek, veri penceresinin 5-10 katı bir süreye uzanabiliyor; hata τ² ile büyüdüğü
  // için bu, nişangahı gerçek topun onlarca piksel gerisinde/ilerisinde bırakabiliyor (bkz. bug
  // raporu: t=6.30/6.40'ta ~40-50px sapma). Güvenli ekstrapolasyon süresini veri penceresiyle
  // orantılı tutuyoruz: en fazla o kadar (dataSpan), ama en az MIN_EXTEND_SEC (tek/az noktalı kısa
  // pencerede bile bir miktar akıcılık kalsın), en çok da MAX_EXTEND_SEC (iyi desteklenen eğride
  // eski davranışla aynı). flightTrail/flightPath/display.js#pickDisplayBall bunu extendSec
  // TAVANI olarak kullanır (Math.min(istenen, fit.maxExtendSec)).
  const dataSpan = tEnd - contactT;
  const maxExtendSec = Math.min(MAX_EXTEND_SEC, Math.max(MIN_EXTEND_SEC, dataSpan));

  return {
    coef: { x0: fx[0], vx: fx[1], ax: fx[2], y0: fy[0], vy: fy[1], ay: fy[2] },
    contactT,
    tEnd,
    maxExtendSec,
    // w (top genişliği): outcome.js topun kameradan uzaklaşıp uzaklaşmadığını buradan anlar.
    inliers: idxs.map((i) => ({ t: pts[i].t, x: pts[i].x, y: pts[i].y, w: pts[i].w })),
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
 * çıktıysa (tNow, fit.tEnd'i aştıysa) en fazla extendSec kadar ileri ekstrapole edilir —
 * ama hiçbir zaman fit.maxExtendSec'i aşmaz (cp-21: az veriyle desteklenen kısa bir eğriyi
 * uzun süre ekstrapole etmek büyük sapmaya yol açabiliyor, bkz. fitFlight#maxExtendSec).
 */
export function flightTrail(fit, tNow, { extendSec = 0.5, tailSec = 0.35, samples = 24 } = {}) {
  if (!fit || tNow <= fit.contactT) return [];
  const safeExtendSec = Math.min(extendSec, fit.maxExtendSec ?? extendSec);
  const end = Math.min(tNow, fit.tEnd + safeExtendSec);
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
 *
 * opts.contactAnchor verilirse (cp-20-sabit-top): temas ÖNCESİ sahnede duran, temas topunun
 * KENDİSİ olmayan top kümeleri (findStationaryDecoys) bulunur; temas SONRASI adaylardan bu
 * kümelere ~1 top çapı yakın olanlar RANSAC'a hiç girmeden elenir. opts.lookbackSec bu kümeleri
 * ne kadar geriye bakarak arayacağını belirler (varsayılan STATIONARY_LOOKBACK_SEC).
 */
export function collectCandidates(frames, contact, maxSec = 1.5, opts = {}) {
  const out = [];
  if (!Array.isArray(frames) || contact == null || contact < 0 || contact >= frames.length) return out;
  const t0 = frames[contact]?.t ?? 0;
  const decoys = opts.contactAnchor
    ? findStationaryDecoys(frames, contact, opts.contactAnchor, opts.lookbackSec ?? STATIONARY_LOOKBACK_SEC)
    : [];
  for (let i = contact; i < frames.length; i++) {
    const f = frames[i];
    if (!f) continue;
    if (f.t - t0 > maxSec) break;
    for (const b of f.balls || []) {
      const nearDecoy = decoys.some((d) => Math.hypot(d.x - b.x, d.y - b.y) < Math.max(d.w || DEFAULT_BALL_WIDTH, b.w || DEFAULT_BALL_WIDTH));
      if (nearDecoy) continue;
      out.push({ t: f.t, x: b.x, y: b.y, w: b.w });
    }
  }
  return out;
}
