// metrics3d.js — Temas anı postürü, 3D açılarla (2026-09-24 gece, Mert'in kararı).
// Mert: "Bacak 45-60° bükülecekse yandan da arkadan da aynıdır, sadece ölçüm türü farklı."
// Doğru: gerçek eklem açısı kameradan bağımsızdır; 2D görüntüdeki izdüşümü değildir (arkadan
// bakınca dizin bükülmesi kameraya doğru olduğu için "kısalır"). Bu yüzden açılar MediaPipe'ın 3D
// (world) noktalarından hesaplanır: kalça merkezli, metre, y aşağı. Tek kameradan 3D bir TAHMİN,
// kusursuz değil; ama 2D izdüşüm çarpıtmasını büyük ölçüde kaldırır.
//
// Kapsam (Mert): şimdilik sadece plase; koşu/yaklaşma önemsiz, sadece VURUŞ ANINDAKİ postür.
// Puan: Messi'nin temas anı postürüne yakınlık (referans kıyası), eşik uydurma yok.
// Saf modül, DOM yok, Node testli (tests/metrics3d.test.mjs).

const I = {
  shoulder: { left: 11, right: 12 }, elbow: { left: 13, right: 14 },
  hip: { left: 23, right: 24 }, knee: { left: 25, right: 26 }, ankle: { left: 27, right: 28 },
};
const other = (s) => (s === 'right' ? 'left' : 'right');
const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;
const len = (a) => Math.hypot(a.x, a.y, a.z);
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 });
const deg = (r) => (r * 180) / Math.PI;

/** b noktasındaki 3D iç açı (derece): a-b-c. */
export function angle3(a, b, c) {
  const u = sub(a, b), v = sub(c, b);
  const d = len(u) * len(v);
  return d > 0 ? deg(Math.acos(Math.max(-1, Math.min(1, dot(u, v) / d)))) : NaN;
}

/**
 * Tek bir 3D iskeletten temas anı postürü. w: 33 elemanlı {x,y,z} (MediaPipe world, y aşağı).
 * kickSide: 'left' | 'right' (vuran ayak). Dönen (derece):
 *   supportKnee: destek dizi bükülmesi (0 = düz)
 *   kickKnee:    vuran diz bükülmesi
 *   kickHip:     vuran bacağın kalça fleksiyonu (uyluğun gövdeye göre öne kalkışı)
 *   trunkLean:   gövdenin dikeyden toplam sapması
 *   trunkSide:   gövdenin yana yatışı; + = destek ayağı tarafına
 *   armOpen:     destek tarafı kolunun gövdeden açılması (omuz açısı)
 */
export function posture3d(w, kickSide) {
  if (!w || w.length !== 33) return null;
  const sup = other(kickSide);
  const flex = (s) => 180 - angle3(w[I.hip[s]], w[I.knee[s]], w[I.ankle[s]]);
  const hipC = mid(w[I.hip.left], w[I.hip.right]);
  const shC = mid(w[I.shoulder.left], w[I.shoulder.right]);
  const trunk = sub(shC, hipC);
  const up = { x: 0, y: -1, z: 0 }; // world y aşağı
  // Yan eksen: kalçanın vuran taraftan destek tarafına doğru yönü (dikey bileşeni atılır).
  let lat = sub(w[I.hip[sup]], w[I.hip[kickSide]]);
  lat = { x: lat.x, y: 0, z: lat.z };
  const latLen = len(lat) || 1;
  lat = { x: lat.x / latLen, y: 0, z: lat.z / latLen };
  const tLen = len(trunk) || 1;
  return {
    supportKnee: flex(sup),
    kickKnee: flex(kickSide),
    kickHip: 180 - angle3(w[I.shoulder[kickSide]], w[I.hip[kickSide]], w[I.knee[kickSide]]),
    trunkLean: deg(Math.acos(Math.max(-1, Math.min(1, dot(trunk, up) / tLen)))),
    trunkSide: deg(Math.asin(Math.max(-1, Math.min(1, dot(trunk, lat) / tLen)))),
    armOpen: angle3(w[I.hip[sup]], w[I.shoulder[sup]], w[I.elbow[sup]]),
  };
}

