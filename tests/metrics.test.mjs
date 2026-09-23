// metrics.js testleri: açı hesabı, ölçüm ve oyuncu takibi.
// Sahte (sentetik) iskeletlerle çalışır, gerçek video ya da MediaPipe gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { angleAt, measure, buildTrack, LM } from '../metrics.js';

// --- yardımcı: 33 noktalık sahte bir vücut üretir ---
// hipX/hipY: kalça orta noktası. dir: hareket yönü (+1 sağa, -1 sola).
// trunk: gövdenin dikeyle açısı (Ş3 ile aynı işaret kuralı: + = hareket yönüne öne eğik).
// supportKnee/kickKnee: diz bükülme dereceleri (kneeFlexion ile aynı tanım).
// side: vuran ayak. Diğer taraf otomatik destek ayağı olur.
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
}) {
  const sup = side === 'right' ? 'left' : 'right';
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hipCenter = { x: hipX, y: hipY };
  const trunkRad = (trunk * Math.PI) / 180;
  // Gövde: kalça-omuz dikey mesafesi sabit (trunkHeight), yatay kayma açıyı verir.
  // trunkLean formülü dx=(sh.x-hip.x)*dir, up=hip.y-sh.y kullandığından dir^2=1 sayesinde
  // bu offset yönden bağımsız olarak aynı ölçülen açıyı üretir (aynalanma testi bunu doğrular).
  const shoulderCenter = {
    x: hipCenter.x + dir * trunkHeight * Math.tan(trunkRad),
    y: hipCenter.y - trunkHeight,
  };
  p[LM.hip.left] = { x: hipCenter.x - hipWidth / 2, y: hipCenter.y };
  p[LM.hip.right] = { x: hipCenter.x + hipWidth / 2, y: hipCenter.y };
  p[LM.shoulder.left] = { x: shoulderCenter.x - shoulderWidth / 2, y: shoulderCenter.y };
  p[LM.shoulder.right] = { x: shoulderCenter.x + shoulderWidth / 2, y: shoulderCenter.y };

  // Bacak: uyluk dikey (hip->knee = (0,L1)), baldır knee'den flexDeg kadar sapar.
  // angleAt(hip,knee,ankle) = 180 - flexDeg olacak şekilde (kneeFlexion tanımıyla tutarlı).
  const leg = (kneeLm, ankleLm, toeLm, hipPoint, flexDeg) => {
    const th = (flexDeg * Math.PI) / 180;
    const knee = { x: hipPoint.x, y: hipPoint.y + L1 };
    const ankle = { x: knee.x + L2 * Math.sin(th), y: knee.y + L2 * Math.cos(th) };
    p[kneeLm] = knee;
    p[ankleLm] = ankle;
    p[toeLm] = { x: ankle.x + dir * 15, y: ankle.y + 5 };
  };
  leg(LM.knee[sup], LM.ankle[sup], LM.toe[sup], p[LM.hip[sup]], supportKnee);
  leg(LM.knee[side], LM.ankle[side], LM.toe[side], p[LM.hip[side]], kickKnee);

  p[LM.wrist[sup]] = { x: p[LM.shoulder[sup]].x + dir * 30, y: p[LM.shoulder[sup]].y + 40 };
  p[LM.wrist[side]] = { x: p[LM.shoulder[side]].x - dir * 30, y: p[LM.shoulder[side]].y + 40 };
  return p;
}

// Kalçanın kaydığı bir koşu-yaklaşma dizisi üretir: frames[i] = i'inci karenin tek iskeleti (ya da null).
// contact karesinde istenen ölçümleri, öncesinde de yaklaşma hareketini (dir yönünde) verir.
function buildTrackSequence({ contact = 20, total = 30, step = 6, ...pose }) {
  const frames = [];
  for (let i = 0; i < total; i++) {
    const hipX = pose.hipX + pose.dir * (i - contact) * step;
    frames.push(buildPose({ ...pose, hipX }));
  }
  return frames;
}

test('angleAt: temel açılar', () => {
  // Dik açı: yukarı ve sağa giden iki vektör
  assert.ok(Math.abs(angleAt({ x: 0, y: -1 }, { x: 0, y: 0 }, { x: 1, y: 0 }) - 90) < 1e-6);
  // Düz çizgi: 180 derece
  assert.ok(Math.abs(angleAt({ x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }) - 180) < 1e-6);
  // Üst üste binen vektörler: 0 derece
  assert.ok(Math.abs(angleAt({ x: 1, y: 0 }, { x: 0, y: 0 }, { x: 2, y: 0 })) < 1e-6);
});

