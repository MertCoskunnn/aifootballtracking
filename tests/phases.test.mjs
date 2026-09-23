// phases.js testleri: basış (plant), kurma zirvesi (backswingPeak) ve takip sonu (followEnd)
// bulucusu. Sahte (sentetik) bir "koşup vuran oyuncu" dizisi üretir, gerçek video gerekmez.
// Ayrıca metrics.js'teki kare-sayısı → saniye dönüşümünün 30 fps'te eski sabit kare sayılarıyla
// (20/15) birebir aynı sonucu verdiğini doğrular (cp-11-evreler, GECE-PLANI.md).
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPhases, APPROACH_LOOKBACK_SEC } from '../phases.js';
import { measure, LM } from '../metrics.js';

const other = (side) => (side === 'right' ? 'left' : 'right');
const clamp01 = (x) => Math.max(0, Math.min(1, x));
const invLerp = (a, b, x) => clamp01((x - a) / (b - a));
const lerp = (a, b, f) => a + (b - a) * f;

// 33 noktalık sahte iskelet. Gövde her zaman dik tutulur (omuz tam kalçanın üstünde) ki
// hipFlexion = thighDeg, kneeFlexion (uyluk dikeyken) = shinDeg olsun (bkz. tests/metrics.test.mjs
// Ş8 testindeki aynı geometrik mantık: angleAt(yukarı, .., döndürülmüş) = 180 - açı).
// thighDeg: vuran uyluğun dikeyden öne açısı (takip/Ş8). shinDeg: baldırın dikeyden açısı
// (uyluk dikeyken bu doğrudan kneeFlexion'a eşittir — kurma/Ş4 kontrolü için kullanılır).
// supportAnkle: destek ayak bileğinin MUTLAK konumu, dışarıdan tam kontrol edilir (basış testi
// için: önce hareketli, sonra sabit).
function buildPhasePose({ dir = 1, side = 'right', hipX, hipY = 600, supportAnkle, thighDeg = 0, shinDeg = 15, L1 = 60, L2 = 60 }) {
  const sup = other(side);
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hip = { x: hipX, y: hipY };
  const shoulder = { x: hipX, y: hipY - 80 };
  p[LM.hip.left] = hip;
  p[LM.hip.right] = hip;
  p[LM.shoulder.left] = shoulder;
  p[LM.shoulder.right] = shoulder;

  p[LM.ankle[sup]] = supportAnkle;
  p[LM.knee[sup]] = { x: (hip.x + supportAnkle.x) / 2, y: (hip.y + supportAnkle.y) / 2 - 20 };

  const thighRad = (thighDeg * Math.PI) / 180;
  const knee = { x: hip.x + dir * L1 * Math.sin(thighRad), y: hip.y + L1 * Math.cos(thighRad) };
  const shinRad = (shinDeg * Math.PI) / 180;
  const ankle = { x: knee.x + dir * L2 * Math.sin(shinRad), y: knee.y + L2 * Math.cos(shinRad) };
  p[LM.knee[side]] = knee;
  p[LM.ankle[side]] = ankle;
  return p;
}

// Fiziksel zaman çizelgesi (temasa göre saniye, sabit — fps'ten bağımsız):
//   plantTime: destek ayağı burada durur (öncesinde sabit hızla yaklaşıyor)
//   backPeakTime: vuran diz burada en çok bükülü (kurma zirvesi)
//   followPeakTime: temastan sonra vuran kalça burada en çok öne kalkmış (takip zirvesi)
const PLANT_TIME = -0.28;
const BACK_PEAK_TIME = -0.33;
const FOLLOW_PEAK_TIME = 0.22;
const RUN_START = -1.0; // dizinin başladığı an
const RUN_END = 0.6; // dizinin bittiği an

