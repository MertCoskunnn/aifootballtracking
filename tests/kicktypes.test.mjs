// tests/kicktypes.test.mjs — cp-13-vurus-turleri: plase modu, hareketli top bağlamı, drill alanı.
// coach.js/metrics.js/context.js'i doğrudan test eder, gerçek video ya da MediaPipe gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../coach.js';
import { measure, LM } from '../metrics.js';
import { detectMovingBall, MOVING_BALL_DIAM_PER_SEC } from '../context.js';

// --- referans ölçüm nesneleri: her modun RULES ideal aralığının tam ortasında (her madde 100 alır) ---
const GOOD_SHOT = {
  supportOffset: -0.25, trunk: -7.5, supportKnee: 30, backswing: 107.5,
  kickKnee: 45, armOpen: 72.5, followHip: 95,
};
const GOOD_PASS = {
  supportOffset: -0.05, trunk: -1, backswing: 70, followRise: 0.25, supportKnee: 30,
};
const GOOD_FREEKICK = {
  supportLateral: 0.225, crossing: 0.65, trunkLateral: 13.5, backswing: 107.5, approachAngle: 35,
};
const GOOD_PLACEMENT = {
  supportOffset: -0.05, trunk: -1, supportKnee: 30, backswing: 85, followHip: 72.5,
  kneeAngVelRatio: 3,
};

// === 1. Plase kural seti ve puanlama ===

test('coach: iyi plase ~100 alır ve hoca "plase" der', () => {
  const res = evaluate(GOOD_PLACEMENT, 'placement');
  assert.ok(res.total >= 98, `total ${res.total} beklenenden düşük`);
  assert.match(res.verdict, /plase/);
});

test('coach: kötü plase (destek ayağı önde, gövde geride) düşük alır ve PL2 odakta çıkar', () => {
  const bad = { ...GOOD_PLACEMENT, supportOffset: 0.5, trunk: -35 };
  const res = evaluate(bad, 'placement');
  assert.ok(res.total < 60, `total ${res.total} beklenenden yüksek`);
  assert.ok(res.focus.some((f) => f.ref === 'PL2'), 'odak listesi PL2\'yi içermiyor');
});

// === 2. info kuralının (PL4 diz açısal hızı oranı) puana girmemesi ===

test('coach: placement kneeAngVelRatio bilgi olarak gösterilir, toplamı etkilemez', () => {
  const resBase = evaluate(GOOD_PLACEMENT, 'placement');
  const resHigh = evaluate({ ...GOOD_PLACEMENT, kneeAngVelRatio: 9999 }, 'placement');
  const resLow = evaluate({ ...GOOD_PLACEMENT, kneeAngVelRatio: 0 }, 'placement');
  assert.equal(resBase.total, resHigh.total, 'kneeAngVelRatio değeri toplamı değiştirmemeli');
  assert.equal(resBase.total, resLow.total, 'kneeAngVelRatio değeri toplamı değiştirmemeli');
  const item = resHigh.items.find((i) => i.key === 'kneeAngVelRatio');
  assert.equal(item.score, null);
  assert.match(item.shown, /bilgi/);
  assert.ok(!resHigh.focus.some((f) => f.key === 'kneeAngVelRatio'), 'info kuralı odak listesine giremez');
});

test('coach: kneeAngVelRatio NaN ise "ölçülemedi" gösterir', () => {
  const res = evaluate({ ...GOOD_PLACEMENT, kneeAngVelRatio: NaN }, 'placement');
  const item = res.items.find((i) => i.key === 'kneeAngVelRatio');
  assert.equal(item.shown, 'ölçülemedi');
  assert.equal(item.score, null);
});

// === 3. detectMovingBall: duran/sürülen top sahte izleri ===

function stillBallFrames(n, pos) {
  return Array.from({ length: n }, (_, i) => ({ t: i / 30, balls: [{ x: pos.x, y: pos.y, w: pos.w, s: 0.9 }] }));
}
function rollingBallFrames(n, start, stepPerFrame, w) {
  return Array.from({ length: n }, (_, i) => ({ t: i / 30, balls: [{ x: start.x + stepPerFrame * i, y: start.y, w, s: 0.9 }] }));
}

