// tests/plausible.test.mjs — cp-14c-makul-aralik: metrics.js'teki PLAUSIBLE filtresi.
// İskelet yanlış okununca çıkan fizyolojik olarak İMKANSIZ değerlerin NaN'a çevrildiğini,
// sınır içindeki kötü tekniğin (düşük puan ama makul) etkilenmediğini doğrular.
// Gerçek örnekler test-videolar/referans/SONUCLAR.md'den: destek dizi 117°, gövde -85°,
// frikikte gövde yana yatışı 94°, destek ayağı topa 1.96 bacak uzak.
import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, measureFreeKick, LM, PLAUSIBLE } from '../metrics.js';

// --- yardımcı: metrics.test.mjs'teki ile aynı sözleşmeli sahte vücut üreticisi (kasıtlı tekrar) ---
function buildPose({
  hipX,
  hipY = 500,
  dir = 1,
  trunk = 0,
  supportKnee = 30,
  kickKnee = 20,
  side = 'right',
  L1 = 50,
  L2 = 50,
  hipWidth = 20,
  shoulderWidth = 30,
  trunkHeight = 80,
  heelOffset = 0,
}) {
  const sup = side === 'right' ? 'left' : 'right';
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hipCenter = { x: hipX, y: hipY };
  const trunkRad = (trunk * Math.PI) / 180;
  const shoulderCenter = {
    x: hipCenter.x + dir * trunkHeight * Math.tan(trunkRad),
    y: hipCenter.y - trunkHeight,
  };
  p[LM.hip.left] = { x: hipCenter.x - hipWidth / 2, y: hipCenter.y };
  p[LM.hip.right] = { x: hipCenter.x + hipWidth / 2, y: hipCenter.y };
  p[LM.shoulder.left] = { x: shoulderCenter.x - shoulderWidth / 2, y: shoulderCenter.y };
  p[LM.shoulder.right] = { x: shoulderCenter.x + shoulderWidth / 2, y: shoulderCenter.y };
  const leg = (kneeLm, ankleLm, toeLm, heelLm, hipPoint, flexDeg, heelOff = 0) => {
    const th = (flexDeg * Math.PI) / 180;
    const knee = { x: hipPoint.x, y: hipPoint.y + L1 };
    const ankle = { x: knee.x + L2 * Math.sin(th), y: knee.y + L2 * Math.cos(th) };
    p[kneeLm] = knee;
    p[ankleLm] = ankle;
    p[toeLm] = { x: ankle.x + dir * 15, y: ankle.y + 5 };
    p[heelLm] = { x: ankle.x - dir * 10 + heelOff, y: ankle.y + 3 };
  };
  leg(LM.knee[sup], LM.ankle[sup], LM.toe[sup], LM.heel[sup], p[LM.hip[sup]], supportKnee, heelOffset);
  leg(LM.knee[side], LM.ankle[side], LM.toe[side], LM.heel[side], p[LM.hip[side]], kickKnee);
  p[LM.wrist[sup]] = { x: p[LM.shoulder[sup]].x + dir * 30, y: p[LM.shoulder[sup]].y + 40 };
  p[LM.wrist[side]] = { x: p[LM.shoulder[side]].x - dir * 30, y: p[LM.shoulder[side]].y + 40 };
  return p;
}

function buildTrackSequence({ contact = 20, total = 30, step = 6, ...pose }) {
  const frames = [];
  for (let i = 0; i < total; i++) {
    const hipX = pose.hipX + pose.dir * (i - contact) * step;
    frames.push(buildPose({ ...pose, hipX }));
  }
  return frames;
}

