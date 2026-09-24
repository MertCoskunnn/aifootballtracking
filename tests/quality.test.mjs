// quality.js testleri (cp-15-kalite-kapisi): kamera sabitliği ve netlik kapıları.
// Sentetik gri kareler kullanılır, gerçek video ya da MediaPipe gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  rgbaToGray, assessCameraStability, laplacianVariance, assessSharpness, assessKickQuality,
  SHRINK_W, SHRINK_H, SHARP_MIN, MIN_SHARPNESS,
} from '../quality.js';

// Deterministik "gürültü" deseni: block-matching'in (kamera kayması) ve Laplacian'ın (netlik)
// düz/tekrarlı bir görüntüde yanlışlıkla sıfır/aynı sonuç vermesini engelleyen dokulu bir kare.
function texturedImage(w, h) {
  const g = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
      g[y * w + x] = Math.floor((s - Math.floor(s)) * 256);
    }
  }
  return g;
}

// Görüntüyü (dx,dy) kadar kaydırır, kenarları en yakın pikselle uzatır (sarma/siyah kenar
// yapay eserlerinden kaçınmak için) — gerçek bir kamera pan'ini taklit eder.
function shiftImage(gray, w, h, dx, dy) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.min(w - 1, Math.max(0, x - dx));
      const cy = Math.min(h - 1, Math.max(0, y - dy));
      out[y * w + x] = gray[cy * w + cx];
    }
  }
  return out;
}

// Basit kutu filtresi (ör. 5x5 ortalama): ürün kararındaki "kutu filtresi" bulanıklaştırma.
function boxBlur(gray, w, h, radius) {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let sum = 0, n = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const sy = y + dy;
        if (sy < 0 || sy >= h) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const sx = x + dx;
          if (sx < 0 || sx >= w) continue;
          sum += gray[sy * w + sx]; n++;
        }
      }
      out[y * w + x] = Math.round(sum / n);
    }
  }
  return out;
}

test('rgbaToGray: bilinen RGBA değerlerini luma formülüyle gri tona çevirir', () => {
  // Kırmızı, yeşil, mavi, beyaz — her biri tek pikselik 1x4 görüntü
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]);
  const gray = rgbaToGray(rgba, 4, 1);
  assert.equal(gray[0], Math.floor(0.299 * 255));
  assert.equal(gray[1], Math.floor(0.587 * 255));
  assert.equal(gray[2], Math.floor(0.114 * 255));
  assert.equal(gray[3], 255);
});

test('assessCameraStability: aynı (kaymamış) kare geçer, kayma ~0', () => {
  const g = texturedImage(SHRINK_W, SHRINK_H);
  const res = assessCameraStability([g, g], SHRINK_W, SHRINK_H, []);
  assert.equal(res.ok, true);
  assert.equal(res.kayma.px, 0);
  assert.equal(res.kayma.zoom, 0);
});

test('assessCameraStability: kaydırılmış kare kamerayı hareketli işaretler, kayma miktarını yakalar', () => {
  const base = texturedImage(SHRINK_W, SHRINK_H);
  const dx = 4, dy = 2;
  const shifted = shiftImage(base, SHRINK_W, SHRINK_H, dx, dy);
  const res = assessCameraStability([base, shifted], SHRINK_W, SHRINK_H, []);
  assert.equal(res.ok, false, `beklenmedik ok:true, kayma=${JSON.stringify(res.kayma)}`);
  const expected = Math.hypot(dx, dy);
  assert.ok(Math.abs(res.kayma.px - expected) <= 1, `kayma.px=${res.kayma.px}, beklenen~${expected}`);
});

test('assessCameraStability: tek kareden az veri gelirse engellemez (ok:true, kayma:null)', () => {
  const g = texturedImage(SHRINK_W, SHRINK_H);
  const res = assessCameraStability([g], SHRINK_W, SHRINK_H, []);
  assert.equal(res.ok, true);
  assert.equal(res.kayma, null);
});

test('laplacianVariance + assessSharpness: keskin (dokulu) görüntü geçer, kutu filtresiyle bulanıklaştırılmış aynı görüntü düşük keskinlik verir (SHARP_MIN ölçeğinde, cp-16)', () => {
  // cp-16-netlik: gerçek netlik ölçümü artık 64x36 yerine SHARP_MIN..SHARP_MAX'lık gerçek
  // çözünürlük kırpıntısında yapılıyor (vision.js frame.sharp); bu test de o ölçeği kullanıyor.
  const sharp = texturedImage(SHARP_MIN, SHARP_MIN);
  // Geniş bir kutu filtresi (17x17): tam piksel gürültüsü çok yüksek frekanslı olduğu için
  // MIN_SHARPNESS'in (100) belirgin altına inmesi için dar bir kutu (ör. 5x5) yetmiyor.
  const blurred = boxBlur(sharp, SHARP_MIN, SHARP_MIN, 8);
  const sharpRes = assessSharpness(sharp, SHARP_MIN, SHARP_MIN);
  const blurredRes = assessSharpness(blurred, SHARP_MIN, SHARP_MIN);
  assert.equal(sharpRes.ok, true, `keskin görüntü beklenenden düşük: ${sharpRes.deger}`);
  assert.equal(blurredRes.ok, false, `bulanık görüntü eşiği geçti: ${blurredRes.deger}`);
  assert.ok(blurredRes.deger < sharpRes.deger, `bulanık (${blurredRes.deger}) keskinden (${sharpRes.deger}) düşük olmalı`);
});

