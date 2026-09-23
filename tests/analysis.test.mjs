// analysis.js testleri (cp-10-regresyon): collectKicks/analyzeKick'in doğru alanları ürettiği,
// 'auto' mod/ayak seçiminin app.js'teki effectiveMode/effectiveFoot ile aynı mantığı izlediği,
// ve regresyon sayfasının kullandığı eşleştirme/tolerans yardımcıları. Sahte iskeletlerle
// çalışır, gerçek video ya da MediaPipe gerekmez (bu yüzden vision.js değil sadece analysis.js
// import ediliyor — pipeline.js Node'da import edilemez, CDN'den modül çeker).
import test from 'node:test';
import assert from 'node:assert/strict';
import { collectKicks, analyzeKick, matchByDuration, withinTolerance } from '../analysis.js';

const FPS = 30;

// detect.test.mjs'teki 'findKicks: hızlı yaklaşan vuran ayak...' testiyle aynı desen: tek kişilik
// sahte iskelet, sağ ayak (vuran) topa hızla yaklaşır, sol ayak (destek) yavaşça topun yanına iner.
function personAt({ rightAnkleX, leftAnkleX, y = 600 }) {
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  p[27] = { x: leftAnkleX, y }; p[31] = { x: leftAnkleX, y };
  p[29] = { x: leftAnkleX - 5, y };
  p[23] = { x: leftAnkleX, y: y - 100 };
  p[25] = { x: leftAnkleX, y: y - 50 };
  p[28] = { x: rightAnkleX, y }; p[32] = { x: rightAnkleX, y };
  p[30] = { x: rightAnkleX - 5, y };
  p[24] = { x: rightAnkleX, y: y - 100 };
  p[26] = { x: rightAnkleX, y: y - 50 };
  return p;
}

function buildKickFrames() {
  const contact = 20, total = 28;
  const ballX = 1000, ballY = 600, ballW = 20;
  const rightStep = (20 * 100) / FPS;
  const leftStep = (5 * 100) / FPS;
  const leftTargetX = ballX - 20;
  const frames = [];
  for (let i = 0; i < total; i++) {
    const rightAnkleX = i <= contact ? ballX - (contact - i) * rightStep : ballX;
    const leftAnkleX = i <= contact ? leftTargetX - (contact - i) * leftStep : leftTargetX;
    const people = [personAt({ rightAnkleX, leftAnkleX, y: ballY })];
    const balls = i <= contact ? [{ x: ballX, y: ballY, w: ballW, s: 0.9 }] : [];
    frames.push({ t: i / FPS, people, balls });
  }
  return { frames, contact };
}

test('collectKicks: findKicks çıktısına frames/fps/t/view/suggestion/score ekler', () => {
  const { frames, contact } = buildKickFrames();
  const kicks = collectKicks(frames, FPS);
  assert.equal(kicks.length, 1, `beklenmedik vuruş sayısı: ${JSON.stringify(kicks)}`);
  const k = kicks[0];
  assert.equal(k.contact, contact);
  assert.equal(k.foot, 'right');
  assert.equal(k.frames, frames, 'vuruş kendi frames penceresini taşımalı (aynı referans)');
  assert.equal(k.fps, FPS);
  assert.equal(k.t, frames[contact].t);
  assert.ok(k.view && typeof k.view.view === 'string', 'view alanı classifyView çıktısı olmalı');
  assert.ok(k.suggestion && ('mode' in k.suggestion), 'suggestion alanı suggestMode çıktısı olmalı');
  assert.equal(k.score, null);
});

test("analyzeKick: mode/foot 'auto' ise vuruşun suggestion.mode'u (yoksa 'shot') ve kick.foot kullanılır", () => {
  const { frames } = buildKickFrames();
  const [k] = collectKicks(frames, FPS);
  const a = analyzeKick(k, { mode: 'auto', foot: 'auto' });
  assert.equal(a.foot, k.foot, 'auto ayak, vuruşun tespit edilen ayağı olmalı');
  assert.equal(a.mode, k.suggestion.mode || 'shot', "auto mod, suggestion.mode (yoksa 'shot') olmalı");
  assert.equal(a.track.length, frames.length, 'track her kare için bir giriş taşımalı');
  assert.ok(a.measurements && typeof a.measurements === 'object');
  assert.ok(a.result && typeof a.result.total === 'number' && Array.isArray(a.result.items),
    'evaluate() çıktısı (total, items) korunmalı');
});

test('analyzeKick: mode/foot açıkça seçilmişse (auto değilse) doğrudan kullanılır', () => {
  const { frames } = buildKickFrames();
  const [k] = collectKicks(frames, FPS);
  const a = analyzeKick(k, { mode: 'pass', foot: 'left' });
  assert.equal(a.mode, 'pass');
  assert.equal(a.foot, 'left');
});

test('analyzeKick: opts verilmezse (varsayılan auto) hata vermez', () => {
  const { frames } = buildKickFrames();
  const [k] = collectKicks(frames, FPS);
  const a = analyzeKick(k);
  assert.equal(a.foot, k.foot);
});

// --- matchByDuration: Mert K1/K2 gibi hangi dosyanın hangi klip olduğunu bilmediğimiz durum ---

test('matchByDuration: en yakın süreli dosyayı seçer', () => {
  const durations = [{ file: 'a.mp4', duration: 68 }, { file: 'b.mp4', duration: 300 }];
  assert.equal(matchByDuration(durations, 70), 'a.mp4');
  assert.equal(matchByDuration(durations, 290), 'b.mp4');
});

test('matchByDuration: excludeFiles zaten atanmış dosyayı eler', () => {
  const durations = [{ file: 'a.mp4', duration: 68 }, { file: 'b.mp4', duration: 300 }];
  // 70'e en yakın normalde a.mp4, ama a zaten atanmışsa geriye kalan (b.mp4) seçilir.
  assert.equal(matchByDuration(durations, 70, ['a.mp4']), 'b.mp4');
});

test('matchByDuration: aday kalmazsa null döner', () => {
  assert.equal(matchByDuration([], 70), null);
  assert.equal(matchByDuration([{ file: 'a.mp4', duration: 68 }], 70, ['a.mp4']), null);
});

// --- withinTolerance: zaman ±0.15 sn, puan tam eşit (GECE-PLANI.md) ---

test('withinTolerance: zaman toleransı içinde ve puan eşitse geçer', () => {
  const r = withinTolerance({ tSec: 6.05, score: 100 }, { tSec: 6.10, score: 100 });
  assert.equal(r.pass, true);
  assert.ok(Math.abs(r.timeDiff - 0.05) < 1e-9);
  assert.equal(r.scoreDiff, 0);
});

test('withinTolerance: zaman toleransı dışındaysa kalır (FAIL) ama farkı gösterir', () => {
  const r = withinTolerance({ tSec: 6.30, score: 100 }, { tSec: 6.10, score: 100 });
  assert.equal(r.pass, false);
  assert.ok(Math.abs(r.timeDiff - 0.20) < 1e-9);
});

test('withinTolerance: puan farklıysa zaman tam tutsa da FAIL (puan tam eşit olmalı)', () => {
  const r = withinTolerance({ tSec: 6.10, score: 99 }, { tSec: 6.10, score: 100 });
  assert.equal(r.pass, false);
  assert.equal(r.scoreDiff, -1);
});
