// cp-15-kalite-kapisi: Görüntü kalitesi kapıları — "sabit kameralı, net idman videosu" ürün
// kararının saf hesaplama kısmı (PRODUCT-PLAN.md'ye eklenecek). Maç/yayın görüntüsü (kamera
// kayıyor/zoom yapıyor) ve bulanık video iskelet/top/açı ölçümünde sapma yaratıyor; bu dosya
// modele değil basit piksel karşılaştırmasına dayanan iki hafif kapı sunar:
//   1) Kamera sabitliği: vuruş penceresinde arka planın (oyuncu/top kutuları HARİÇ) ne kadar
//      kaydığını ve kenar bölgelerin merkeze göre zıt yönde kayıp kaymadığını (zoom) ölçer.
//   2) Netlik: temas karesi civarında oyuncu kutusu içindeki Laplacian varyansını (keskinlik) ölçer.
// Saf fonksiyonlar: DOM'a, MediaPipe'a bağımlı değil (detect.js/context.js gibi), Node ile test
// edilir (tests/quality.test.mjs). Girdi her yerde düz gri tonlu piksel dizisi (Uint8Array/
// Uint8ClampedArray, tek kanal) + genişlik/yükseklik + piksel-uzayında kutular {x0,y0,x1,y1}.
//
// Eşikler ilk sürümde TAHMİN [T] — RESEARCH*.md'deki diğer eşikler gibi gerçek saha videolarıyla
// kalibre edilecek (bkz. o dosyalardaki "[T] Teknik tahmin" notu). Sayılar küçültülmüş
// (SHRINK_W×SHRINK_H) görüntü uzayında piksel cinsindendir.

// Karelerin küçültüldüğü boyut (piksel). Küçük tutulan sebep: kamera-kayması araması ±8 pikser
// için her aday kaymada tüm pikseller taranıyor (bkz. regionShift); tam çözünürlükte bu maliyetli
// olurdu. Netlik ölçümü de aynı küçültmeyi kullanır (tek tuval, bkz. vision.js entegrasyonu) —
// bu yüzden oyuncu kutusu bu boyutta bazen çok az piksele düşer; ilk sürümün bilinen kısıtı.
export const SHRINK_W = 64; // [T]
export const SHRINK_H = 36; // [T]

// Kayma arama yarıçapı (küçültülmüş görüntüde piksel). ±8: tarif edilen ürün kararıyla aynı.
export const SEARCH_RADIUS = 8; // [T]

// Vuruş penceresi: temas karesinin ±bu kadar saniyesi kamera-sabitliği için taranır.
export const CAMERA_WINDOW_SEC = 1; // [T]
// Pencereden en fazla bu kadar kare örneklenir (ardışık ÖRNEKLER arası kayma bakılır). Performans/
// gürültü dengesi: her kareyi ikişer ikişer karşılaştırmak yerine pencereye yayılmış birkaç örnek,
// sabit maliyetle hem toplam kaymayı hem ara sıçramaları yakalar.
export const CAMERA_SAMPLE_COUNT = 5; // [T]

// Bu değerden fazla piksel kayma "kamera hareketli" sayılır (küçültülmüş görüntüde piksel).
export const MAX_SHIFT_PX = 1.5; // [T]
// Kenar bölgenin merkeze göre bu değerden fazla zıt kayması "zoom yapıyor" sayılır (piksel).
export const MAX_ZOOM_PX = 1.5; // [T]

// Netlik: temas karesinin ±bu kadar karesi taranır (istenen ürün kararıyla aynı: "±3 karede").
export const BLUR_WINDOW_FRAMES = 3; // [T]
// Laplacian varyansı bu değerin altındaysa "bulanık" sayılır (küçültülmüş görüntüde, oyuncu
// kutusu içinde). Küçük SHRINK boyutu yüzünden mutlak ölçek gerçek çözünürlükten farklı; gerçek
// videolarla kalibre edilecek.
export const MIN_SHARPNESS = 25; // [T]

// --- Genel yardımcılar -------------------------------------------------------------------