test('laplacianVariance: box parametresi sadece verilen bölgeyi tarar', () => {
  const flat = new Uint8Array(SHRINK_W * SHRINK_H).fill(128); // tamamen düz: varyans 0
  const box = { x0: 5, y0: 5, x1: 10, y1: 10 };
  assert.equal(laplacianVariance(flat, SHRINK_W, SHRINK_H, box), 0);
});

// --- assessKickQuality: uçtan uca entegrasyon (analysis.js'in kullanacağı biçim) ---

// vision.js'in her karede üreteceği .gray (kamera-sabitliği, 64x36) ve .sharp (netlik, cp-16 —
// gerçek çözünürlük kırpıntısının Laplacian varyansı, tek sayı) alanlarını taklit eder. gray:
// W×H orijinal karede tek bir dokulu arka plan sahnesi, oyuncu kutusu civarında farklı bir yama
// (hareketli nesne) olsa da kamera sabit kaldığı sürece (aynı arka plan, kaydırılmamış) kapı
// geçmeli. sharp: vision.js'in zaten hesaplayıp yazdığı tek sayı olduğu için burada doğrudan
// parametre olarak veriliyor (üretimi vision.js'in işi, quality.js sadece pencereyi okur).
function fakeFrame(t, W, H, gray, sharp = null) {
  const sx = SHRINK_W / W, sy = SHRINK_H / H;
  return {
    t,
    people: [new Array(33).fill(0).map(() => ({ x: W / 2, y: H / 2, v: 1 }))],
    balls: [{ x: W / 2 + 50, y: H / 2, w: 20, s: 0.9 }],
    gray: { data: gray, w: SHRINK_W, h: SHRINK_H, sx, sy },
    sharp,
  };
}

test('assessKickQuality: sabit kamera + keskin frame.sharp değerinde iki kapı da geçer, biçim kick.quality ile uyumlu', () => {
  const W = 1280, H = 720, fps = 30;
  const bg = texturedImage(SHRINK_W, SHRINK_H);
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push(fakeFrame(i / fps, W, H, bg, MIN_SHARPNESS + 500));
  const kick = { contact: 5, person: 0, rest: { x: W / 2 + 50, y: H / 2, w: 20 } };
  const quality = assessKickQuality(frames, kick, fps);
  assert.ok('kamera' in quality && 'netlik' in quality);
  assert.equal(typeof quality.kamera.ok, 'boolean');
  assert.equal(typeof quality.netlik.ok, 'boolean');
  assert.equal(quality.kamera.ok, true, `kamera.kayma=${JSON.stringify(quality.kamera.kayma)}`);
  assert.equal(quality.netlik.ok, true, `netlik.deger=${quality.netlik.deger}`);
});

test('assessKickQuality: temas penceresindeki düşük frame.sharp netlik kapısını kapatır (kamera etkilenmez)', () => {
  const W = 1280, H = 720, fps = 30;
  const bg = texturedImage(SHRINK_W, SHRINK_H);
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push(fakeFrame(i / fps, W, H, bg, MIN_SHARPNESS + 500));
  // Temas karesinin ("contact: 5") tam ±BLUR_WINDOW_FRAMES penceresindeki bir kare bulanık:
  // en kötü (en düşük) değer pencereden seçildiği için netlik kapısı kapanmalı.
  frames[4].sharp = MIN_SHARPNESS - 10;
  const kick = { contact: 5, person: 0, rest: { x: W / 2 + 50, y: H / 2, w: 20 } };
  const quality = assessKickQuality(frames, kick, fps);
  assert.equal(quality.netlik.ok, false, `netlik.deger=${quality.netlik.deger}`);
  assert.equal(quality.netlik.deger, MIN_SHARPNESS - 10);
  assert.equal(quality.kamera.ok, true, 'bulanık kare kamera kapısını etkilememeli');
});

test('assessKickQuality: .gray/.sharp eksik karelerde çökmeden geçer sayar (veri eksikliği engellemez)', () => {
  const kick = { contact: 2, person: 0, rest: { x: 100, y: 100, w: 10 } };
  const frames = [
    { t: 0, people: [], balls: [] },
    { t: 1 / 30, people: [], balls: [] },
    { t: 2 / 30, people: [], balls: [] },
  ];
  const quality = assessKickQuality(frames, kick, 30);
  assert.equal(quality.kamera.ok, true);
  assert.equal(quality.kamera.kayma, null);
  assert.equal(quality.netlik.ok, true);
  assert.equal(quality.netlik.deger, null);
});
