// Saf adaptör (cp-12-movenet): MoveNet Thunder'ın COCO-17 iskeletini vision.js'in geri kalanının
// beklediği MediaPipe-33 biçimine çevirir. DOM'a, TF.js'e ve MediaPipe'a bağlı DEĞİL — Node ile
// test edilir (bkz. tests/keypoints.test.mjs). Ağır (tensor, model) iş movenet.js'te; burada
// sadece sayı dönüşümü var.
//
// Neden gerekli? MoveNet 17 nokta üretir (COCO düzeni), ama detect.js/metrics.js/coach.js hepsi
// MediaPipe'ın 33 noktalı düzenine göre yazıldı (bkz. GECE-PLANI "veri sözleşmesi değişmez").
// MoveNet'te karşılığı olmayan noktalar (göz/kulak detayları, parmaklar, topuk/ayak ucu) o kişi
// için gerçekten ölçülmüş değil: en yakın bilinen noktanın kopyasını koyup görünürlüğü (v) 0
// yaparız ki metrics.js bu noktaları "görünmüyor" sayıp NaN'a düşsün, yanlış ölçüm üretmesin.

// MoveNet'in ham skorunu MediaPipe'ın 0-1 görünürlük (visibility) ölçeğine çeviren katsayı.
// Şimdilik 1 (birebir): gerçek videoyla ölçüm eşikleri kalibre edilince ayarlanacak.
export const MN_VIS_SCALE = 1;

// Kabul eşiği: kalça+diz+bilek (6 nokta) skor ortalaması bunun altındaysa MoveNet sonucu atılır.
// Nesne modelinin bulduğu ama aslında insan olmayan (ya da bacakları kadraj dışı kalan) bir
// kutuda MoveNet çöp iskelet üretebilir; bacak güveni düşükse bu kutuyu hiç değerlendirmeyiz.
// 0.3 → 0.45 (2026-09-24): bulut kutularında 0.3 geçiliyordu.
export const MN_MIN_LEG_SCORE = 0.45;

// COCO-17 → MediaPipe-33: doğrudan karşılığı olan 17 nokta. [mediaPipeIndex, cocoIndex].
// (Kaynak: GECE-PLANI cp-12-movenet mimari kararı — COCO sırası: 0 burun, 1/2 göz, 3/4 kulak,
// 5/6 omuz, 7/8 dirsek, 9/10 bilek, 11/12 kalça, 13/14 diz, 15/16 ayak bileği.)
const MAPPED = [
  [0, 0], [2, 1], [5, 2], [7, 3], [8, 4], [11, 5], [12, 6], [13, 7], [14, 8],
  [15, 9], [16, 10], [23, 11], [24, 12], [25, 13], [26, 14], [27, 15], [28, 16],
];

// MoveNet'te karşılığı olmayan MediaPipe noktaları: en yakın bilinen noktanın KOPYASI, v=0
// (yüz detayları, parmaklar, topuk/ayak ucu — MoveNet bunları ayrı üretmiyor).
// [mediaPipeIndex, kopyalanan cocoIndex]
const COPIED = [
  [1, 1], [3, 1],       // sol göz iç/dış ← sol göz
  [4, 2], [6, 2],       // sağ göz iç/dış ← sağ göz
  [9, 0], [10, 0],      // ağız sol/sağ ← burun
  [17, 9], [19, 9], [21, 9], // sol serçe/işaret/başparmak ← sol bilek
  [18, 10], [20, 10], [22, 10], // sağ serçe/işaret/başparmak ← sağ bilek
  [29, 15], [31, 15],   // sol topuk/ayak ucu ← sol ayak bileği
  [30, 16], [32, 16],   // sağ topuk/ayak ucu ← sağ ayak bileği
];

// Bacak güveni: kalça(11,12) + diz(13,14) + ayak bileği(15,16), COCO indeksleriyle.
const LEG_INDEXES = [11, 12, 13, 14, 15, 16];

/**
 * Kalça+diz+bilek skorlarının ortalaması. coco: 17 elemanlı [{x,y,score}] (COCO-17 sırası,
 * kırpıntıya göre normalize 0-1 koordinatlar — movenet.js'in detect() çıktısı).
 */
export function legScore(coco) {
  const sum = LEG_INDEXES.reduce((s, i) => s + (coco[i]?.score ?? 0), 0);
  return sum / LEG_INDEXES.length;
}

/**
 * Anatomi kontrolü (bulut iskeleti hatası, 2026-09-24 sabahı): nesne modeli bulutu kişi sanınca
 * MoveNet gürültüden iskelet uydurabiliyor. Gerçek ayaktaki insanda (y aşağı doğru artar):
 * omuz < kalça < ayak bileği, ve bacak boyu gövdeye göre makul. Diz tek başına kalçanın
 * üstüne çıkabilir (kurma, takip), o yüzden diz sıralamaya katılmaz.
 */
export function plausibleAnatomy(coco) {
  const mid = (a, b) => (coco[a].y + coco[b].y) / 2;
  const shoulder = mid(5, 6), hip = mid(11, 12), ankle = Math.max(coco[15].y, coco[16].y);
  const torso = hip - shoulder, leg = ankle - hip;
  if (!(torso > 0.03) || !(leg > 0)) return false;
  const ratio = leg / torso; // insanda ~1.5-2; eğilme/koşu için geniş tolerans
  return ratio > 0.6 && ratio < 4;
}

/** MoveNet sonucu kabul edilsin mi? (bkz. MN_MIN_LEG_SCORE, plausibleAnatomy) */
export function acceptMoveNetPose(coco, minScore = MN_MIN_LEG_SCORE) {
  return legScore(coco) >= minScore && plausibleAnatomy(coco);
}

/**
 * COCO-17 (MoveNet çıktısı) → MediaPipe-33 iskeleti, kırpıntı koordinatından tam kare
 * koordinatına çevrilmiş olarak. x0,y0: kırpıntının tam karedeki sol-üst köşesi (piksel).
 * s: kırpıntının kenar uzunluğu (piksel). coco[i].{x,y} kırpıntıya göre normalize (0-1) —
 * vision.js'teki poseOne ile aynı dönüşüm: x = x0 + xn*s, y = y0 + yn*s.
 * Dönen: 33 elemanlı [{x,y,v}] dizisi (diğer iskeletlerle aynı biçim, vision.js `p.src` ekler).
 */
export function mapCocoToMediapipe(coco, x0, y0, s) {
  const mp = new Array(33);
  for (const [mpI, cI] of MAPPED) {
    const c = coco[cI];
    mp[mpI] = { x: x0 + c.x * s, y: y0 + c.y * s, v: Math.min(1, c.score * MN_VIS_SCALE) };
  }
  for (const [mpI, cI] of COPIED) {
    const c = coco[cI];
    mp[mpI] = { x: x0 + c.x * s, y: y0 + c.y * s, v: 0 };
  }
  return mp;
}