/** RGBA piksel dizisini (ör. canvas ImageData.data) tek kanallı gri tonlamaya çevirir. */
export function rgbaToGray(rgba, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < out.length; i++, j += 4) {
    out[i] = (0.299 * rgba[j] + 0.587 * rgba[j + 1] + 0.114 * rgba[j + 2]) | 0;
  }
  return out;
}

const round2 = (v) => Math.round(v * 100) / 100;

// Noktanın herhangi bir kutunun içinde olup olmadığı (x0,y0 dahil; x1,y1 hariç)
const inAnyBox = (x, y, boxes) => boxes.some((b) => x >= b.x0 && x < b.x1 && y >= b.y0 && y < b.y1);

// --- Kamera sabitliği ---------------------------------------------------------------------

/**
 * İki gri kare arasında, verilen dikdörtgen bölgede (region) ve kutuların DIŞINDA (excludeBoxes:
 * oyuncu/top, hareket ettiği için kamera kaymasını yanıltır) en iyi eşleşen kaymayı arar.
 * ±searchRadius piksel aranır, metrik ortalama mutlak fark (MAD). Sabit bir arka planda en düşük
 * MAD'ı veren kayma gerçek kamera kaymasıdır (ör. aynı kare için 0,0).
 * Dönen: { dx, dy, diff } — diff karşılaştırılan piksel yoksa 0.
 */
export function regionShift(prevGray, currGray, w, h, region, excludeBoxes = [], searchRadius = SEARCH_RADIUS) {
  const x0 = Math.max(0, Math.floor(region.x0)), x1 = Math.min(w, Math.ceil(region.x1));
  const y0 = Math.max(0, Math.floor(region.y0)), y1 = Math.min(h, Math.ceil(region.y1));
  let bestDx = 0, bestDy = 0, bestDiff = Infinity;
  for (let dy = -searchRadius; dy <= searchRadius; dy++) {
    for (let dx = -searchRadius; dx <= searchRadius; dx++) {
      let sum = 0, n = 0;
      for (let y = y0; y < y1; y++) {
        const sy = y + dy;
        if (sy < 0 || sy >= h) continue;
        for (let x = x0; x < x1; x++) {
          if (inAnyBox(x, y, excludeBoxes)) continue;
          const sx = x + dx;
          if (sx < 0 || sx >= w) continue;
          sum += Math.abs(currGray[y * w + x] - prevGray[sy * w + sx]);
          n++;
        }
      }
      if (n === 0) continue;
      const diff = sum / n;
      if (diff < bestDiff) { bestDiff = diff; bestDx = dx; bestDy = dy; }
    }
  }
  return { dx: bestDx, dy: bestDy, diff: bestDiff === Infinity ? 0 : bestDiff };
}

/** Tam kare için en iyi eşleşen kayma (regionShift'in tüm görüntü üzerindeki kısayolu). */
export function frameShift(prevGray, currGray, w, h, excludeBoxes = [], searchRadius = SEARCH_RADIUS) {
  return regionShift(prevGray, currGray, w, h, { x0: 0, y0: 0, x1: w, y1: h }, excludeBoxes, searchRadius);
}

/**
 * Zoom belirtisi: görüntünün ORTA bölgesinin kayması ile KENAR bölgesinin (orta hariç geri kalan)
 * kayması arasındaki fark. Kamera sadece kayıyorsa (pan/tilt) merkez ve kenar aynı yönde birlikte
 * kayar, fark ~0. Kamera zoom yapıyorsa kenarlar merkeze göre zıt yönde (dışa/içe) kayar, fark büyür.
 * Dönen: { dx, dy } — merkez/kenar kayma vektörleri arasındaki mutlak fark.
 */
export function edgeCenterZoom(prevGray, currGray, w, h, excludeBoxes = [], searchRadius = SEARCH_RADIUS) {
  const center = { x0: w * 0.25, y0: h * 0.25, x1: w * 0.75, y1: h * 0.75 };
  const centerShift = regionShift(prevGray, currGray, w, h, center, excludeBoxes, searchRadius);
  const edgeShift = regionShift(prevGray, currGray, w, h, { x0: 0, y0: 0, x1: w, y1: h }, [...excludeBoxes, center], searchRadius);
  return { dx: Math.abs(edgeShift.dx - centerShift.dx), dy: Math.abs(edgeShift.dy - centerShift.dy) };
}

