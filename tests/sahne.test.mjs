// scan.js sahne kesmesi / bitiş ekranı testleri (2026-09-24 gece).
import test from 'node:test';
import assert from 'node:assert/strict';
import { isEndCard, sceneSegments } from '../scan.js';

const N = 64 * 36;
const gray = (fn) => ({ data: Float32Array.from({ length: N }, (_, i) => fn(i)), w: 64, h: 36 });
const pitch = (seed) => gray((i) => 90 + ((i * 7 + seed) % 60)); // dokulu, orta parlak saha
const other = () => gray((i) => 200 - ((i * 3) % 50));             // tamamen farklı sahne
const black = () => gray((i) => (i % 97 === 0 ? 255 : 12));        // koyu, küçük logolu bitiş ekranı

test('isEndCard: koyu tekdüze kare bitiş ekranı, saha karesi değil', () => {
  assert.equal(isEndCard({ gray: black() }), true);
  assert.equal(isEndCard({ gray: pitch(0) }), false);
  assert.equal(isEndCard({}), false, 'gri kopya yoksa karar verilmez');
});

test('sceneSegments: kesmede böler, bitiş ekranını atar', () => {
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push({ t: i * 0.2, gray: pitch(i % 3) });   // sahne 1: 0-1.8
  for (let i = 10; i < 20; i++) frames.push({ t: i * 0.2, gray: other() });       // sahne 2: 2.0-3.8
  for (let i = 20; i < 26; i++) frames.push({ t: i * 0.2, gray: black() });       // bitiş ekranı
  const segs = sceneSegments(frames);
  assert.equal(segs.length, 2);
  assert.ok(Math.abs(segs[0].t1 - 1.9) < 1e-6 && Math.abs(segs[1].t0 - 1.9) < 1e-6, 'kesme iki karenin ortasında');
  assert.ok(Math.abs(segs[1].t1 - 3.8) < 1e-6, 'bitiş ekranı sahneye girmez');
});

test('sceneSegments: gri kopya yoksa tek sahne (eski davranış)', () => {
  const segs = sceneSegments([{ t: 0 }, { t: 1 }, { t: 2 }]);
  assert.equal(segs.length, 1); assert.equal(segs[0].t0, 0); assert.equal(segs[0].t1, 2); assert.equal(segs[0].cutStart, false);
});

test('candidateWindows: pencere kesmeden öteye taşmaz, bitiş ekranındaki olay atılır', async () => {
  const { candidateWindows } = await import('../scan.js');
  // Basit sahte kişi: ayakları (27,28,31,32) verilen noktada
  const person = (x, y) => Array.from({ length: 33 }, () => ({ x, y, v: 1 }));
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push({ t: i * 0.2, gray: pitch(i % 3), people: [person(100, 100)], balls: [{ x: 100, y: 100, w: 10, s: 0.9 }] });
  // 1.8 sn civarı vuruş: top sonraki karede uzakta, ama sonraki kare yeni sahne (kesme)
  for (let i = 10; i < 20; i++) frames.push({ t: i * 0.2, gray: other(), people: [], balls: [] });
  const w = candidateWindows(frames);
  assert.equal(w.length, 1);
  assert.ok(w[0].t1 <= 1.9 + 1e-6, `pencere kesmede bitmeli, t1=${w[0].t1}`);
});