// --- yardımcı: freekick.test.mjs'teki ile aynı sözleşmeli arkadan-çekim sahte vücut üreticisi ---
function buildFKPose({ hipX, hipY, mirror, side, trunk = 0, kickKnee = 20, supportAnkle, kickAnkleX, kickAnkleY }) {
  const sup = side === 'right' ? 'left' : 'right';
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hipCenter = { x: hipX, y: hipY };
  const trunkHeight = 80;
  const trunkRad = (trunk * Math.PI) / 180;
  const shoulderCenter = { x: hipCenter.x + mirror * trunkHeight * Math.tan(trunkRad), y: hipCenter.y - trunkHeight };
  p[LM.hip.left] = hipCenter;
  p[LM.hip.right] = hipCenter;
  p[LM.shoulder.left] = { x: shoulderCenter.x - 15, y: shoulderCenter.y };
  p[LM.shoulder.right] = { x: shoulderCenter.x + 15, y: shoulderCenter.y };
  p[LM.ankle[sup]] = supportAnkle;
  p[LM.knee[sup]] = { x: (hipCenter.x + supportAnkle.x) / 2, y: (hipCenter.y + supportAnkle.y) / 2 };
  p[LM.toe[sup]] = { x: supportAnkle.x, y: supportAnkle.y + 5 };
  const th = (kickKnee * Math.PI) / 180;
  const knee = { x: hipCenter.x, y: hipCenter.y + 50 };
  const defaultAnkle = { x: knee.x + 50 * Math.sin(th), y: knee.y + 50 * Math.cos(th) };
  p[LM.knee[side]] = knee;
  p[LM.ankle[side]] = kickAnkleX !== undefined ? { x: kickAnkleX, y: kickAnkleY ?? defaultAnkle.y } : defaultAnkle;
  p[LM.toe[side]] = { x: p[LM.ankle[side]].x, y: p[LM.ankle[side]].y + 5 };
  p[LM.wrist[sup]] = { x: p[LM.shoulder[sup]].x, y: p[LM.shoulder[sup]].y + 40 };
  p[LM.wrist[side]] = { x: p[LM.shoulder[side]].x, y: p[LM.shoulder[side]].y + 40 };
  return p;
}

// === supportKnee: sınır dışı (117°, gerçek veride görülen) NaN olmalı ===
test('measure: sınır dışı destek dizi (117°, gerçek veride görülen) NaN olur ve filtered listelenir', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 117, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.supportKnee), `supportKnee NaN olmalıydı: ${m.supportKnee}`);
  assert.ok(m.filtered.includes('supportKnee'), `filtered listesi supportKnee içermeli: ${m.filtered}`);
});

// === supportKnee: sınır İÇİNDE kötü teknik (70°, kötü ama makul) NaN OLMAMALI ===
test('measure: sınır içi kötü teknik (destek dizi 70°) NaN olmaz, sadece düşük puan alır', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 70, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isFinite(m.supportKnee), `supportKnee ölçülebilmeliydi: ${m.supportKnee}`);
  assert.ok(Math.abs(m.supportKnee - 70) <= 2, `supportKnee ${m.supportKnee}`);
  assert.ok(!m.filtered.includes('supportKnee'), 'sınır içi değer filtered listesine girmemeli');
});

// === trunk: sınır dışı (-85°, gerçek veride görülen) NaN olmalı, diğer ölçümler etkilenmemeli ===
test('measure: sınır dışı gövde açısı (-85°, gerçek veride görülen) NaN olur, ilgisiz ölçümler etkilenmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: -85, supportKnee: 30, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.trunk), `trunk NaN olmalıydı: ${m.trunk}`);
  assert.ok(m.filtered.includes('trunk'), `filtered listesi trunk içermeli: ${m.filtered}`);
  assert.ok(Number.isFinite(m.supportKnee), 'ilgisiz ölçüm (supportKnee) etkilenmemeli');
});

// === birden fazla anahtar aynı anda filtrelenince filtered listesi ikisini de içerir ===
test('measure: birden fazla sınır dışı ölçüm aynı anda filtrelenir ve filtered listesi ikisini de içerir', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: -85, supportKnee: 117, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.trunk));
  assert.ok(Number.isNaN(m.supportKnee));
  assert.ok(m.filtered.includes('trunk'));
  assert.ok(m.filtered.includes('supportKnee'));
  assert.equal(m.filtered.length, 2, `filtered sadece 2 anahtar içermeli: ${m.filtered}`);
});