/**
 * Bir kare dizisinin (kronolojik sırayla) ardışık ÖRNEKLERİ arasındaki en kötü kaymayı/zoom'u
 * bulur ve eşiklerle karşılaştırır. grayFrames: [Uint8Array, ...] (hepsi aynı w×h).
 * Dönen: { ok, kayma: { px, zoom } } — px: görülen en büyük toplam kayma (öklid), zoom: en büyük
 * kenar/merkez zıt kayma. Tek kareden az veri gelirse (karşılaştıracak çift yok) ok:true, kayma:null.
 */
export function assessCameraStability(grayFrames, w, h, excludeBoxes = []) {
  if (grayFrames.length < 2) return { ok: true, kayma: null };
  let maxPx = 0, maxZoom = 0;
  for (let i = 1; i < grayFrames.length; i++) {
    const s = frameShift(grayFrames[i - 1], grayFrames[i], w, h, excludeBoxes);
    const z = edgeCenterZoom(grayFrames[i - 1], grayFrames[i], w, h, excludeBoxes);
    maxPx = Math.max(maxPx, Math.hypot(s.dx, s.dy));
    maxZoom = Math.max(maxZoom, Math.hypot(z.dx, z.dy));
  }
  const ok = maxPx <= MAX_SHIFT_PX && maxZoom <= MAX_ZOOM_PX;
  return { ok, kayma: { px: round2(maxPx), zoom: round2(maxZoom) } };
}

// --- Netlik (bulanıklık) -------------------------------------------------------------------

/**
 * Laplacian varyansı: klasik "keskinlik" ölçütü, bulanık görüntülerde düşük çıkar. box verilirse
 * (piksel uzayında {x0,y0,x1,y1}) sadece o bölge taranır (ör. oyuncu kutusu); verilmezse tüm kare.
 * Kenar pikselleri (komşu gerektirdiği için) 1 piksel içeriden başlar.
 */
export function laplacianVariance(gray, w, h, box) {
  const x0 = Math.max(1, Math.floor(box?.x0 ?? 0));
  const y0 = Math.max(1, Math.floor(box?.y0 ?? 0));
  const x1 = Math.min(w - 1, Math.ceil(box?.x1 ?? w));
  const y1 = Math.min(h - 1, Math.ceil(box?.y1 ?? h));
  if (x1 <= x0 || y1 <= y0) return 0;
  let sum = 0, sumSq = 0, n = 0;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const lap = 4 * gray[y * w + x] - gray[y * w + x - 1] - gray[y * w + x + 1]
        - gray[(y - 1) * w + x] - gray[(y + 1) * w + x];
      sum += lap; sumSq += lap * lap; n++;
    }
  }
  if (!n) return 0;
  const mean = sum / n;
  return sumSq / n - mean * mean;
}

/** laplacianVariance'ı MIN_SHARPNESS ile karşılaştırır. Dönen: { ok, deger }. */
export function assessSharpness(gray, w, h, box) {
  const deger = round2(laplacianVariance(gray, w, h, box));
  return { ok: deger >= MIN_SHARPNESS, deger };
}

// --- Vuruş seviyesinde birleştirme ----------------------------------------------------------

// Bir iskeletin (33 nokta) piksel-uzayındaki kutusunu, küçültülmüş gri kareye (gray: {w,h,sx,sy})
// ölçekler. sx/sy: orijinal karadan küçültülmüş kareye dönüşüm oranı (vision.js'te üretilir).
// pad: uzuvlar minmax kutunun biraz dışına taşabildiği (sallanan kol/bacak) için küçük bir pay.
function personBoxInGray(person, gray) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const q of person || []) {
    if (!q) continue;
    if (q.x < minX) minX = q.x; if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y; if (q.y > maxY) maxY = q.y;
  }
  if (!Number.isFinite(minX)) return null;
  const pad = 0.15 * Math.max(maxX - minX, maxY - minY, 1);
  return {
    x0: (minX - pad) * gray.sx, y0: (minY - pad) * gray.sy,
    x1: (maxX + pad) * gray.sx, y1: (maxY + pad) * gray.sy,
  };
}

