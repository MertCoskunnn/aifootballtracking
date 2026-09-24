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

const I_NOSE = 0, I_HEEL = { left: 29, right: 30 }, I_TOE = { left: 31, right: 32 };
const unit = (a) => { const l = len(a) || 1; return { x: a.x / l, y: a.y / l, z: a.z / l }; };
const flat = (a) => ({ x: a.x, y: 0, z: a.z });
const scale = (a, k) => ({ x: a.x * k, y: a.y * k, z: a.z * k });
const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
const asinDeg = (v) => deg(Math.asin(Math.max(-1, Math.min(1, v))));

/**
 * Tek bir 3D iskeletten temas anı postürü. w: 33 elemanlı {x,y,z} (MediaPipe world, y aşağı).
 * kickSide: 'left' | 'right' (vuran ayak). Dönen (derece):
 *   supportKnee: destek dizi bükülmesi (0 = düz)
 *   kickKnee:    vuran diz bükülmesi
 *   kickHip:     vuran uyluğun gövde çizgisine göre açısı; + = önde, − = geride (kurma)
 *   trunkLean:   gövdenin öne eğimi; + = öne, − = geriye yaslanma
 *   trunkSide:   gövdenin yana yatışı; + = destek ayağı tarafına, − = vuran tarafa
 *   armOpen:     destek tarafı kolunun gövdeden açılması (omuz açısı)
 * Eksenler vücuttan kurulur (yan: kalçalar, ön: burun + destek ayağının ucu), böylece kamera
 * yönünden ve aynalamadan bağımsızdır. Dikey eksen kameranın dikeyi: telefon eğik tutulursa gövde
 * açıları o kadar kayar (v1 kuralı: telefon düz ve sabit).
 */
export function posture3d(w, kickSide) {
  if (!w || w.length !== 33) return null;
  const sup = other(kickSide);
  const flex = (s) => 180 - angle3(w[I.hip[s]], w[I.knee[s]], w[I.ankle[s]]);
  const hipC = mid(w[I.hip.left], w[I.hip.right]);
  const shC = mid(w[I.shoulder.left], w[I.shoulder.right]);
  const t = unit(sub(shC, hipC)); // gövde ekseni, kalçadan omuza
  const lat = unit(flat(sub(w[I.hip[sup]], w[I.hip[kickSide]]))); // vuran → destek tarafı, yatay
  // Ön eksen: yatayda yan eksene dik; işareti yüzün ve destek ayağının baktığı yöne göre seçilir.
  let fwd = unit({ x: lat.z, y: 0, z: -lat.x });
  const look = add(flat(sub(w[I_NOSE], shC)), flat(sub(w[I_TOE[sup]], w[I_HEEL[sup]])));
  if (dot(look, fwd) < 0) fwd = scale(fwd, -1);
  // Kalça: uyluğun, gövde ekseninin aşağı uzantısına göre ön-arka açısı (gövdeye dik ön eksende).
  const fwdT = unit(sub(fwd, scale(t, dot(fwd, t))));
  const thigh = sub(w[I.knee[kickSide]], w[I.hip[kickSide]]);
  return {
    supportKnee: flex(sup),
    kickKnee: flex(kickSide),
    kickHip: deg(Math.atan2(dot(thigh, fwdT), -dot(thigh, t))),
    trunkLean: asinDeg(dot(t, fwd)),
    trunkSide: asinDeg(dot(t, lat)),
    armOpen: angle3(w[I.hip[sup]], w[I.shoulder[sup]], w[I.elbow[sup]]),
  };
}

export const POSTURE_KEYS = ['supportKnee', 'kickKnee', 'kickHip', 'trunkLean', 'trunkSide', 'armOpen'];

/**
 * Temas civarındaki karelerin (track[contact-half..contact+half]) medyanı: tek karedeki 3D tahmin
 * gürültüsünü azaltır. 2026-09-25 Messi ölçümü: arka arkaya karelerde destek dizi 23°, 50°, 14°
 * okunabiliyor, bu yüzden pencere ±2 kare (30 fps'te ~0.13 sn).
 * Tekrar eden kare atılır: 25 fps video 30 fps örneklenince bazı kareler iki kez gelir, aynı
 * tahmini iki kez saymak medyanı o kareye çeker.
 * track: kare başına iskelet (world özelliği olabilir). Dönen: postür ya da null.
 */
export function contactPosture(track, contact, kickSide, half = 2) {
  const reads = [];
  let prev = null;
  for (let i = contact - half; i <= contact + half; i++) {
    const w = track?.[i]?.world;
    if (w && prev && w.every((q, j) => q.x === prev[j].x && q.y === prev[j].y && q.z === prev[j].z)) continue;
    const p = posture3d(w, kickSide);
    if (p) { reads.push(p); prev = w; }
  }
  if (!reads.length) return null;
  const out = {};
  for (const k of POSTURE_KEYS) {
    const v = reads.map((r) => r[k]).filter(Number.isFinite).sort((x, y) => x - y);
    const m = v.length >> 1;
    out[k] = !v.length ? NaN : v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }
  return out;
}