test('detectMovingBall: duran top (kayma yok) hareketli sayılmaz', () => {
  const contact = 20;
  const frames = stillBallFrames(30, { x: 100, y: 100, w: 20 });
  const kick = { contact, rest: { x: 100, y: 100, w: 20 } };
  const res = detectMovingBall(frames, kick, 30);
  assert.equal(res.movingBall, false);
  assert.ok(res.ballSpeed < MOVING_BALL_DIAM_PER_SEC);
});

test('detectMovingBall: sürülen top (kare başına ~0.3 çap, detect.js\'in gerçek veri notuyla aynı) hareketli sayılır', () => {
  const contact = 20;
  const w = 20;
  const frames = rollingBallFrames(30, { x: 0, y: 100 }, 0.3 * w, w);
  const kick = { contact, rest: { x: frames[contact].balls[0].x, y: 100, w } };
  const res = detectMovingBall(frames, kick, 30);
  assert.equal(res.movingBall, true);
  assert.ok(res.ballSpeed > MOVING_BALL_DIAM_PER_SEC, `ballSpeed ${res.ballSpeed} eşiğin altında kaldı`);
});

test('detectMovingBall: top izi bulunamazsa (top hiç görünmüyor) duran top varsayılır', () => {
  const frames = Array.from({ length: 25 }, (_, i) => ({ t: i / 30, balls: [] }));
  const kick = { contact: 20, rest: { x: 100, y: 100, w: 20 } };
  const res = detectMovingBall(frames, kick, 30);
  assert.equal(res.movingBall, false);
  assert.equal(res.ballSpeed, null); // ölçülemedi: "duruyor" (0) ile karıştırılmasın
});

// === 4. Hareketli topta H1/H3 aralıklarının uygulanması (shot + placement) ===

test('coach: hareketli top bağlamında shot supportOffset (H1) aralığı genişler', () => {
  const m = { ...GOOD_SHOT, supportOffset: -0.5 }; // duran top idealinin ([-0.45,-0.05]) dışında
  const stationary = evaluate(m, 'shot');
  const moving = evaluate(m, 'shot', { movingBall: true });
  const scoreOf = (res) => res.items.find((i) => i.key === 'supportOffset').score;
  assert.ok(scoreOf(stationary) < 100, 'duran top varsayımıyla -0.5 ideal dışında olmalı');
  assert.equal(scoreOf(moving), 100, 'hareketli top idealinde ([-0.55,-0.05]) -0.5 tam içeride olmalı');
  assert.ok(moving.total > stationary.total);
  assert.equal(moving.movingBall, true);
  assert.equal(stationary.movingBall, false);
});

test('coach: hareketli topta shot backswing (H3) aralığı [70,115]e kayar (hem alttan hem üstten)', () => {
  const low = { ...GOOD_SHOT, backswing: 75 }; // duran top idealinin ([85,130]) altında
  const lowStationary = evaluate(low, 'shot');
  const lowMoving = evaluate(low, 'shot', { movingBall: true });
  assert.ok(lowStationary.items.find((i) => i.key === 'backswing').score < 100);
  assert.equal(lowMoving.items.find((i) => i.key === 'backswing').score, 100);

  const high = { ...GOOD_SHOT, backswing: 120 }; // duran top idealinde ([85,130]) ama yeni üst sınırın (115) üstünde
  const highStationary = evaluate(high, 'shot');
  const highMoving = evaluate(high, 'shot', { movingBall: true });
  assert.equal(highStationary.items.find((i) => i.key === 'backswing').score, 100);
  assert.ok(highMoving.items.find((i) => i.key === 'backswing').score < 100, 'hareketli top bağlamında kurma aralığı daralmalı');
});

