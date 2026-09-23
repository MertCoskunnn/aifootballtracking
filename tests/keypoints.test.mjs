// keypoints.js testleri (cp-12-movenet): COCO-17 → MediaPipe-33 adaptörü. Saf fonksiyonlar,
// TF.js/MoveNet/DOM gerekmez — sahte COCO-17 dizileriyle test edilir.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mapCocoToMediapipe, acceptMoveNetPose, legScore, MN_VIS_SCALE, MN_MIN_LEG_SCORE } from '../keypoints.js';

// Her COCO noktasına ayırt edici bir x/y/score verir ki yanlış indeksten okunursa test yakalasın.
// coco[i] = { x: i/100, y: i/200, score: i/20 } (i: 0..16)
function fakeCoco() {
  return new Array(17).fill(0).map((_, i) => ({ x: i / 100, y: i / 200, score: i / 20 }));
}

test('mapCocoToMediapipe: doğrudan eşlenen 17 nokta doğru COCO indeksinden geliyor (x0=0,y0=0,s=1)', () => {
  const coco = fakeCoco();
  const mp = mapCocoToMediapipe(coco, 0, 0, 1);
  // [mediaPipeIndex, cocoIndex] — GECE-PLANI'ndaki eşleme tablosuyla birebir
  const pairs = [
    [0, 0], [2, 1], [5, 2], [7, 3], [8, 4], [11, 5], [12, 6], [13, 7], [14, 8],
    [15, 9], [16, 10], [23, 11], [24, 12], [25, 13], [26, 14], [27, 15], [28, 16],
  ];
  for (const [mpI, cI] of pairs) {
    assert.equal(mp[mpI].x, coco[cI].x, `MP${mpI} x, COCO${cI} olmalı`);
    assert.equal(mp[mpI].y, coco[cI].y, `MP${mpI} y, COCO${cI} olmalı`);
    assert.equal(mp[mpI].v, Math.min(1, coco[cI].score * MN_VIS_SCALE), `MP${mpI} v`);
  }
});

test('mapCocoToMediapipe: eşleşmeyen noktalar en yakın bilinen noktanın kopyası, v=0', () => {
  const coco = fakeCoco();
  const mp = mapCocoToMediapipe(coco, 0, 0, 1);
  // [mediaPipeIndex, kopyalanan cocoIndex]
  const copies = [
    [1, 1], [3, 1], [4, 2], [6, 2], [9, 0], [10, 0],
    [17, 9], [19, 9], [21, 9], [18, 10], [20, 10], [22, 10],
    [29, 15], [31, 15], [30, 16], [32, 16],
  ];
  for (const [mpI, cI] of copies) {
    assert.equal(mp[mpI].x, coco[cI].x, `MP${mpI} (kopya) x, COCO${cI} olmalı`);
    assert.equal(mp[mpI].y, coco[cI].y, `MP${mpI} (kopya) y, COCO${cI} olmalı`);
    assert.equal(mp[mpI].v, 0, `MP${mpI} kopya nokta görünmez (v=0) olmalı`);
  }
  // 33 noktanın hepsi dolu olmalı (17 eşlenen + 16 kopya)
  assert.equal(mp.length, 33);
  assert.ok(mp.every((p) => p && typeof p.x === 'number' && typeof p.y === 'number'));
});

test('mapCocoToMediapipe: kırpıntı→tam kare dönüşümü (x = x0 + xn*s, y = y0 + yn*s)', () => {
  const coco = fakeCoco();
  const x0 = 100, y0 = 50, s = 200;
  const mp = mapCocoToMediapipe(coco, x0, y0, s);
  // MP0 ← COCO0 (burun): x=0/100=0, y=0/200=0
  assert.equal(mp[0].x, x0 + 0 * s);
  assert.equal(mp[0].y, y0 + 0 * s);
  // MP16 ← COCO10 (sağ bilek): x=10/100=0.1, y=10/200=0.05
  assert.equal(mp[16].x, x0 + (10 / 100) * s);
  assert.equal(mp[16].y, y0 + (10 / 200) * s);
  // Kopya nokta da aynı dönüşümü kullanmalı: MP29 (sol topuk) ← COCO15 (sol ayak bileği)
  assert.equal(mp[29].x, x0 + coco[15].x * s);
  assert.equal(mp[29].y, y0 + coco[15].y * s);
});

test('skor→v: MN_VIS_SCALE ile çarpılır ve 1 ile sınırlanır (skor > 1/scale olsa bile v taşmaz)', () => {
  const coco = fakeCoco();
  coco[0].score = 5; // aşırı yüksek/geçersiz bir skor senaryosu
  const mp = mapCocoToMediapipe(coco, 0, 0, 1);
  assert.equal(mp[0].v, 1, 'v, 1 değerini geçmemeli (Math.min ile sınırlı)');
});

test('legScore: kalça+diz+bilek (COCO 11-16) ortalaması', () => {
  const coco = fakeCoco().map((p) => ({ ...p, score: 0 }));
  for (const i of [11, 12, 13, 14, 15, 16]) coco[i].score = 0.6;
  assert.equal(legScore(coco), 0.6);
});

test('acceptMoveNetPose: bacak güveni eşiğin üstündeyse kabul, altındaysa red', () => {
  const high = fakeCoco().map((p) => ({ ...p, score: 0 }));
  for (const i of [11, 12, 13, 14, 15, 16]) high[i].score = 0.9;
  assert.equal(acceptMoveNetPose(high), true);

  const low = fakeCoco().map((p) => ({ ...p, score: 0.05 }));
  assert.equal(acceptMoveNetPose(low), false);
});

test('acceptMoveNetPose: varsayılan eşik MN_MIN_LEG_SCORE ile birebir aynı sınırda çalışır', () => {
  const boundary = fakeCoco().map((p) => ({ ...p, score: 0 }));
  for (const i of [11, 12, 13, 14, 15, 16]) boundary[i].score = MN_MIN_LEG_SCORE;
  assert.equal(acceptMoveNetPose(boundary), true, 'eşiğe eşitse kabul edilmeli (>=)');

  const justBelow = fakeCoco().map((p) => ({ ...p, score: 0 }));
  for (const i of [11, 12, 13, 14, 15, 16]) justBelow[i].score = MN_MIN_LEG_SCORE - 0.01;
  assert.equal(acceptMoveNetPose(justBelow), false);
});