export const POSTURE_LABEL = {
  supportKnee: 'Destek dizi', kickKnee: 'Vuran diz', kickHip: 'Vuran bacağın kalçası',
  trunkLean: 'Gövdenin eğimi', trunkSide: 'Gövdenin yana yatışı', armOpen: 'Karşı kol',
};
// Ölçüm gürültüsü bandı (derece): bu kadar fark ceza almaz. Kaynak: Messi'nin aynı videodaki iki
// frikiği (aynı oyuncu, aynı teknik) arasındaki fark: destek dizi 14°, kol 15°, gövde eğimi 6°,
// yana yatış 5°, vuran diz 2°, kalça 1° (METRICS.md "3D referans"). Bandın yarısı ile tamamı arası
// seçildi; vuran diz/kalça için tek videonun ±2 kare oynaması (~8°) esas alındı.
export const POSTURE_DEAD = { supportKnee: 10, kickKnee: 8, kickHip: 8, trunkLean: 5, trunkSide: 5, armOpen: 15 };
// [T] Bandın dışında bu kadar derece daha fark = 0 puan (doğrusal). Mert'in videolarıyla ayarlanacak.
export const POSTURE_TOL = { supportKnee: 20, kickKnee: 30, kickHip: 25, trunkLean: 15, trunkSide: 15, armOpen: 35 };
const WEIGHT = { supportKnee: 3, kickKnee: 1, kickHip: 2, trunkLean: 3, trunkSide: 2, armOpen: 1 };

// Farkı hoca diline çeviren cümle: değer referansa göre büyük/küçükse ne demek?
const PHRASE = {
  supportKnee: ['destek dizin daha düz, kilitli basıyorsun', 'destek dizin daha fazla bükülmüş'],
  kickKnee: ['vuran dizin temasta daha açık', 'vuran dizin temasta daha bükük'],
  kickHip: ['vuran bacağın uyluğu daha geride', 'vuran bacağın uyluğu daha önde'],
  trunkLean: ['gövden daha geride (daha dik ya da geriye yaslanmış)', 'gövden daha fazla öne eğik'],
  trunkSide: ['gövden vuran ayağın tarafına daha fazla yatık', 'gövden destek ayağının tarafına daha fazla yatık'],
  armOpen: ['karşı kolun daha kapalı', 'karşı kolun daha açık'],
};

// Farkı kapatmak için ne yapmalı: [değer referanstan küçükse, büyükse].
const ADVICE = {
  supportKnee: ['Destek dizini biraz daha bük, yaylı bas.', 'Destek bacağını daha sağlam tut, bu kadar çökme.'],
  kickKnee: ['Temasta vuran dizini bu kadar erken açma, bacağı kamçı gibi geç aç.', 'Temasa kadar dizini daha fazla aç, topa bükük bacakla değme.'],
  kickHip: ['Temasta uyluğun geride kalıyor: dizini topa doğru daha fazla öne getir.', 'Temasta uyluğun çok önde: topa bacağı arkadan savurarak gel, dizini erken kaldırma.'],
  trunkLean: ['Geriye yaslanma, gövdeni topun üstüne biraz öne getir.', 'Gövdeni bu kadar öne kapatma, daha dik kal.'],
  trunkSide: ['Gövdeni vuran ayağının tarafına bu kadar yatırma, destek ayağının üstünde kal.', 'Gövdeni destek tarafına bu kadar yatırma, dengen kayıyor.'],
  armOpen: ['Karşı kolunu yana daha fazla aç, denge ondan gelir.', 'Karşı kolunu bu kadar açma.'],
};

/**
 * Aynalama (Mert'in kararı, 2026-09-25): referans Messi'nin SOL ayakla sağ doksana vuruşu. Sağ
 * ayaklının sol doksana vuruşu bunun ayna görüntüsüdür. Postür ölçüleri vuran/destek tarafına göre
 * tanımlı (sağ/sol değil) olduğu için aynalama ölçüde kendiliğinden olur: sağ ayaklının destek dizi
 * Messi'nin destek diziyle, vuran dizi Messi'nin vuran diziyle kıyaslanır.
 * ref: referans/messi-plase.json içeriği. foot: kullanıcının vuran ayağı.
 * Dönen: { posture, mirrored, target } — target: hedeflenen doksan ('sağ' | 'sol').
 */
export function referenceFor(ref, foot) {
  if (!ref?.posture) return null;
  return { posture: ref.posture, mirrored: foot !== ref.foot, target: foot === 'left' ? 'sağ' : 'sol' };
}

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
    const over = Math.max(0, Math.abs(diff) - POSTURE_DEAD[k]);
    const score = Math.max(0, Math.round(100 * (1 - over / POSTURE_TOL[k])));
    const cumle = over === 0 ? `${POSTURE_LABEL[k]}: ${refName} ile aynı.`
      : `${refName}'ye göre ${PHRASE[k][diff < 0 ? 0 : 1]} (${Math.round(Math.abs(diff))}° fark).`;
    const tip = over === 0 ? null : ADVICE[k][diff < 0 ? 0 : 1];
    items.push({ key: k, label: POSTURE_LABEL[k], value: p[k], ref: ref[k], diff, score, weight: WEIGHT[k], cumle, tip });
  }
  if (!items.length) return { total: null, items };
  const wsum = items.reduce((a, i) => a + i.weight, 0);
  const total = Math.round(items.reduce((a, i) => a + i.score * i.weight, 0) / wsum);
  items.sort((a, b) => (100 - b.score) * b.weight - (100 - a.score) * a.weight);
  return { total, items };
}
