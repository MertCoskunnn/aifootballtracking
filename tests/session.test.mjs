// session.js testleri: bir seansın (aynı videodaki tüm vuruşlar) özeti doğru mu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreKick, summarizeSession, issueSentence } from '../session.js';
import { posture3d, POSTURE_KEYS } from '../metrics3d.js';

// tests/metrics3d.test.mjs'teki sahte iskelet üreticisinin birebir kopyası (metre, y aşağı,
// oyuncu -z yönüne bakıyor, sağ ayakla vuran). scoreKick için gerçek bir 3D postür üretmek gerekiyor.
function body({ supportFlex = 30, kickFlex = 45, lean = 0, pitch = 0, thigh = 0 } = {}) {
  const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const r = (d) => (d * Math.PI) / 180;
  w[23] = { x: -0.1, y: 0, z: 0 }; w[24] = { x: 0.1, y: 0, z: 0 };
  const L = 0.5, sx = L * Math.sin(r(lean)), sz = -L * Math.sin(r(pitch)), sy = -Math.sqrt(L * L - sx * sx - sz * sz);
  const sh = (x) => ({ x: x + sx, y: sy, z: sz });
  w[11] = sh(-0.18); w[12] = sh(0.18);
  w[0] = { x: sx, y: sy - 0.15, z: sz - 0.1 };
  w[13] = { x: w[11].x - 0.25, y: w[11].y + 0.1, z: w[11].z }; w[14] = { x: w[12].x + 0.25, y: w[12].y + 0.1, z: w[12].z };
  const leg = (h, k, a, flex, th = 0) => {
    w[k] = { x: w[h].x, y: 0.45 * Math.cos(r(th)), z: -0.45 * Math.sin(r(th)) };
    const s = r(flex - th);
    w[a] = { x: w[h].x, y: w[k].y + 0.45 * Math.cos(s), z: w[k].z + 0.45 * Math.sin(s) };
  };
  leg(23, 25, 27, supportFlex);
  leg(24, 26, 28, kickFlex, thigh);
  for (const [heel, toe, ank] of [[29, 31, 27], [30, 32, 28]]) {
    w[heel] = { x: w[ank].x, y: w[ank].y + 0.05, z: w[ank].z + 0.05 };
    w[toe] = { x: w[ank].x, y: w[ank].y + 0.07, z: w[ank].z - 0.15 };
  }
  return w;
}

// 2D piksel iskeleti (buildTrack'in kişi seçimi/takibi için): tüm karelerde aynı, hareketsiz.
// pickKicker (en uzun boylu) ve takip (kalçaya en yakın, boy oranı ~1) bu tek kişiyi seçsin diye
// yeterli — gerçek koordinatların kendisi puanı etkilemez, o sadece world'den hesaplanır.
function person2d() {
  const p = new Array(33).fill(0).map(() => ({ x: 100, y: 100 }));
  p[23] = { x: 90, y: 200 }; p[24] = { x: 110, y: 200 };
  p[25] = { x: 88, y: 260 }; p[26] = { x: 112, y: 260 };
  p[27] = { x: 86, y: 320 }; p[28] = { x: 114, y: 320 };
  return p;
}

// world verilirse 2D iskelete .world özelliği eklenir (contactPosture bunu okur); verilmezse
// (undefined) iskelette 3D bilgi yok — "3D iskelet çıkmadı" durumunu simüle eder.
function person(world) {
  return world ? Object.assign(person2d(), { world }) : person2d();
}

// contact karesinin etrafında (contactPosture varsayılan ±2 pencere) hareketsiz bir vuruş kurar.
function makeKick({ contact = 2, total = 5, world, t = 1.23 } = {}) {
  const frames = [];
  for (let i = 0; i < total; i++) frames.push({ t: i / 30, people: [person(world)] });
  return { frames, contact, rest: { x: 50, y: 50, w: 5 }, t };
}

const REF_FOOT = 'right';
const refPosture = posture3d(body({ supportFlex: 30, kickFlex: 50 }), REF_FOOT);
const ref = { foot: REF_FOOT, posture: refPosture };

test('scoreKick: referansla birebir aynı postür → total 100, items dolu', () => {
  const kick = makeKick({ world: body({ supportFlex: 30, kickFlex: 50 }) });
  const r = scoreKick(kick, REF_FOOT, ref);
  assert.equal(r.t, kick.t);
  assert.equal(r.total, 100);
  assert.ok(r.items.length > 0);
});

test('scoreKick: frame\'lerde world yoksa (3D iskelet çıkmadı) total null, items boş', () => {
  const kick = makeKick({ world: undefined });
  const r = scoreKick(kick, REF_FOOT, ref);
  assert.equal(r.t, kick.t);
  assert.equal(r.total, null);
  assert.deepEqual(r.items, []);
});

// --- summarizeSession: sentetik scoreKick çıktılarıyla (gerçek scoreKick'e gerek yok) ---

function item(key, score, diff) {
  return { key, score, diff };
}

test('summarizeSession: boş girdi', () => {
  const s = summarizeSession([]);
  assert.deepEqual(s, { count: 0, scored: 0, unscored: 0, avg: null, best: null, worst: null, issues: [] });
});

