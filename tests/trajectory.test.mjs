import test from 'node:test';
import assert from 'node:assert/strict';
import { ballFlight, MAX_MISS, fitFlight, flightAt, flightTrail, flightPath, collectCandidates } from '../trajectory.js';

test('ballFlight: düz giden topu takip eder, yerdeki başka topu almaz', () => {
  const frames = [];
  for (let i = 0; i < 10; i++) frames.push({ balls: [{ x: 100 + i * 20, y: 300 - i * 10 }, { x: 150, y: 310 }] });
  const path = ballFlight(frames, 0, { x: 100, y: 300 }, 40);
  assert.equal(path.length, 10);
  assert.deepEqual(path.at(-1), { i: 9, x: 280, y: 210 });
});

test('ballFlight: kaçırılan kareleri atlar, uzak sıçramayı reddeder', () => {
  const frames = [{ balls: [] }, { balls: [] }, { balls: [{ x: 140, y: 100 }] }, { balls: [{ x: 900, y: 50 }] }];
  const path = ballFlight(frames, 0, { x: 100, y: 100 }, 30);
  assert.deepEqual(path.map((p) => p.i), [0, 2]);
});

test('ballFlight: MAX_MISS kare top yoksa yol biter', () => {
  const frames = [{ balls: [] }];
  for (let i = 0; i < MAX_MISS; i++) frames.push({ balls: [] });
  frames.push({ balls: [{ x: 100, y: 100 }] });
  assert.equal(ballFlight(frames, 0, { x: 100, y: 100 }, 30).length, 1);
});

// --- fitFlight / flightAt / flightTrail / flightPath / collectCandidates ---

test('fitFlight: %30 yanlış tespitli sentetik parabolik uçuşa sağlam eğri oturtur', () => {
  const contactT = 1.0, dt = 0.04, n = 25; // 25 fps, ~1s uçuş
  const trueCoef = { x0: 100, vx: 150, ax: -20, y0: 300, vy: -260, ay: 480 };
  const ballW = 24;
  const trueAt = (tau) => ({
    x: trueCoef.x0 + trueCoef.vx * tau + trueCoef.ax * tau * tau,
    y: trueCoef.y0 + trueCoef.vy * tau + trueCoef.ay * tau * tau,
  });
  const outlierFrames = new Set([2, 5, 8, 11, 14, 17, 20, 23]); // 8/25 = %32, "%30 civarı"
  const points = [];
  for (let i = 0; i < n; i++) {
    const t = contactT + i * dt;
    const tau = i * dt;
    const real = trueAt(tau);
    points.push({ t, x: real.x, y: real.y, w: ballW });
    if (outlierFrames.has(i)) {
      // çift indeks: yerde duran başka top (sabit); tek indeks: bulut/kafa gibi rastgele nokta
      const wrong = i % 2 === 0 ? { x: 520, y: 560 } : { x: 80 + ((i * 37) % 400), y: 40 + ((i * 53) % 120) };
      points.push({ t, x: wrong.x, y: wrong.y, w: ballW });
    }
  }
  const fit = fitFlight(points, contactT);
  assert.ok(fit, 'fit bulunmalı');
  assert.ok(fit.rmsPx < ballW / 2, `rmsPx (${fit.rmsPx}) top çapının yarısından (${ballW / 2}) küçük olmalı`);
  assert.ok(fit.inliers.length >= n - 3, `gerçek noktaların çoğu inlier kalmalı (${fit.inliers.length}/${n})`);
});