// fps verilen bir "koşup vuran oyuncu" dizisi üretir. dropEvery: doldurma testinde bazı kareleri
// null yapmak için (null karelere dayanıklılık testi), verilmezse hiçbir kare düşürülmez.
function buildSequence(fps, { dropEvery = 0 } = {}) {
  const contact = Math.round(-RUN_START * fps);
  const total = contact + Math.round(RUN_END * fps) + 1;
  const dir = 1;
  const side = 'right';
  const plantX = 1000;
  const approachSpeed = 800; // px/sn — bacak boyunun (~300px) birkaç katı, eşiğin (1.5 bacak/sn) belirgin üstünde
  const baseHipX = 1400;
  const hipSpeed = 250; // px/sn, koşu sırasında kalçanın kayması (yalnızca gerçekçilik için)

  const track = [];
  for (let i = 0; i < total; i++) {
    const t = (i - contact) / fps;
    const hipX = baseHipX + dir * hipSpeed * t;

    const supportAnkle = t <= PLANT_TIME
      ? { x: plantX - dir * approachSpeed * (PLANT_TIME - t), y: 900 }
      : { x: plantX, y: 900 };

    // Kurma: [-0.6, backPeak] arası 40°→110° yükselir, [backPeak, 0] arası 110°→15° düşer.
    let shinDeg;
    if (t <= BACK_PEAK_TIME) shinDeg = lerp(40, 110, invLerp(-0.6, BACK_PEAK_TIME, t));
    else if (t <= 0) shinDeg = lerp(110, 15, invLerp(BACK_PEAK_TIME, 0, t));
    else shinDeg = 15; // temastan sonrası önemsiz (backswing araması temasta biter)

    // Takip: temasa kadar 0° (uyluk dikey), sonra followPeak'e kadar yükselir, sonra hafif düşer.
    let thighDeg;
    if (t <= 0) thighDeg = 0;
    else if (t <= FOLLOW_PEAK_TIME) thighDeg = lerp(0, 100, invLerp(0, FOLLOW_PEAK_TIME, t));
    else thighDeg = lerp(100, 50, invLerp(FOLLOW_PEAK_TIME, 0.5, Math.min(t, 0.5)));

    const pose = buildPhasePose({ dir, side, hipX, supportAnkle, thighDeg, shinDeg });
    track.push(dropEvery && i % dropEvery === 0 ? null : pose);
  }
  return { track, contact, side, fps };
}

// "Doğru kareye düşüyor mu" toleransı: hız bir kare farkından hesaplandığı için basış, ayağın
// gerçekten durduğu kareden değil bir sonraki karadan (hız o karede düşük ölçülür) tespit edilir —
// bu geometrik olarak 1 karelik bir gecikme demektir. Ayrıca uyluk/baldır açıları parça parça
// doğrusal olduğundan zirve, en yakın örnekleme karesine oturur. 3 kare bu payları kapsar.
const FRAME_TOL = 3;

test('findPhases: basış/kurma/takip doğru anlara denk gelir (30 fps)', () => {
  const { track, contact, side, fps } = buildSequence(30);
  const phases = findPhases(track, contact, side, fps);
  const expectedPlant = contact + Math.round(PLANT_TIME * fps);
  const expectedBackPeak = contact + Math.round(BACK_PEAK_TIME * fps);
  const expectedFollow = contact + Math.round(FOLLOW_PEAK_TIME * fps);

  assert.ok(phases.plant !== null, 'plant bulunamadı');
  assert.ok(Math.abs(phases.plant - expectedPlant) <= FRAME_TOL, `plant ${phases.plant}, beklenen ~${expectedPlant}`);
  assert.ok(phases.backswingPeak !== null, 'backswingPeak bulunamadı');
  assert.ok(Math.abs(phases.backswingPeak - expectedBackPeak) <= FRAME_TOL, `backswingPeak ${phases.backswingPeak}, beklenen ~${expectedBackPeak}`);
  assert.ok(phases.followEnd !== null, 'followEnd bulunamadı');
  assert.ok(Math.abs(phases.followEnd - expectedFollow) <= FRAME_TOL, `followEnd ${phases.followEnd}, beklenen ~${expectedFollow}`);

  // approachStart: basıştan (bulunduysa) 0.7 sn geriye, formülle birebir aynı olmalı
  const expectedApproach = Math.max(0, phases.plant - Math.round(APPROACH_LOOKBACK_SEC * fps));
  assert.equal(phases.approachStart, expectedApproach);

  assert.deepEqual(phases.confidence, { plant: true, backswingPeak: true, followEnd: true });
});

test('findPhases: basış/kurma/takip doğru anlara denk gelir (60 fps)', () => {
  const { track, contact, side, fps } = buildSequence(60);
  const phases = findPhases(track, contact, side, fps);
  const expectedPlant = contact + Math.round(PLANT_TIME * fps);
  const expectedBackPeak = contact + Math.round(BACK_PEAK_TIME * fps);
  const expectedFollow = contact + Math.round(FOLLOW_PEAK_TIME * fps);

  assert.ok(Math.abs(phases.plant - expectedPlant) <= FRAME_TOL, `plant ${phases.plant}, beklenen ~${expectedPlant}`);
  assert.ok(Math.abs(phases.backswingPeak - expectedBackPeak) <= FRAME_TOL, `backswingPeak ${phases.backswingPeak}, beklenen ~${expectedBackPeak}`);
  assert.ok(Math.abs(phases.followEnd - expectedFollow) <= FRAME_TOL, `followEnd ${phases.followEnd}, beklenen ~${expectedFollow}`);
});