// === zaten NaN olan (görünürlük yüzünden) bir ölçüm filtered listesine girmemeli ===
// (Number.isFinite(NaN) === false, applyPlausible sadece SONLU ve aralık dışı değerleri filtreler)
test('measure: görünürlük yüzünden zaten NaN olan ölçüm filtered listesine girmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.heel.left] = { ...p[LM.heel.left], v: 0.1 }; // destek topuk görünmüyor -> supportOffset zaten NaN
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.supportOffset));
  assert.ok(!m.filtered.includes('supportOffset'), 'zaten NaN olan ölçüm filtered listesine girmemeli');
});

// === kneeAngVelRatio: bilgi amaçlı, PLAUSIBLE tablosunda yok, hiç filtrelenmez ===
test('measure: kneeAngVelRatio PLAUSIBLE filtresine tabi değil (bilgi amaçlı, dokunulmaz)', () => {
  assert.equal(PLAUSIBLE.kneeAngVelRatio, undefined, 'kneeAngVelRatio PLAUSIBLE tablosunda olmamalı');
});

// === Messi/Mert referans değerleri PLAUSIBLE içinde kalmalı (mevcut 89 test regresyon güvencesi) ===
test('PLAUSIBLE: gerçek referans veri aralıkları (Messi/Mert) tablonun içinde kalır', () => {
  const within = (v, [lo, hi]) => v >= lo && v <= hi;
  assert.ok(within(-2, PLAUSIBLE.trunk) && within(2, PLAUSIBLE.trunk), 'Ş3 -2..2° trunk aralığında olmalı');
  assert.ok(within(107, PLAUSIBLE.backswing) && within(128, PLAUSIBLE.backswing), 'Ş4 107-128° backswing aralığında olmalı');
  assert.ok(within(58, PLAUSIBLE.followHip) && within(104, PLAUSIBLE.followHip), 'Ş8 58-104° followHip aralığında olmalı');
  assert.ok(within(44, PLAUSIBLE.armOpen) && within(81, PLAUSIBLE.armOpen), 'Ş7 44-81° armOpen aralığında olmalı');
  assert.ok(within(-0.64, PLAUSIBLE.supportOffset) && within(-0.55, PLAUSIBLE.supportOffset), 'Ş1 -0.64..-0.55 supportOffset aralığında olmalı');
  assert.ok(within(13, PLAUSIBLE.supportKnee) && within(26, PLAUSIBLE.supportKnee), 'Ş2 13-26° supportKnee aralığında olmalı');
});