test('fitFlight: temastan hemen sonra ayağa yakın yanlış nokta (kanca) eğriyi bozmaz', () => {
  const contactT = 0, dt = 0.04, n = 15;
  const trueCoef = { x0: 200, vx: 180, ax: -15, y0: 350, vy: -300, ay: 520 };
  const trueAt = (tau) => ({
    x: trueCoef.x0 + trueCoef.vx * tau + trueCoef.ax * tau * tau,
    y: trueCoef.y0 + trueCoef.vy * tau + trueCoef.ay * tau * tau,
  });
  const points = [];
  for (let i = 0; i < n; i++) {
    const tau = i * dt;
    const real = trueAt(tau);
    points.push({ t: contactT + tau, x: real.x, y: real.y, w: 22 });
  }
  // temastan bir kare sonra, ayağın hemen yanında kalmış yanlış bir tespit (top hâlâ oradaymış gibi)
  points.push({ t: contactT + dt, x: trueCoef.x0 - 5, y: trueCoef.y0 + 8, w: 22 });

  const fit = fitFlight(points, contactT);
  assert.ok(fit, 'fit bulunmalı');
  assert.equal(fit.inliers.length, n, 'kanca noktası dışarıda kalmalı, gerçek noktalar kalmalı');
  for (const tau of [0, 0.16, 0.32, 0.56]) {
    const got = flightAt(fit, contactT + tau);
    const want = trueAt(tau);
    assert.ok(Math.hypot(got.x - want.x, got.y - want.y) < 3, `τ=${tau}: eğri gerçek yoldan sapmamalı (${JSON.stringify(got)} vs ${JSON.stringify(want)})`);
  }
});

test('fitFlight: yetersiz veri veya dejenere (hepsi aynı τ) durumda null döner', () => {
  assert.equal(fitFlight([{ t: 0, x: 0, y: 0 }], 0), null);
  assert.equal(fitFlight([{ t: 5, x: 0, y: 0 }, { t: 5, x: 1, y: 1 }, { t: 5, x: 2, y: 2 }], 0), null);
});

test('flightTrail: kuyrukta alpha 0\'a yakın, başta 1; genişlik baştan kuyruğa incelir', () => {
  const fit = { coef: { x0: 0, vx: 100, ax: 0, y0: 0, vy: 0, ay: 0 }, contactT: 2, tEnd: 3 };
  const trail = flightTrail(fit, 2.5);
  assert.equal(trail.length, 24);
  assert.equal(trail[0].alpha, 0);
  assert.equal(trail.at(-1).alpha, 1);
  assert.ok(trail[0].width < trail.at(-1).width);
});

test('flightTrail: tNow temas öncesi (veya tam temas anı) ise boş dizi', () => {
  const fit = { coef: { x0: 0, vx: 100, ax: 0, y0: 0, vy: 0, ay: 0 }, contactT: 2, tEnd: 3 };
  assert.deepEqual(flightTrail(fit, 1.0), []);
  assert.deepEqual(flightTrail(fit, 2), []);
});

test('flightTrail: top kadrajdan çıkınca uzatma extendSec\'i geçmez', () => {
  const fit = { coef: { x0: 0, vx: 100, ax: 0, y0: 0, vy: 0, ay: 0 }, contactT: 2, tEnd: 3 };
  const trail = flightTrail(fit, 10, { extendSec: 0.5 });
  const head = trail.at(-1);
  const capped = flightAt(fit, fit.tEnd + 0.5);
  assert.equal(head.x, capped.x);
  assert.equal(head.y, capped.y);
  assert.notEqual(head.x, flightAt(fit, 10).x);
});

test('flightPath: temastan tNow\'a (tEnd\'i aşmadan) kadar sönmeyen tam yol üretir', () => {
  const fit = { coef: { x0: 0, vx: 100, ax: 0, y0: 0, vy: 0, ay: 0 }, contactT: 2, tEnd: 3 };
  const path = flightPath(fit, 2.8);
  assert.ok(path.length > 0);
  assert.deepEqual(path[0], flightAt(fit, fit.contactT));
  assert.deepEqual(path.at(-1), flightAt(fit, 2.8));
  assert.deepEqual(flightPath(fit, 1.0), []); // temas öncesi
});

test('collectCandidates: maxSec penceresi içindeki her karenin TÜM top adaylarını toplar', () => {
  const frames = [
    { t: 0, balls: [{ x: 1, y: 1, w: 10 }, { x: 5, y: 5, w: 9 }] },
    { t: 0.1, balls: [{ x: 2, y: 2, w: 10 }] },
    { t: 2.0, balls: [{ x: 99, y: 99, w: 10 }] }, // pencere dışı
  ];
  const cands = collectCandidates(frames, 0, 1.5);
  assert.equal(cands.length, 3);
  assert.ok(cands.every((c) => 'w' in c));
});