test('summarizeSession: avg/best/worst/unscored doğru hesaplanır', () => {
  const results = [
    { t: 1, total: 80, items: [] },
    { t: 2, total: 90, items: [] },
    { t: 3, total: null, items: [] },
  ];
  const s = summarizeSession(results);
  assert.equal(s.count, 3);
  assert.equal(s.scored, 2);
  assert.equal(s.unscored, 1);
  assert.equal(s.avg, 85);
  assert.equal(s.best.t, 2);
  assert.equal(s.best.total, 90);
  assert.equal(s.worst.t, 1);
  assert.equal(s.worst.total, 80);
});

test('summarizeSession: best/worst eşitlikte en erken t kazanır', () => {
  const results = [
    { t: 5, total: 70, items: [] },
    { t: 2, total: 70, items: [] },
    { t: 8, total: 70, items: [] },
  ];
  const s = summarizeSession(results);
  assert.equal(s.best.t, 2);
  assert.equal(s.worst.t, 2);
});

test('summarizeSession: issue eşiği n>=2, n=1 dahil edilmez', () => {
  const results = [
    { t: 1, total: 60, items: [item('supportKnee', 50, -15)] },
    { t: 2, total: 65, items: [item('supportKnee', 40, -20)] },
    { t: 3, total: 90, items: [item('kickKnee', 70, 10)] }, // sadece 1 kere, dahil edilmemeli
  ];
  const s = summarizeSession(results);
  assert.equal(s.issues.length, 1);
  assert.equal(s.issues[0].key, 'supportKnee');
  assert.equal(s.issues[0].n, 2);
  assert.equal(s.issues[0].of, 3);
  assert.equal(s.issues[0].direction, 'less');
});

test('summarizeSession: yön çoğunluğa göre (more/less), eşitlikte mixed', () => {
  const more = summarizeSession([
    { t: 1, total: 50, items: [item('armOpen', 40, 20)] },
    { t: 2, total: 50, items: [item('armOpen', 40, 25)] },
    { t: 3, total: 50, items: [item('armOpen', 40, -5)] },
  ]);
  assert.equal(more.issues[0].direction, 'more');

  const mixed = summarizeSession([
    { t: 1, total: 50, items: [item('armOpen', 40, 20)] },
    { t: 2, total: 50, items: [item('armOpen', 40, -20)] },
  ]);
  assert.equal(mixed.issues[0].direction, 'mixed');
});

test('summarizeSession: en fazla 3 issue, n desc sonra POSTURE_KEYS sırasına göre', () => {
  const items = (scores) => POSTURE_KEYS.map((k, i) => item(k, scores[i], -10));
  const results = [
    { t: 1, total: 40, items: items([50, 50, 50, 50, 50, 50]) },
    { t: 2, total: 40, items: items([50, 50, 50, 50, 50, 50]) },
    { t: 3, total: 40, items: items([50, 50, 100, 50, 100, 50]) }, // kickHip, trunkSide bu turda temiz
  ];
  const s = summarizeSession(results);
  assert.equal(s.issues.length, 3);
  // n: supportKnee=3, kickKnee=3, trunkLean=3, armOpen=3 (4 aday, n eşit) → POSTURE_KEYS sırasına göre ilk 3
  assert.deepEqual(s.issues.map((i) => i.key), ['supportKnee', 'kickKnee', 'trunkLean']);
  assert.ok(s.issues.every((i) => i.n === 3));
});

test('issueSentence: yön cümleye doğru yansır', () => {
  const less = { key: 'supportKnee', label: 'Destek dizi', n: 7, of: 10, direction: 'less' };
  assert.equal(issueSentence(less), "Destek dizi: 7/10 vuruşta Messi'den farklı, çoğunlukla daha düz.");
  const more = { ...less, direction: 'more' };
  assert.equal(issueSentence(more), "Destek dizi: 7/10 vuruşta Messi'den farklı, çoğunlukla daha bükük.");
  const mixed = { ...less, direction: 'mixed' };
  assert.equal(issueSentence(mixed), "Destek dizi: 7/10 vuruşta Messi'den farklı, iki yönde de.");
});

test('issueSentence: etiketteki parantez atılır, yön ölçüye özgü', () => {
  const s = issueSentence({ key: 'kickHip', label: 'Vuran uyluk (+ önde)', n: 2, of: 3, direction: 'less' });
  assert.equal(s, "Vuran uyluk: 2/3 vuruşta Messi'den farklı, uyluk çoğunlukla daha geride.");
});

test('scoreKick: seed verilirse o kişi puanlanır (raporla aynı kişi)', () => {
  const w = body({ supportFlex: 30 });
  const other = body({ supportFlex: 0 });
  const mk = (a, b) => [Object.assign(a.map(() => ({ x: 100, y: 100, v: 1 })), { world: a }), Object.assign(b.map(() => ({ x: 900, y: 100, v: 1 })), { world: b })];
  const frames = [0, 1, 2, 3, 4].map(() => ({ t: 0, people: mk(w, other) }));
  const kick = { frames, contact: 2, rest: { x: 100, y: 100 }, t: 0 };
  const ref = { foot: 'right', posture: scoreKick(kick, 'right', { foot: 'right', posture: { supportKnee: 30, kickKnee: 45, kickHip: 0, trunkLean: 0, trunkSide: 0, armOpen: 0 } }).items.reduce((o, i) => ({ ...o, [i.key]: i.value }), {}) };
  const auto = scoreKick(kick, 'right', ref);
  const picked = scoreKick(kick, 'right', ref, frames[2].people[1]);
  assert.equal(auto.total, 100);
  assert.ok(picked.total < auto.total, `seçilen başka kişi farklı puan almalı: ${picked.total}`);
});