// Topun (kick.rest) piksel-uzayındaki kutusunu küçültülmüş kareye ölçekler.
function ballBoxInGray(rest, gray) {
  if (!rest) return null;
  const r = Math.max(rest.w || 0, 4);
  return {
    x0: (rest.x - r) * gray.sx, y0: (rest.y - r) * gray.sy,
    x1: (rest.x + r) * gray.sx, y1: (rest.y + r) * gray.sy,
  };
}

// Temas karesindeki oyuncu+top kutuları (kamera-kayması hesaplarken bu bölgeler dışlanır: kendi
// hareketleri kamerayı kayıyor gibi göstermesin). Tüm pencere için TEK kutu kullanılır (basitlik,
// zaten "sabit kamera" varsayımında arka plan durağan) — ilk sürümün bilinen kısıtı.
function kickExcludeBoxes(frames, kick) {
  const g = frames[kick.contact]?.gray;
  if (!g) return [];
  const boxes = [];
  const person = personBoxInGray(frames[kick.contact]?.people?.[kick.person], g);
  if (person) boxes.push(person);
  const ball = ballBoxInGray(kick.rest, g);
  if (ball) boxes.push(ball);
  return boxes;
}

// Pencereden (i0..i1) en fazla `count` indeks örnekler, uçlar dahil, eşit aralıklı.
function sampleIndices(i0, i1, count) {
  if (i1 <= i0) return [i0];
  const n = Math.min(count, i1 - i0 + 1);
  const out = new Set();
  for (let k = 0; k < n; k++) out.add(i0 + Math.round((k * (i1 - i0)) / (n - 1 || 1)));
  return [...out].sort((a, b) => a - b);
}

/**
 * Temas ±BLUR_WINDOW_FRAMES karede, oyuncu kutusu içindeki en düşük (en kötü) Laplacian varyansı.
 * Gri veri ya da iskelet yoksa (kare işlenmemiş/oyuncu bulunamamış) o kare atlanır; hiçbiri
 * kullanılamazsa ok:true, deger:null döner (context.js'teki "ölçülemedi" deseniyle aynı: veri
 * eksikliği akışı ENGELLEMEZ).
 */
function assessSharpnessWindow(frames, kick) {
  const from = Math.max(0, kick.contact - BLUR_WINDOW_FRAMES);
  const to = Math.min(frames.length - 1, kick.contact + BLUR_WINDOW_FRAMES);
  let minVar = Infinity, any = false;
  for (let i = from; i <= to; i++) {
    const f = frames[i];
    if (!f?.gray) continue;
    const box = personBoxInGray(f.people?.[kick.person], f.gray);
    if (!box) continue;
    const v = laplacianVariance(f.gray.data, f.gray.w, f.gray.h, box);
    if (v < minVar) minVar = v;
    any = true;
  }
  if (!any) return { ok: true, deger: null };
  return { ok: minVar >= MIN_SHARPNESS, deger: round2(minVar) };
}

/**
 * Bir vuruş için iki kapıyı birden değerlendirir: kamera sabitliği + netlik.
 * frames: collectKicks'e giden aynı yoğun kare listesi, HER karede .gray dolu olmalı (vision.js,
 * processRange). kick: findKicks/collectKicks çıktısındaki bir vuruş ({ contact, person, rest }).
 * fps: bu karelerin işlendiği hız.
 * Dönen: { kamera: { ok, kayma }, netlik: { ok, deger } } — analysis.js'te kick.quality olarak eklenir.
 */
export function assessKickQuality(frames, kick, fps) {
  const win = Math.max(1, Math.round(CAMERA_WINDOW_SEC * fps));
  const i0 = Math.max(0, kick.contact - win);
  const i1 = Math.min(frames.length - 1, kick.contact + win);
  const boxes = kickExcludeBoxes(frames, kick);
  const grays = sampleIndices(i0, i1, CAMERA_SAMPLE_COUNT)
    .map((i) => frames[i]?.gray)
    .filter(Boolean);
  const g0 = grays[0];
  const kamera = g0
    ? assessCameraStability(grays.map((g) => g.data), g0.w, g0.h, boxes)
    : { ok: true, kayma: null };
  const netlik = assessSharpnessWindow(frames, kick);
  return { kamera, netlik };
}
