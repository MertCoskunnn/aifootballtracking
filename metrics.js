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
  const window = (from, to) =>
    frames.slice(Math.max(0, from), Math.min(frames.length, to + 1)).filter(Boolean);
  const before = window(contact - 20, contact);
  const after = window(contact, contact + 15);

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