test('findPhases: 30 ve 60 fps aynı fiziksel zamanlara düşer (±1 kare/30fps tolerans)', () => {
  const a = buildSequence(30);
  const b = buildSequence(60);
  const pa = findPhases(a.track, a.contact, a.side, a.fps);
  const pb = findPhases(b.track, b.contact, b.side, b.fps);

  const toSec = (phases, contact, fps) => ({
    plant: (phases.plant - contact) / fps,
    backswingPeak: (phases.backswingPeak - contact) / fps,
    followEnd: (phases.followEnd - contact) / fps,
  });
  const ta = toSec(pa, a.contact, a.fps);
  const tb = toSec(pb, b.contact, b.fps);
  const tol = 1 / 30; // daha kaba örneklenen (30 fps) tarafın bir karesi kadar tolerans

  for (const key of ['plant', 'backswingPeak', 'followEnd']) {
    assert.ok(Math.abs(ta[key] - tb[key]) <= tol, `${key}: 30fps=${ta[key].toFixed(3)}sn, 60fps=${tb[key].toFixed(3)}sn`);
  }
});

test('findPhases: null karelere dayanıklı (bazı kareler eksik olsa da evreler yaklaşık doğru bulunur)', () => {
  const { track, contact, side, fps } = buildSequence(30, { dropEvery: 9 });
  assert.doesNotThrow(() => findPhases(track, contact, side, fps));
  const phases = findPhases(track, contact, side, fps);
  const expectedPlant = contact + Math.round(PLANT_TIME * fps);
  const expectedBackPeak = contact + Math.round(BACK_PEAK_TIME * fps);
  const expectedFollow = contact + Math.round(FOLLOW_PEAK_TIME * fps);
  // Eksik kareler yüzünden pay daha geniş tutuldu; asıl kontrol edilen: çökmeden makul bir kareye düşmesi
  assert.ok(phases.plant === null || Math.abs(phases.plant - expectedPlant) <= FRAME_TOL + 4);
  assert.ok(phases.backswingPeak === null || Math.abs(phases.backswingPeak - expectedBackPeak) <= FRAME_TOL + 4);
  assert.ok(phases.followEnd === null || Math.abs(phases.followEnd - expectedFollow) <= FRAME_TOL + 4);
});

// --- metrics.js pencere dönüşümü: cp-11-evreler öncesi sabit kare sayısıydı (contact-20..contact
// backswing için, contact..contact+15 follow için). Artık saniyeyle tanımlı ama 30 fps'te BİREBİR
// aynı sınırı vermeli (Math.round(20/30*30)=20). Burada tek bir "kurma darbesi" tam eski sınırda
// (contact-20) ve bir kare dışında (contact-21) test edilerek dahil/hariç davranışı doğrulanır. ---
function buildBackswingFrames(total, contact, spikeAt) {
  const frames = [];
  for (let i = 0; i < total; i++) {
    const shinDeg = i === spikeAt ? 170 : 20;
    frames.push(buildPhasePose({ dir: 1, side: 'right', hipX: 1000, supportAnkle: { x: 900, y: 900 }, thighDeg: 0, shinDeg }));
  }
  return frames;
}

test('metrics.js measure(): backswing penceresi 30 fps\'te eski sabit 20 kare sınırıyla birebir aynı (dahil)', () => {
  const contact = 60;
  const frames = buildBackswingFrames(90, contact, contact - 20); // eski pencerenin son (dahil) karesi
  const ball = { x: 800, y: 900 };
  const m = measure(frames, contact, ball, 'right', 30);
  assert.ok(Math.abs(m.backswing - 170) < 1, `backswing ${m.backswing} (contact-20 darbesi dahil olmalıydı)`);
});

test('metrics.js measure(): backswing penceresi 30 fps\'te eski sabit 20 kare sınırının bir dışını almaz', () => {
  const contact = 60;
  const frames = buildBackswingFrames(90, contact, contact - 21); // eski pencerenin bir kare dışı
  const ball = { x: 800, y: 900 };
  const m = measure(frames, contact, ball, 'right', 30);
  assert.ok(Math.abs(m.backswing - 170) > 50, `backswing ${m.backswing} (contact-21 darbesi eski pencerede de dışarıdaydı, hariç kalmalı)`);
});

test('metrics.js measure(): 60 fps\'te backswing penceresi aynı süreyi kapsar (40 kareye çıkar)', () => {
  const contact = 60;
  const inside = buildBackswingFrames(110, contact, contact - 40); // 60fps'te 0.667sn = 40 kare, dahil
  const outside = buildBackswingFrames(110, contact, contact - 41); // bir kare dışı, hariç
  const ball = { x: 800, y: 900 };
  const mIn = measure(inside, contact, ball, 'right', 60);
  const mOut = measure(outside, contact, ball, 'right', 60);
  assert.ok(Math.abs(mIn.backswing - 170) < 1, `backswing (40 kare, dahil) ${mIn.backswing}`);
  assert.ok(Math.abs(mOut.backswing - 170) > 50, `backswing (41 kare, hariç) ${mOut.backswing}`);
});