export const POSTURE_KEYS = ['supportKnee', 'kickKnee', 'kickHip', 'trunkLean', 'trunkSide', 'armOpen'];

/**
 * Temas civarındaki birkaç karenin (track[contact-1..contact+1]) medyanı: tek karedeki 3D tahmin
 * gürültüsünü azaltır. track: kare başına iskelet (world özelliği olabilir). Dönen: postür ya da null.
 */
export function contactPosture(track, contact, kickSide, half = 1) {
  const reads = [];
  for (let i = contact - half; i <= contact + half; i++) {
    const p = posture3d(track?.[i]?.world, kickSide);
    if (p) reads.push(p);
  }
  if (!reads.length) return null;
  const out = {};
  for (const k of POSTURE_KEYS) {
    const v = reads.map((r) => r[k]).filter(Number.isFinite).sort((a, b) => a - b);
    out[k] = v.length ? v[Math.floor(v.length / 2)] : NaN;
  }
  return out;
}

export const POSTURE_LABEL = {
  supportKnee: 'Destek dizi', kickKnee: 'Vuran diz', kickHip: 'Vuran bacağın kalçası',
  trunkLean: 'Gövdenin eğimi', trunkSide: 'Gövdenin yana yatışı', armOpen: 'Karşı kol',
};
// [T] Referanstan bu kadar derece fark = 0 puan (doğrusal). Gerçek videolarla ayarlanacak.
export const POSTURE_TOL = { supportKnee: 20, kickKnee: 30, kickHip: 25, trunkLean: 15, trunkSide: 15, armOpen: 35 };
const WEIGHT = { supportKnee: 3, kickKnee: 1, kickHip: 2, trunkLean: 3, trunkSide: 2, armOpen: 1 };

// Farkı hoca diline çeviren cümle: değer referansa göre büyük/küçükse ne demek?
const PHRASE = {
  supportKnee: ['destek dizin daha düz, kilitli basıyorsun', 'destek dizin daha fazla bükülmüş'],
  kickKnee: ['vuran dizin temasta daha açık', 'vuran dizin temasta daha bükük'],
  kickHip: ['vuran bacağın uyluğu daha geride', 'vuran bacağın uyluğu daha önde'],
  trunkLean: ['gövden daha dik', 'gövden daha fazla eğik'],
  trunkSide: ['gövden destek tarafına daha az yatıyor', 'gövden destek tarafına daha fazla yatıyor'],
  armOpen: ['karşı kolun daha kapalı', 'karşı kolun daha açık'],
};

/**
 * Kullanıcının temas postürünü referansla kıyaslar. Dönen:
 * { total (0-100) | null, items: [{key, label, value, ref, diff, score, cumle}], en buyuk farklar önce }
 */
export function compareToReference(p, ref, refName = 'Referans') {
  if (!p || !ref) return { total: null, items: [] };
  const items = [];
  for (const k of POSTURE_KEYS) {
    if (!Number.isFinite(p[k]) || !Number.isFinite(ref[k])) continue;
    const diff = p[k] - ref[k];
    const score = Math.max(0, Math.round(100 * (1 - Math.abs(diff) / POSTURE_TOL[k])));
    const cumle = Math.abs(diff) < 3 ? `${POSTURE_LABEL[k]}: ${refName} ile aynı.`
      : `${refName}'ye göre ${PHRASE[k][diff < 0 ? 0 : 1]} (${Math.round(Math.abs(diff))}° fark).`;
    items.push({ key: k, label: POSTURE_LABEL[k], value: p[k], ref: ref[k], diff, score, weight: WEIGHT[k], cumle });
  }
  if (!items.length) return { total: null, items };
  const wsum = items.reduce((a, i) => a + i.weight, 0);
  const total = Math.round(items.reduce((a, i) => a + i.score * i.weight, 0) / wsum);
  items.sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight);
  return { total, items };
}
