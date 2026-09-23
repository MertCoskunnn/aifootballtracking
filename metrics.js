// Ölçüm katmanı ("cetvel"): iskelet noktalarından açı ve mesafe hesaplar.
// Saf fonksiyonlar, tarayıcıya ve MediaPipe'a bağımlı değil, test edilebilir.
// Koordinatlar piksel cinsinden, y aşağı doğru artar.

// MediaPipe Pose nokta numaraları
export const LM = {
  shoulder: { left: 11, right: 12 },
  wrist: { left: 15, right: 16 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
  toe: { left: 31, right: 32 },
};

const other = (side) => (side === 'right' ? 'left' : 'right');
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// b noktasındaki iç açı (derece): a-b-c
export function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// Diz bükülmesi: düz bacak = 0°, dik açı = 90°
const kneeFlexion = (p, side) =>
  180 - angleAt(p[LM.hip[side]], p[LM.knee[side]], p[LM.ankle[side]]);

// Bacak boyu (kalça → diz → ayak bileği), mesafeleri kişiden bağımsız yapmak için
const legLength = (p, side) =>
  dist(p[LM.hip[side]], p[LM.knee[side]]) + dist(p[LM.knee[side]], p[LM.ankle[side]]);

// Gövdenin dikeyle açısı. Pozitif = hareket yönüne (öne) eğik, negatif = geriye yaslanmış.
function trunkLean(p, dir) {
  const hip = mid(p[LM.hip.left], p[LM.hip.right]);
  const sh = mid(p[LM.shoulder.left], p[LM.shoulder.right]);
  const dx = (sh.x - hip.x) * dir;
  const up = hip.y - sh.y;
  return (Math.atan2(dx, up) * 180) / Math.PI;
}

// Hareket yönü: sağa +1, sola -1. Kalçanın temastan önceki kaymasına bakar.
// Kalça yeterince kaymadıysa topun oyuncuya göre konumuna bakar.
function direction(frames, contact, ball) {
  const back = Math.max(0, contact - 10);
  const hipNow = mid(frames[contact][LM.hip.left], frames[contact][LM.hip.right]);
  const hipThen = frames[back] ? mid(frames[back][LM.hip.left], frames[back][LM.hip.right]) : hipNow;
  const dx = hipNow.x - hipThen.x;
  if (Math.abs(dx) > 2) return Math.sign(dx);
  return Math.sign(ball.x - hipThen.x) || 1;
}

const hipOf = (p) => mid(p[LM.hip.left], p[LM.hip.right]);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// contact çevresindeki kareleri (iskeleti olanları) dilimler. measure() ve measureFreeKick() ortak kullanır.
const sliceFrames = (frames, from, to) =>
  frames.slice(Math.max(0, from), Math.min(frames.length, to + 1)).filter(Boolean);

/**
 * Oyuncuyu seç ve takip et. Kadrajda birden fazla kişi olabilir.
 * Temas karesinde ayağı topa en yakın kişi oyuncudur. Sonra ileri ve geri
 * her karede, bir önceki karedeki kalçasına en yakın kişiyi seçeriz.
 * frames: her kare için kişi listesi (her kişi 33 nokta). Dönen: kare başına tek iskelet ya da null.
 */
export function buildTrack(frames, contact, ball) {
  const pick = (people, fn) => people.reduce((best, p) => (best === null || fn(p) < fn(best) ? p : best), null);
  const track = new Array(frames.length).fill(null);
  const feet = (p) => Math.min(...[27, 28, 31, 32].map((i) => d2(p[i], ball)));
  const start = pick(frames[contact] || [], feet);
  if (!start) return track;
  track[contact] = start;
  for (const step of [-1, 1]) {
    let last = start;
    for (let i = contact + step; i >= 0 && i < frames.length; i += step) {
      const next = pick(frames[i] || [], (p) => d2(hipOf(p), hipOf(last)));
      // Kalça bir karede bacak boyundan fazla sıçradıysa bu başka biri, o kareyi boş bırak
      const leg = legLength(last, 'left');
      if (next && d2(hipOf(next), hipOf(last)) < leg * leg) { track[i] = next; last = next; }
    }
  }
  return track;
}

/**
 * frames: her kare için 33 noktalık dizi (piksel) ya da null (iskelet bulunamadı)
 * contact: temas karesinin indeksi
 * ball: temas karesinde topun merkezi {x, y}
 * side: vuran ayak 'right' | 'left'
 */
export function measure(frames, contact, ball, side) {
  const p = frames[contact];
  if (!p) throw new Error('Temas karesinde iskelet bulunamadı. Başka bir kare seç.');
  const sup = other(side);
  const dir = direction(frames, contact, ball);
  const leg = legLength(p, sup);

  // Temastan önceki ve sonraki pencereler (iskeleti olan kareler)
  const before = sliceFrames(frames, contact - 20, contact);
  const after = sliceFrames(frames, contact, contact + 15);

  // Kolun gövdeyle açısı (karşı kol: vuran ayağın karşısındaki kol, yani destek tarafı)
  const armOpen = angleAt(p[LM.wrist[sup]], p[LM.shoulder[sup]], p[LM.hip[sup]]);

  // Takip: temastan sonra vuran ayak bileği ne kadar yükseldi (bacak boyuna oranla)
  const ankleY0 = p[LM.ankle[side]].y;
  const minY = Math.min(...after.map((f) => f[LM.ankle[side]].y));
  const followRise = (ankleY0 - minY) / leg;

  return {
    dir,
    // Destek ayağının topa göre ön-arka konumu. + = topun önünde, - = gerisinde
    supportOffset: ((p[LM.ankle[sup]].x - ball.x) * dir) / leg,
    supportKnee: kneeFlexion(p, sup),
    trunk: trunkLean(p, dir),
    backswing: Math.max(...before.map((f) => kneeFlexion(f, side))),
    kickKnee: kneeFlexion(p, side),
    armOpen,
    followRise,
  };
}

/**
 * Frikik / falsolu vuruş ölçümü. RESEARCH.md bölüm 3, kurallar F1..F5.
 *
 * Kamera arkadan ya da çapraz arkadan varsayılır (oyuncu kameradan uzaklaşır/yaklaşır).
 * Bu açıda görüntünün x ekseni oyuncunun kendi sağ-sol ekseniyle örtüşür: yandan çekimdeki
 * gibi bir aynalanma YOK (arkadan bakınca sağ-sol, oyuncunun kendi sağ-solu ile aynı taraftadır).
 * Bu yüzden yön normalizasyonu `direction()` ile değil, doğrudan `side` parametresinden gelen
 * `mirror` ile yapılır: sağ ayaklı için +1, sol ayaklı için -1. Her ölçümün "+" işareti, ayak
 * hangisi olursa olsun aynı fiziksel anlama gelecek şekilde tasarlandı (bkz. her satırın yorumu).
 *
 * frames/contact/ball: measure() ile aynı biçim. side: vuran ayak 'right' | 'left'.
 */
export function measureFreeKick(frames, contact, ball, side) {
  const p = frames[contact];
  if (!p) throw new Error('Temas karesinde iskelet bulunamadı. Başka bir kare seç.');
  const sup = other(side);
  const mirror = side === 'right' ? 1 : -1;
  const leg = legLength(p, sup);

  const before = sliceFrames(frames, contact - 10, contact); // yaklaşma penceresi (F1, F4)
  const after = sliceFrames(frames, contact, contact + 15); // takip penceresi (F5)

  // F1 Yaklaşma açısı (proxy): kalça-orta noktasının ~10 kare önceki konumundan temasa kadarki
  // yer değiştirme yönü, görüntü dikeyinden kaç derece saptığı. Düz koşu (kameraya dik) ~0°,
  // diyagonal yaklaşım daha büyük |açı|. + = vuruş bacağı tarafından gelen diyagonal yaklaşım.
  const hipNow = hipOf(p);
  const hipThen = hipOf(before[0] || p);
  const approachDx = (hipNow.x - hipThen.x) * mirror;
  const approachDy = Math.abs(hipNow.y - hipThen.y) || 1; // 0'a bölmeyi önler
  const approachAngle = (Math.atan2(approachDx, approachDy) * 180) / Math.PI;

  // F2 Destek ayağının topa yanal mesafesi (bacak boyuna oranlı). Yandan çekimde ölçülemeyen bu
  // mesafe arkadan görünür. + = destek ayak, vuruş bacağının tersi (beklenen) tarafta ve topa göre dışta
  const supportLateral = ((ball.x - p[LM.ankle[sup]].x) * mirror) / leg;

  // F3 Gövdenin yana yatışı: omuz-orta / kalça-orta hattının dikeyle yatay sapması (derece).
  // trunkLean() ile aynı üçgen mantığı, ama koşu yönü yerine `mirror` ile işaretlenir.
  // + = gövde vuruş bacağı tarafına yatık (araştırma notu F3: yön mühendislik tahmini [T])
  const hip = hipOf(p);
  const sh = mid(p[LM.shoulder.left], p[LM.shoulder.right]);
  const trunkDx = (sh.x - hip.x) * mirror;
  const trunkUp = hip.y - sh.y;
  const trunkLateral = (Math.atan2(trunkDx, trunkUp) * 180) / Math.PI;

  // F4 Kurma: geri salınımda vuruş bacağının diz bükülme zirvesi (Ş4 ile aynı tanım)
  const backswing = Math.max(...before.map((f) => kneeFlexion(f, side)));

  // F5 Takibin çaprazlaması: temastan sonra vuruş ayak bileği, temas anındaki destek ayak
  // bileğini bacak boyuna oranla ne kadar geçti. + = beklenen yönde çapraz geçiş (sarma takip)
  const supAnkleX = p[LM.ankle[sup]].x;
  const crossing = Math.max(...after.map((f) => (mirror * (supAnkleX - f[LM.ankle[side]].x)) / leg));

  return { dir: mirror, approachAngle, supportLateral, trunkLateral, backswing, crossing };
}