test('measure: sağ ayaklı, sağa koşan oyuncu', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y }; // destek ayağın (sol) yanına top
  const m = measure(frames, contact, ball, 'right');

  assert.equal(m.dir, 1);
  assert.ok(Math.abs(m.supportKnee - inputs.supportKnee) <= 2, `supportKnee ${m.supportKnee}`);
  assert.ok(Math.abs(m.trunk - inputs.trunk) <= 2, `trunk ${m.trunk}`);
  assert.ok(Math.abs(m.kickKnee - inputs.kickKnee) <= 2, `kickKnee ${m.kickKnee}`);
});

test('measure: aynalanmış (sola koşan) oyuncu aynı açıları verir', () => {
  const inputs = { hipX: 1000, dir: -1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');

  assert.equal(m.dir, -1);
  assert.ok(Math.abs(m.supportKnee - inputs.supportKnee) <= 2, `supportKnee ${m.supportKnee}`);
  assert.ok(Math.abs(m.trunk - inputs.trunk) <= 2, `trunk ${m.trunk}`);
  assert.ok(Math.abs(m.kickKnee - inputs.kickKnee) <= 2, `kickKnee ${m.kickKnee}`);
});

test('buildTrack: oyuncuyu takip eder, hareketsiz izleyiciyi görmezden gelir', () => {
  const total = 15;
  const contact = 7;
  const step = 5;
  const kickerHipX0 = 800;
  const bystanderHipX = 200; // sahadan uzak, hiç hareket etmiyor

  const frames = [];
  const kickerPoses = [];
  for (let i = 0; i < total; i++) {
    const hipX = kickerHipX0 + (i - contact) * step;
    const kicker = buildPose({ hipX, dir: 1, side: 'right' });
    const bystander = buildPose({ hipX: bystanderHipX, dir: 1, side: 'right' });
    kickerPoses.push(kicker);
    frames.push([bystander, kicker]); // sıra önemsiz, buildTrack topa yakınlığa bakar
  }
  const contactPose = kickerPoses[contact];
  const ball = { x: contactPose[LM.ankle.left].x, y: contactPose[LM.ankle.left].y };

  const track = buildTrack(frames, contact, ball);
  for (let i = 0; i < total; i++) {
    assert.equal(track[i], kickerPoses[i], `kare ${i} oyuncuyu kaçırdı`);
  }
});

// cp-07-otomatik: temas karesinde görünürlüğü düşük (v<0.5) noktalara bağlı ölçüm NaN dönmeli,
// diğer ölçümler etkilenmemeli (metrics.js visOk()).
test('measure: karşı kol görünmezse armOpen NaN olur, diğer ölçümler etkilenmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.wrist.left] = { ...p[LM.wrist.left], v: 0.3 }; // karşı kol (destek taraf) bileği net değil
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.armOpen), `armOpen NaN olmalıydı: ${m.armOpen}`);
  assert.ok(Number.isFinite(m.supportKnee), 'ilgisiz ölçüm etkilenmemeli');
  assert.ok(Number.isFinite(m.trunk), 'ilgisiz ölçüm etkilenmemeli');
});

test('measure: destek ayak bileği görünmezse supportOffset ve destek dizi NaN olur', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.ankle.left] = { ...p[LM.ankle.left], v: 0.1 }; // destek ayak (sol) bileği kadrajda net değil
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.supportOffset), `supportOffset NaN olmalıydı: ${m.supportOffset}`);
  assert.ok(Number.isNaN(m.supportKnee), `supportKnee NaN olmalıydı: ${m.supportKnee}`);
  assert.ok(Number.isFinite(m.trunk), 'gövde ölçümü etkilenmemeli');
});

test('buildTrack: oyuncu bir karede kaybolursa o kare null kalır, takip devam eder', () => {
  const total = 15;
  const contact = 7;
  const step = 5;
  const kickerHipX0 = 800;
  const vanishAt = 10;

  const frames = [];
  const kickerPoses = [];
  for (let i = 0; i < total; i++) {
    const hipX = kickerHipX0 + (i - contact) * step;
    const kicker = buildPose({ hipX, dir: 1, side: 'right' });
    kickerPoses.push(kicker);
    frames.push(i === vanishAt ? [] : [kicker]);
  }
  const contactPose = kickerPoses[contact];
  const ball = { x: contactPose[LM.ankle.left].x, y: contactPose[LM.ankle.left].y };

  const track = buildTrack(frames, contact, ball);
  assert.equal(track[vanishAt], null);
  for (let i = 0; i < total; i++) {
    if (i === vanishAt) continue;
    assert.equal(track[i], kickerPoses[i], `kare ${i} takip kırıldı`);
  }
});
