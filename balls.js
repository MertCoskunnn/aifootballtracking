// cp-17-top-birlesimi: aynı topun iki kez sayılmasını önleyen birleştirme (NMS). Saf fonksiyon:
// DOM'a/MediaPipe'a bağımlı değil, Node ile test edilir (tests/balls.test.mjs).
//
// Neden ayrı dosya: vision.js'in KENDİ dedupe() fonksiyonu zaten saf mantıktı ama vision.js
// dosyanın tepesinde CDN'den (MediaPipe) import yaptığı için Node bu dosyayı import edemiyordu —
// analysis.js/quality.js'in pipeline.js'ten ayrılma sebebiyle aynı desen (bkz. o dosyaların başı).
//
// Neden değişti (Mert'in raporu): tek toplu bir videoda bile ekranda 2 top çemberi görünüyordu.
// Top üç ayrı yoldan aranıyor (tam kare + her oyuncunun ayak çevresi kırpıntısı + son bilinen top
// konumu çevresi, bkz. vision.js processRange) ve HER kaynak kendi ölçek faktörüyle (k = kırpıntı
// boyu/CROP) tam kare koordinatına geri çevriliyor. Kırpıntı kenarına yakın toplarda model kutuyu
// gerçekte olduğundan küçük/kaymış tahmin edebiliyor; bu durumda ESKİ birleştirme
// (`0.5 * Math.max(o.w, b.w)` merkez mesafesi TEK BAŞINA) yanılıyordu: iki tespitten biri anormal
// küçük çıktığında (ör. kırpıntı kenarında kırpılmış top) `max(o.w,b.w)` küçük kalıyor, eşik
// daralıyor, gerçekte aynı topun birkaç piksel kaymış iki tespiti birleşmiyordu.
// Çözüm: merkez-mesafesine EK olarak IoU (kutuların örtüşme oranı) bakılıyor — iki kutu boyutça
// farklı olsa bile büyük ölçüde ÜST ÜSTE biniyorsa aynı top sayılır. İkisi de saf geometri,
// modele bağlı değil.

/**
 * İki top tespitinin ({x,y,w}: merkez + kare kutu kenarı) kesişim/birleşim oranı (Intersection
 * over Union). Kutular {x-w/2, y-w/2, x+w/2, y+w/2} kareler olarak varsayılır (vision.js'teki
 * box() sadece width üretiyor, top zaten görece kare bir nesne). Örtüşme yoksa 0.
 */
export function iou(a, b) {
  const ax0 = a.x - a.w / 2, ay0 = a.y - a.w / 2, ax1 = a.x + a.w / 2, ay1 = a.y + a.w / 2;
  const bx0 = b.x - b.w / 2, by0 = b.y - b.w / 2, bx1 = b.x + b.w / 2, by1 = b.y + b.w / 2;
  const ix0 = Math.max(ax0, bx0), iy0 = Math.max(ay0, by0);
  const ix1 = Math.min(ax1, bx1), iy1 = Math.min(ay1, by1);
  const iw = Math.max(0, ix1 - ix0), ih = Math.max(0, iy1 - iy0);
  const inter = iw * ih;
  if (inter <= 0) return 0;
  const union = a.w * a.w + b.w * b.w - inter;
  return union > 0 ? inter / union : 0;
}

// Varsayılan eşikler [T]: RESEARCH*.md'deki diğer eşikler gibi gerçek saha videolarıyla
// kalibre edilmemiştir, tarayıcıda (Messi/Mert klipleri) doğrulanmalı.
// IOU_THRESH: kutular bu oranın üzerinde örtüşüyorsa aynı top (boyut farkına duyarsız —
// tam olarak kalibre "kırpıntı kenarında küçülmüş tespit" durumunu yakalamak için var).
export const IOU_THRESH = 0.15; // [T]
// CENTER_DIST_RATIO: merkezler arası mesafe iki kutunun büyük olanının bu oranından yakınsa aynı
// top (eski dedupe'daki 0.5 ile aynı fikir, tek başına yeterli değildi — bkz. dosya başı not).
export const CENTER_DIST_RATIO = 0.5; // [T] (eski dedupe ile aynı değer, davranış regresyonu yok)

/**
 * İki tespit aynı topu mu temsil ediyor? IoU EŞİĞİ ya da merkez-mesafesi eşiği — İKİSİNDEN
 * HERHANGİ Bİ Rİ yeterli (OR): biri boyut farkına dayanıklı (IoU), diğeri klasik yakınlık testi.
 */
export function sameBall(a, b, opts = {}) {
  const { iouThresh = IOU_THRESH, centerDistRatio = CENTER_DIST_RATIO } = opts;
  if (iou(a, b) >= iouThresh) return true;
  const dist = Math.hypot(a.x - b.x, a.y - b.y);
  return dist < centerDistRatio * Math.max(a.w, b.w);
}

/**
 * Top tespit listesini birleştirir (NMS): en yüksek güvenden başlayarak, henüz bir grupla
 * eşleşmemiş her tespiti tutar, sameBall() ile eşleşen sonrakileri eler. Gerçekten ayrı iki top
 * (örtüşmeyen, uzak kutular) İKİ ayrı sonuç olarak kalır. dets: [{x,y,w,s}, ...] — girdi dizisi
 * DEĞİŞTİRİLMEZ (kopyası sıralanır).
 * Dönen: [{x,y,w,s}, ...] — vision.js'teki eski dedupe() ile aynı biçim/anlam, sadece eşleştirme
 * mantığı IoU ile güçlendirildi.
 */
export function mergeBallDetections(dets, opts = {}) {
  const out = [];
  for (const b of [...dets].sort((a, c) => c.s - a.s)) {
    if (!out.some((o) => sameBall(o, b, opts))) out.push(b);
  }
  return out;
}