// === Frikik: sınır dışı gövde yana yatışı (~96°, gerçek veride F3=94° görülen) NaN olmalı ===
// trunkLateral = atan2(trunkDx, trunkUp) formülünün geometrik sınırı ±90°'dir (trunkUp = hip.y-sh.y
// normalde pozitif). Gerçek veride 94° gibi bunu aşan bir değer ancak omuz-kalça okuması ters dönmüş
// (trunkUp negatif, omuz kalçanın "altında" okunmuş) gibi bozuk bir iskelette çıkar — bu yüzden burada
// trunk parametresi yerine temas karesinin omuz noktalarını doğrudan bu bozuk geometriyle kuruyoruz.
test('measureFreeKick: sınır dışı gövde yana yatışı (~96°, gerçek veride görülen türden) NaN olur', () => {
  const side = 'right';
  const mirror = 1;
  const contact = 20;
  const total = 36;
  const baseX = 900;
  const baseY = 600;
  const supportAnkleX = baseX - mirror * 15;
  const supportAnkle = { x: supportAnkleX, y: baseY + Math.sqrt(10000 - (supportAnkleX - baseX) ** 2) };
  const ball = { x: baseX, y: baseY + 60 };
  const frames = [];
  for (let i = 0; i < total; i++) {
    const k = contact - i;
    const hip = k > 0 ? { x: baseX - mirror * k * 4, y: baseY + k * 8 } : { x: baseX, y: baseY };
    let override;
    if (i === contact) override = { x: hip.x, y: hip.y + 100 };
    else if (i > contact) override = { x: supportAnkleX - mirror * 60, y: baseY + 20 };
    frames.push(buildFKPose({
      hipX: hip.x, hipY: hip.y, mirror, side,
      trunk: 15, kickKnee: 110, supportAnkle,
      kickAnkleX: override?.x, kickAnkleY: override?.y,
    }));
  }
  // Temas karesinde omuz-kalça geometrisini bozuk bir okumayla değiştir: omuz kalçanın "altında"
  // (trunkUp = hip.y - sh.y = -20 < 0) ve yanal olarak çok kaymış (trunkDx = 200) -> atan2(200,-20) ≈ 95.7°.
  const p = frames[contact];
  const hipY = p[LM.hip.left].y; // hip.left === hip.right (hipWidth=0 varsayımı, buildFKPose)
  const shY = hipY + 20;
  const shXCenter = baseX - 200; // sh.x - hip.x = -200 -> trunkDx = (sh.x-hip.x)*-mirror = 200
  p[LM.shoulder.left] = { x: shXCenter - 15, y: shY };
  p[LM.shoulder.right] = { x: shXCenter + 15, y: shY };
  const m = measureFreeKick(frames, contact, ball, side);
  assert.ok(Number.isNaN(m.trunkLateral), `trunkLateral NaN olmalıydı: ${m.trunkLateral}`);
  assert.ok(m.filtered.includes('trunkLateral'), `filtered listesi trunkLateral içermeli: ${m.filtered}`);
  assert.ok(Number.isFinite(m.backswing), 'ilgisiz ölçüm (backswing) etkilenmemeli');
});

// === Frikik: destek ayağının topa yanal mesafesi -1.96 bacak (gerçek veride görülen, "anlamsız") NaN olmalı ===
test('measureFreeKick: sınır dışı destek ayağı yanal mesafesi (-1.96 bacak, gerçek veride görülen) NaN olur', () => {
  const side = 'left';
  const mirror = -1;
  const contact = 20;
  const total = 36;
  const baseX = 900;
  const baseY = 600;
  // leg (bacak boyu) = kalça-destek ayak bileği mesafesi = 100 (hip=(900,600), ankle=(800,600)).
  // supportLateral = ((ball.x - ankle.x) * mirror) / leg. -1.96 elde etmek için:
  // ankle.x = hip.x - 100 = 800; ball.x = ankle.x + 196 = 996 (mirror=-1 ile (996-800)*-1/100 = -1.96).
  const supportAnkle = { x: baseX - 100, y: baseY };
  const ball = { x: supportAnkle.x + 196, y: baseY + 60 };
  const frames = [];
  for (let i = 0; i < total; i++) {
    const k = contact - i;
    const hip = k > 0 ? { x: baseX - mirror * k * 4, y: baseY + k * 8 } : { x: baseX, y: baseY };
    let override;
    if (i === contact) override = { x: hip.x, y: hip.y + 100 };
    else if (i > contact) override = { x: supportAnkle.x - mirror * 60, y: baseY + 20 };
    frames.push(buildFKPose({
      hipX: hip.x, hipY: hip.y, mirror, side,
      trunk: -15, kickKnee: 110, supportAnkle,
      kickAnkleX: override?.x, kickAnkleY: override?.y,
    }));
  }
  const m = measureFreeKick(frames, contact, ball, side);
  assert.ok(Math.abs((((ball.x - supportAnkle.x) * mirror) / 100) - (-1.96)) < 1e-9, 'test kurulumu hatalı: beklenen ham değer -1.96 değil');
  assert.ok(Number.isNaN(m.supportLateral), `supportLateral NaN olmalıydı: ${m.supportLateral}`);
  assert.ok(m.filtered.includes('supportLateral'), `filtered listesi supportLateral içermeli: ${m.filtered}`);
});
