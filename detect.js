// Otomatik algılama katmanı: ham videodan "ne oldu?" sorusunu cevaplar.
// Vuruş nerede, temas hangi kare, hangi ayakla, kamera hangi açıdan bakıyor?
// Saf fonksiyonlar: DOM'a ve MediaPipe'a bağlı değil, Node ile test edilir.
//
// Girdi biçimi (kare başına):
//   { t: saniye, people: [ [ {x,y,v} x33 ], ... ], balls: [ {x,y,w,s}, ... ] }
//   x,y piksel. w: topun kutu genişliği (piksel), s: tespit güveni (0-1).
//
// Eşikler 2026-09-23'te Mert'in iki gerçek saha videosundan çıkarıldı:
//   - Duran top: kareler arası kayma < 0.05 top çapı. Vuruşta top 1-2 karede 5+ çap
//     yer değiştirip küçülerek (44→20 px) kadrajdan çıkıyor.
//   - Sürülen top: vuruştan önce kare başına ~0.3 çap yuvarlanıyor, vuruşla kayboluyor.
//   - Vuran ayak temastan hemen önce ~12-25 bacak boyu/sn hızla geliyor, destek ayağı 1-5.

const FEET = { left: [27, 31], right: [28, 32] }; // ayak bileği, ayak ucu
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Top izi: her karede tek bir top seçer. Bir önceki topa en yakın tespit tercih edilir,
 * böylece çimdeki beyaz bir leke ya da ikinci bir top izi zıplatmaz.
 * Dönen: kare başına {x,y,w,s} ya da null.
 */
export function trackBall(frames, minScore = 0.3) {
  let last = null;
  return frames.map((f) => {
    const cands = (f.balls || []).filter((b) => b.w > 0);
    if (!cands.length) return null;
    if (last) {
      const near = cands.reduce((a, c) => (dist(c, last) < dist(a, last) ? c : a));
      // Top 1 karede 8 çaptan fazla sıçramaz. Daha fazlaysa başka bir nesnedir,
      // ama düşük güvenle uçan topu da kaçırmamak için sadece yakınsa kabul ederiz.
      if (dist(near, last) < 8 * last.w) { last = near; return near; }
    }
    const best = cands.reduce((a, c) => (c.s > a.s ? c : a));
    if (best.s < minScore) return null;
    last = best;
    return best;
  });
}

// Bir kişinin bir ayağının (bilek veya uç, hangisi yakınsa) bir noktaya uzaklığı
const footDist = (p, side, pt) => Math.min(...FEET[side].map((i) => dist(p[i], pt)));

/**
 * Vuruşları bulur. İki gerçek videodan çıkan ders: top vuruştan önce bazen durağan
 * (duran top), bazen yuvarlanıyor (oyuncu önüne sürüp vuruyor). Bu yüzden "önce top dursun"
 * şartı yok. Vuruşun imzası şu:
 *   1) Bir ayak topa değecek kadar yakın (≤ nearFoot top çapı) ve o an HIZLI hareket ediyor
 *      (kamçı gibi gelen vuran ayak; yanında duran destek ayağı yavaştır).
 *   2) Hemen sonra top ya belirgin hızlanıyor ya da görüntüden kayboluyor (uçup gitti).
 * Temas karesi: bu koşulların sağlandığı karelerden ayağın topa en yakın olduğu kare.
 * fps: saniyedeki kare. Dönen: [{ contact, foot, person, rest, onset, flight }]
 *   rest: temas anındaki top konumu {x,y,w} (ölçümlerde "top" olarak kullanılır)
 */
export function findKicks(frames, fps, opts = {}) {
  // minFootSpeed 8: destek ayağı topun yanına inerken bile ~5 bacak boyu/sn hızla gelir,
  // vuran ayak ise 12-25. Eşik ikisinin arasında olmalı ki destek ayağı "vuran" sanılmasın.
  const { nearFoot = 1.6, minFootSpeed = 8, minGap = 0.8 } = opts;
  const ball = fillGaps(trackBall(frames), Math.round(0.2 * fps));
  const speed = footSpeeds(frames, fps); // [kare][kişi] → {left, right} bacak boyu / sn
  const kicks = [];
  let i = 1;
  while (i < frames.length - 1) {
    const b = ball[i] || ball[i - 1];
    if (!b) { i++; continue; }
    // 1) Topa yakın ve hızlı bir ayak var mı?
    let hit = null;
    (frames[i].people || []).forEach((p, person) => {
      for (const side of ['left', 'right']) {
        const d = footDist(p, side, b) / b.w;
        const v = speed[i]?.[person]?.[side] ?? 0;
        // Topa yakın ayaklardan en hızlısı: yavaş olan destek ayağıdır
        if (d <= nearFoot && v >= minFootSpeed && (!hit || v > hit.v)) hit = { frame: i, person, side, d, v };
      }
    });
    if (!hit) { i++; continue; }
    // 2) Top sonrasında hızlanıyor ya da kayboluyor mu?
    const onset = ballLeaves(ball, i, b);
    if (onset < 0) { i++; continue; }
    // Temas: [i, onset) arasında ayağın topa en yakın olduğu kare. onset'in kendisi hariç:
    // top o karede zaten hareket etmiş, ayak topun eski yerinden geçip gidiyor olabilir.
    let best = hit;
    for (let k = i + 1; k < onset && k < frames.length; k++) {
      const p = frames[k].people?.[hit.person];
      if (!p) continue;
      const d = footDist(p, hit.side, b) / b.w;
      if (d < best.d) best = { ...hit, frame: k, d };
    }
    const foot = kickingFoot(frames, best.frame, best.person, b, fps);
    kicks.push({ contact: best.frame, foot, person: best.person, rest: { x: b.x, y: b.y, w: b.w }, onset, flight: flightOf(ball, onset, b) });
    i = onset + Math.round(minGap * fps); // aynı vuruşu iki kez sayma
  }
  return kicks;
}

