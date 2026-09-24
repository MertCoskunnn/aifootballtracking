// balls.js testleri (cp-17-top-birlesimi): aynı topun iki kez sayılmaması için IoU + merkez-
// mesafesi tabanlı birleştirme (NMS). Sentetik kutular kullanılır, gerçek video/model gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { iou, sameBall, mergeBallDetections, IOU_THRESH, CENTER_DIST_RATIO } from '../balls.js';

test('iou: aynı kutu 1.0, hiç örtüşmeyen kutular 0', () => {
  const a = { x: 100, y: 100, w: 20 };
  assert.equal(iou(a, a), 1);
  const far = { x: 500, y: 500, w: 20 };
  assert.equal(iou(a, far), 0);
});

test('iou: kısmi örtüşme bilinen değeri verir (10x10 kutular, 5px kaymış → 1/7)', () => {
  const a = { x: 0, y: 0, w: 10 }; // [-5,5]x[-5,5]
  const b = { x: 5, y: 0, w: 10 }; // [0,10]x[-5,5]
  // kesişim: [0,5]x[-5,5] = 5*10 = 50; birleşim: 100+100-50 = 150
  assert.equal(iou(a, b), 50 / 150);
});

test('sameBall: küçük, birbirine yakın iki tespit (uzak/grenli top) merkez-mesafesi eski eşiği', () => {
  // dedupe'ın ESKİ (yalnız merkez-mesafesi) mantığıyla hâlâ aynı sonucu vermesi gerektiği,
  // sınırın İÇİNDEKİ durum: davranış regresyonu yok.
  const a = { x: 100, y: 100, w: 14, s: 0.6 };
  const b = { x: 106, y: 100, w: 12, s: 0.55 }; // mesafe 6, eski eşik 0.5*14=7 → eski de birleştirirdi
  assert.equal(sameBall(a, b), true);
});

test('sameBall: küçük toplarda ESKİ merkez-mesafesi testi reddeder ama IoU örtüşmesi aynı topu yakalar (kök neden düzeltmesi)', () => {
  // Mert'in raporu: aynı toplu videoda bile 2 top çemberi görünüyor. Kök neden: top üç ayrı
  // kırpıntıdan aranıyor (vision.js), kırpıntı kenarına yakın/küçük toplarda model kutuyu farklı
  // boyutta tahmin edebiliyor. Bu durumda ESKİ birleştirme (0.5 * Math.max(w) merkez-mesafesi TEK
  // BAŞINA) küçük kutularda çok dar bir eşik üretiyordu.
  const a = { x: 100, y: 100, w: 14, s: 0.6 };
  const b = { x: 108, y: 100, w: 12, s: 0.55 }; // mesafe 8, eski eşik 0.5*14=7 → eski REDDEDERDİ
  const oldStyleDistanceOnly = Math.hypot(a.x - b.x, a.y - b.y) < 0.5 * Math.max(a.w, b.w);
  assert.equal(oldStyleDistanceOnly, false, 'test kurgusu: eski kural bu durumda reddetmeli');
  assert.ok(iou(a, b) >= IOU_THRESH, `iou=${iou(a, b)} beklenen >= ${IOU_THRESH}`);
  assert.equal(sameBall(a, b), true, 'IoU örtüşmesi merkez-mesafesi testinin kaçırdığını yakalamalı');
});

test('sameBall: gerçekten ayrı iki top (uzak, örtüşmeyen kutular) aynı top SAYILMAZ', () => {
  const a = { x: 100, y: 100, w: 20, s: 0.9 };
  const b = { x: 160, y: 100, w: 20, s: 0.5 }; // mesafe 60, kutular örtüşmüyor ([90,110] vs [150,170])
  assert.equal(iou(a, b), 0);
  assert.equal(sameBall(a, b), false);
});

test('mergeBallDetections: aynı topun hafif kaymış/farklı boyutlu iki tespiti TEK topa iner, yüksek güvenli olan tutulur', () => {
  const a = { x: 100, y: 100, w: 14, s: 0.6 };
  const b = { x: 108, y: 100, w: 12, s: 0.85 }; // daha güvenli ama biraz küçük/kaymış — aynı top
  const merged = mergeBallDetections([a, b]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].s, 0.85, 'en yüksek güvenli tespit tutulmalı (eski dedupe ile aynı sözleşme)');
});

test('mergeBallDetections: gerçekten ayrı iki top İKİ top olarak kalır', () => {
  const a = { x: 100, y: 100, w: 20, s: 0.9 };
  const b = { x: 300, y: 100, w: 20, s: 0.7 };
  const c = { x: 100, y: 400, w: 20, s: 0.6 };
  const merged = mergeBallDetections([a, b, c]);
  assert.equal(merged.length, 3);
});

test('mergeBallDetections: birden çok kırpıntıdan gelen (3 kez bulunmuş) tek top tek sonuca iner', () => {
  // vision.js'te aynı top tam kare + iki farklı oyuncunun ayak kırpıntısından ayrı ayrı
  // bulunabilir; üçü de gerçek dünyada aynı topun hafif farklı tahminleridir.
  const dets = [
    { x: 500, y: 300, w: 22, s: 0.4 },
    { x: 503, y: 298, w: 24, s: 0.9 },
    { x: 497, y: 302, w: 18, s: 0.6 },
  ];
  const merged = mergeBallDetections(dets);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].s, 0.9);
});

test('mergeBallDetections: boş girdi boş dizi döner, girdi dizisi değiştirilmez', () => {
  assert.deepEqual(mergeBallDetections([]), []);
  const dets = [{ x: 1, y: 1, w: 10, s: 0.5 }, { x: 2, y: 1, w: 10, s: 0.9 }];
  const copy = dets.map((d) => ({ ...d }));
  mergeBallDetections(dets);
  assert.deepEqual(dets, copy, 'girdi dizisinin SIRASI/İÇERİĞİ mutasyona uğramamalı');
});

test('CENTER_DIST_RATIO eski dedupe eşiğiyle (0.5) aynı: davranış regresyonu yok', () => {
  assert.equal(CENTER_DIST_RATIO, 0.5);
});