test('coach: hareketli top bağlamında placement supportOffset/backswing aralığı genişler', () => {
  // supportOffset: -0.3 duran top idealinin ([-0.2,0.1]) dışında, hareketli top idealinde ([-0.35,0.1]) içeride.
  // backswing: 112 duran top idealinde ([60,110]) değil (üst sınırın az üstü), hareketli top idealinde ([70,115]) içeride.
  const m = { ...GOOD_PLACEMENT, supportOffset: -0.3, backswing: 112 };
  const stationary = evaluate(m, 'placement');
  const moving = evaluate(m, 'placement', { movingBall: true });
  assert.ok(stationary.items.find((i) => i.key === 'supportOffset').score < 100);
  assert.equal(moving.items.find((i) => i.key === 'supportOffset').score, 100, 'yeni placement ideali [-0.35,0.1] -0.3\'ü kapsamalı');
  assert.ok(stationary.items.find((i) => i.key === 'backswing').score < 100);
  assert.equal(moving.items.find((i) => i.key === 'backswing').score, 100, 'yeni placement kurma ideali [70,115] 112\'yi kapsamalı');
});

test('coach: pass/freekick modlarında movingBall bağlamı kuralları değiştirmez (RESEARCH: bu modlar için H bulgusu yok)', () => {
  const passStationary = evaluate(GOOD_PASS, 'pass');
  const passMoving = evaluate(GOOD_PASS, 'pass', { movingBall: true });
  assert.equal(passStationary.total, passMoving.total);
  assert.equal(passMoving.movingBall, false);

  const fkStationary = evaluate(GOOD_FREEKICK, 'freekick');
  const fkMoving = evaluate(GOOD_FREEKICK, 'freekick', { movingBall: true });
  assert.equal(fkStationary.total, fkMoving.total);
  assert.equal(fkMoving.movingBall, false);
});

// === Regresyon: context verilmezse (ya da movingBall false ise) duran topta puanlar değişmemeli ===

test('coach: context verilmez ya da movingBall false ise shot/pass/freekick/placement puanları aynı kalır (regresyon)', () => {
  const cases = [[GOOD_SHOT, 'shot'], [GOOD_PASS, 'pass'], [GOOD_FREEKICK, 'freekick'], [GOOD_PLACEMENT, 'placement']];
  for (const [m, mode] of cases) {
    const noContext = evaluate(m, mode);
    const undefinedContext = evaluate(m, mode, undefined);
    const falseContext = evaluate(m, mode, { movingBall: false });
    assert.equal(noContext.total, undefinedContext.total, `${mode}: context yokken/undefined farklı`);
    assert.equal(noContext.total, falseContext.total, `${mode}: movingBall:false farklı`);
    assert.ok(noContext.total >= 98, `${mode}: iyi ölçüm ~100 almalı, geldi ${noContext.total}`);
    assert.equal(noContext.movingBall, false);
  }
});

// === 5. drill'in focus'a gelmesi (her modda) ===

test('coach: odak maddelerinde drill alanı dolu gelir (shot, pass, freekick, placement)', () => {
  const cases = [
    [{ ...GOOD_SHOT, trunk: -45, supportOffset: 0.4 }, 'shot'],
    [{ ...GOOD_PASS, trunk: -30 }, 'pass'],
    [{ ...GOOD_FREEKICK, trunkLateral: -20 }, 'freekick'],
    [{ ...GOOD_PLACEMENT, backswing: 200, trunk: -40 }, 'placement'],
  ];
  for (const [m, mode] of cases) {
    const res = evaluate(m, mode);
    assert.ok(res.focus.length > 0, `${mode}: odak listesi boş`);
    for (const f of res.focus) {
      assert.equal(typeof f.drill, 'string', `${mode}/${f.key}: drill alanı yok`);
      assert.ok(f.drill.length > 5, `${mode}/${f.key}: drill çok kısa`);
    }
  }
});

// === 6. kneeAngVelRatio hesabı (metrics.js measure()) ===