// Kısa tespit boşluklarını (≤ maxGap kare) iki uç arasında doğrusal doldurur.
// Uzun boşluklar dolmaz: top gerçekten gitmiş olabilir.
export function fillGaps(ball, maxGap) {
  const out = ball.slice();
  let last = -1;
  for (let i = 0; i < out.length; i++) {
    if (!out[i]) continue;
    const gap = i - last - 1;
    if (last >= 0 && gap > 0 && gap <= maxGap) {
      for (let k = 1; k <= gap; k++) {
        const t = k / (gap + 1), a = out[last], b = out[i];
        out[last + k] = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, s: 0, filled: true };
      }
    }
    last = i;
  }
  return out;
}

// Her karede her kişinin iki ayağının hızı (bacak boyu / saniye). Bacak boyuna bölmek,
// kameraya yakın ya da uzak oyuncuyu aynı ölçekte değerlendirmemizi sağlar.
function footSpeeds(frames, fps) {
  return frames.map((f, i) => (f.people || []).map((p) => {
    const prev = frames[i - 1]?.people?.reduce((a, q) => (dist(q[23], p[23]) < dist(a[23], p[23]) ? q : a), frames[i - 1].people[0]);
    if (!prev) return { left: 0, right: 0 };
    const leg = (dist(p[23], p[27]) + dist(p[24], p[28])) / 2 || 1;
    return {
      left: (dist(p[27], prev[27]) / leg) * fps,
      right: (dist(p[28], prev[28]) / leg) * fps,
    };
  }));
}

// Top i'den sonraki birkaç karede ayrılıyor mu? Ayrıldığı ilk kareyi döner, yoksa -1.
// Ayrılmak: top 2+ kare boyunca görünmüyor, ya da kare başına 0.6 çaptan hızlı ve öncesinden 2 kat hızlı.
function ballLeaves(ball, i, b) {
  const before = speedAt(ball, i);
  for (let k = i + 1; k <= i + 5 && k < ball.length; k++) {
    if (!ball[k] && !ball[k + 1]) return k;
    const s = speedAt(ball, k);
    if (s > 0.6 && s > 2 * before) return k;
  }
  return -1;
}
const speedAt = (ball, k) => (ball[k] && ball[k - 1] ? dist(ball[k], ball[k - 1]) / ball[k].w : 0);

// Vuran ayak: temastan önceki ~0.2 sn'de ayak bileğinin topa doğru kat ettiği yol daha uzun olan
function kickingFoot(frames, contact, person, rest, fps) {
  const back = Math.max(0, contact - Math.max(2, Math.round(0.2 * fps)));
  const p0 = frames[back]?.people?.[person], p1 = frames[contact]?.people?.[person];
  if (!p0 || !p1) return closestSide(p1, rest);
  const approach = (side) => footDist(p0, side, rest) - footDist(p1, side, rest); // topa ne kadar yaklaştı
  const l = approach('left'), r = approach('right');
  if (Math.abs(l - r) < 0.3 * rest.w) return closestSide(p1, rest);
  return l > r ? 'left' : 'right';
}
const closestSide = (p, pt) => (p && footDist(p, 'left', pt) < footDist(p, 'right', pt) ? 'left' : 'right');

// Temastan sonra topun uçuşu: ilk görünen birkaç karedeki yer değiştirme ve boyut oranı
function flightOf(ball, onset, rest) {
  const pts = [];
  for (let k = onset; k < Math.min(ball.length, onset + 8); k++) if (ball[k] && !ball[k].filled && dist(ball[k], rest) > 0.8 * rest.w) pts.push({ k: k - onset, ...ball[k] });
  if (!pts.length) return { seen: 0 };
  const last = pts[pts.length - 1];
  return {
    seen: pts.length,
    dx: (last.x - rest.x) / rest.w, // çap cinsinden yatay yol
    dy: (last.y - rest.y) / rest.w, // çap cinsinden dikey yol (- = yukarı)
    scale: last.w / rest.w, // < 1: top küçülüyor = kameradan uzaklaşıyor
    frames: last.k + 1,
  };
}