// buildPose: metrics.test.mjs'teki sahte-vücut üreticisiyle aynı sözleşme (kasıtlı tekrar, her
// test dosyası kendi üreticisini tutuyor — bkz. phases.test.mjs, freekick.test.mjs).
function buildPose({ hipX, hipY = 500, dir = 1, trunk = 0, supportKnee = 30, kickKnee = 20, side = 'right', L1 = 50, L2 = 50, hipWidth = 20, shoulderWidth = 30, trunkHeight = 80 }) {
  const sup = side === 'right' ? 'left' : 'right';
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hipCenter = { x: hipX, y: hipY };
  const trunkRad = (trunk * Math.PI) / 180;
  const shoulderCenter = { x: hipCenter.x + dir * trunkHeight * Math.tan(trunkRad), y: hipCenter.y - trunkHeight };
  p[LM.hip.left] = { x: hipCenter.x - hipWidth / 2, y: hipCenter.y };
  p[LM.hip.right] = { x: hipCenter.x + hipWidth / 2, y: hipCenter.y };
  p[LM.shoulder.left] = { x: shoulderCenter.x - shoulderWidth / 2, y: shoulderCenter.y };
  p[LM.shoulder.right] = { x: shoulderCenter.x + shoulderWidth / 2, y: shoulderCenter.y };
  const leg = (kneeLm, ankleLm, toeLm, heelLm, hipPoint, flexDeg) => {
    const th = (flexDeg * Math.PI) / 180;
    const knee = { x: hipPoint.x, y: hipPoint.y + L1 };
    const ankle = { x: knee.x + L2 * Math.sin(th), y: knee.y + L2 * Math.cos(th) };
    p[kneeLm] = knee;
    p[ankleLm] = ankle;
    p[toeLm] = { x: ankle.x + dir * 15, y: ankle.y + 5 };
    p[heelLm] = { x: ankle.x - dir * 10, y: ankle.y + 3 };
  };
  leg(LM.knee[sup], LM.ankle[sup], LM.toe[sup], LM.heel[sup], p[LM.hip[sup]], supportKnee);
  leg(LM.knee[side], LM.ankle[side], LM.toe[side], LM.heel[side], p[LM.hip[side]], kickKnee);
  p[LM.wrist[sup]] = { x: p[LM.shoulder[sup]].x + dir * 30, y: p[LM.shoulder[sup]].y + 40 };
  p[LM.wrist[side]] = { x: p[LM.shoulder[side]].x - dir * 30, y: p[LM.shoulder[side]].y + 40 };
  return p;
}

test('metrics: kneeAngVelRatio - vuran dizin açısal hızının kalça yatay hızına oranı', () => {
  const fps = 30, contact = 20, side = 'right';
  // Destek bacağı (leg = L1+L2 = 100) sabit hızda kayıyor: 5 px/kare → 1.5 bacak-boyu/sn.
  // Vuran diz temas karesinde 20°'den 80°'ye sıçrıyor (60° tek karede) → 60*30 = 1800°/sn.
  // Beklenen oran: 1800 / 1.5 = 1200.
  const hipXAt = (i) => 1000 - 5 * (contact - Math.min(i, contact));
  const kickKneeAt = (i) => (i < contact ? 20 : 80);
  const frames = [];
  for (let i = 0; i < 40; i++) {
    frames.push(buildPose({ hipX: hipXAt(i), dir: 1, side, supportKnee: 30, kickKnee: kickKneeAt(i) }));
  }
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, side, fps);
  assert.ok(Number.isFinite(m.kneeAngVelRatio), 'kneeAngVelRatio hesaplanmalı');
  assert.ok(Math.abs(m.kneeAngVelRatio - 1200) < 1e-6, `beklenen ~1200, gelen ${m.kneeAngVelRatio}`);
});

test('metrics: kneeAngVelRatio - temas öncesi pencere yoksa (veri eksik) NaN döner', () => {
  const side = 'right';
  const frames = [buildPose({ hipX: 1000, dir: 1, side, kickKnee: 30 })];
  const ball = { x: frames[0][LM.ankle.left].x, y: frames[0][LM.ankle.left].y };
  const m = measure(frames, 0, ball, side, 30);
  assert.ok(Number.isNaN(m.kneeAngVelRatio));
});