/**
 * Kamera açısı: 'side' (yandan) | 'behind' (arkadan) | 'front' (önden) | 'unknown'
 *
 * Önemli ders (Mert'in videosu, 2026-09-23): ölçüm için önemli olan VÜCUDUN göründüğü açı,
 * topun gittiği yön değil. Çapraz bir şutta oyuncu ekranda yatay koşar (vücut yandan görünür),
 * ama top kameradan uzaklaşarak gider. İlk sürüm topa baktığı için bunu yanlışlıkla "arkadan" saydı.
 *
 * Birincil kanıt: temastan önceki ~0.7 sn'de oyuncunun koşusu.
 *   - Kalça ekranda bacak boyunun yarısından fazla yatay ilerlediyse ve boyu pek değişmediyse → yandan
 *   - Oyuncu belirgin küçüldüyse (kameradan uzaklaşıyor) → arkadan, büyüdüyse → önden
 * Yedek kanıt (koşu belirsizse): topun uçuşu (küçülerek uzaklaştı → arkadan, vb.)
 * Dönen: { view, confidence (0-1), reason, shot } (shot: topun uçuşunun kısa açıklaması)
 */
export function classifyView(frames, kick, fps) {
  const shot = describeFlight(kick.flight);
  const n = Math.max(3, Math.round(0.7 * fps));
  const a = frames[kick.contact - n]?.people?.[kick.person], b = frames[kick.contact]?.people?.[kick.person];
  if (a && b) {
    const leg = (p) => (dist(p[23], p[27]) + dist(p[24], p[28])) / 2;
    const hip = (p) => ({ x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 });
    const across = Math.abs(hip(b).x - hip(a).x) / Math.max(leg(a), leg(b));
    const grow = leg(b) / leg(a);
    if (across > 0.5 && grow > 0.75 && grow < 1.33) {
      return { view: 'side', confidence: Math.min(1, across / 1.5), reason: `oyuncu ekranda yatay koştu (${across.toFixed(1)} bacak boyu)`, shot };
    }
    if (grow <= 0.75) return { view: 'behind', confidence: Math.min(1, (1 - grow) * 2), reason: 'oyuncu kameradan uzaklaşarak koştu', shot };
    if (grow >= 1.33) return { view: 'front', confidence: Math.min(1, (grow - 1) * 2), reason: 'oyuncu kameraya doğru koştu', shot };
  }
  const fl = kick.flight;
  if (fl && fl.seen >= 1) {
    const depth = -Math.log(Math.max(0.05, fl.scale)); // + = uzaklaşıyor
    if (depth > 0.25) return { view: 'behind', confidence: 0.4, reason: 'koşu belirsiz, top küçülerek uzaklaştı', shot };
    if (depth < -0.25) return { view: 'front', confidence: 0.4, reason: 'koşu belirsiz, top büyüyerek yaklaştı', shot };
    if (Math.abs(fl.dx) / Math.max(1, fl.frames) > 0.8) return { view: 'side', confidence: 0.4, reason: 'koşu belirsiz, top yatay gitti', shot };
  }
  return { view: 'unknown', confidence: 0, reason: 'yeterli kanıt yok', shot };
}

function describeFlight(fl) {
  if (!fl || !fl.seen) return 'top temastan hemen sonra görüntüden çıktı';
  const away = fl.scale < 0.8, toward = fl.scale > 1.25, up = fl.dy < -1;
  return [away ? 'kameradan uzaklaştı' : toward ? 'kameraya yaklaştı' : 'yatay gitti', up ? 'havalandı' : 'alçak gitti'].join(', ');
}

/**
 * Açıya göre mod önerisi. Yandan çekimde şut/pas kuralları (ön-arka düzlem) ölçülebilir,
 * arkadan çekimde frikik kuralları (yanal düzlem) ölçülebilir. Önden çekim henüz desteklenmiyor.
 */
export function suggestMode(view) {
  if (view === 'side') return { mode: 'shot', note: 'Yandan çekim: şut ya da pas analizi yapılabilir.' };
  if (view === 'behind') return { mode: 'freekick', note: 'Arkadan çekim: frikik/falso analizi yapılabilir. Yandan ölçülen şut kuralları bu açıda güvenilir değil.' };
  if (view === 'front') return { mode: null, note: 'Önden çekim henüz desteklenmiyor. Yandan ya da arkadan çek.' };
  return { mode: null, note: 'Kamera açısı anlaşılamadı. Modu kendin seç.' };
}
