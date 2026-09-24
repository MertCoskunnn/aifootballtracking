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
  heelOffset = 0, // destek topuğunun ayak bileğinden yatay farkı (px), Ş1 testleri için
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
  // Topuk (heel): ayak bileğinin dir yönünün tersine sabit bir ofsetle (gerçekçi, topuk arkada),
  // + heelOff: Ş1 testlerinin destek topuğunu ayak bileğinden kasıtlı ayırması için.
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
    // Kameradan uzak izleyici: %60 boyunda (kural: vuran = kameraya en yakın = en büyük görünen)
    const bystander = buildPose({ hipX: bystanderHipX, dir: 1, side: 'right' }).map((q) => ({ ...q, y: 400 + (q.y - 400) * 0.6 }));
    kickerPoses.push(kicker);
    frames.push([bystander, kicker]); // sıra önemsiz, buildTrack boya bakar
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
// cp-08-metrikler: Ş7 artık temas öncesi ~0.3 sn'lik bir pencerenin en büyüğü; NaN yalnızca
// pencerenin TAMAMI görünmezse oluşur (tek bir karenin görünmemesi yetmez, diğer kareler kullanılır).
test('measure: pencerenin tamamında karşı kol görünmezse armOpen NaN olur, diğer ölçümler etkilenmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const from = contact - Math.round(0.3 * 30);
  for (let i = from; i <= contact; i++) {
    frames[i][LM.wrist.left] = { ...frames[i][LM.wrist.left], v: 0.3 }; // karşı kol (destek taraf) bileği hiç net değil
  }
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.armOpen), `armOpen NaN olmalıydı: ${m.armOpen}`);
  assert.ok(Number.isFinite(m.supportKnee), 'ilgisiz ölçüm etkilenmemeli');
  assert.ok(Number.isFinite(m.trunk), 'ilgisiz ölçüm etkilenmemeli');
});

test('measure: Ş7 armOpen, pencere içindeki tek bir görünmeyen kare NaN yaratmaz (diğer kareler kullanılır)', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.wrist.left] = { ...p[LM.wrist.left], v: 0.3 }; // sadece temas karesi net değil, pencerenin geri kalanı net
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isFinite(m.armOpen), `armOpen ölçülebilmeliydi: ${m.armOpen}`);
});

test('measure: Ş7 armOpen, temastan önceki 0.3 sn içindeki pencerenin en büyüğünü alır', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const sup = 'left';
  // Pencere içindeki bir karede kol çok daha açık: bilek gövdeden uzağa taşınır
  const wideFrame = contact - 3;
  const hipX = inputs.hipX + inputs.dir * (wideFrame - contact) * 6; // buildTrackSequence'in varsayılan step'i
  const wide = buildPose({ ...inputs, hipX });
  wide[LM.wrist[sup]] = { x: wide[LM.shoulder[sup]].x + inputs.dir * 90, y: wide[LM.shoulder[sup]].y + 10 };
  frames[wideFrame] = wide;
  const expected = angleAt(wide[LM.wrist[sup]], wide[LM.shoulder[sup]], wide[LM.hip[sup]]);
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right', 30);
  assert.ok(Math.abs(m.armOpen - expected) < 1e-6, `armOpen ${m.armOpen}, beklenen ${expected}`);
});

// cp-08-metrikler: Ş1 artık destek AYAK BİLEĞİ değil destek TOPUĞU (heel) kullanır.
test('measure: Ş1 destek ayağı konumu topuktan hesaplanır, ayak bileğinden değil', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right', heelOffset: 40 };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y }; // top, destek ayak bileğinin hizasında
  const m = measure(frames, contact, ball, 'right');
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const leg = dist(p[LM.hip.left], p[LM.knee.left]) + dist(p[LM.knee.left], p[LM.ankle.left]);
  const expectedFromHeel = ((p[LM.heel.left].x - ball.x) * m.dir) / leg;
  const wouldBeFromAnkle = ((p[LM.ankle.left].x - ball.x) * m.dir) / leg;
  assert.ok(Math.abs(m.supportOffset - expectedFromHeel) < 1e-6, `supportOffset ${m.supportOffset}, beklenen (topuktan) ${expectedFromHeel}`);
  assert.notEqual(
    Math.round(m.supportOffset * 1000),
    Math.round(wouldBeFromAnkle * 1000),
    'topuk ve ayak bileği farklı konumda olduğundan sonuç ayak bileğinden hesaplananla aynı olmamalı'
  );
});

test('measure: destek topuğu görünmezse supportOffset NaN olur, destek dizi etkilenmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.heel.left] = { ...p[LM.heel.left], v: 0.1 }; // destek (sol) topuk kadrajda net değil
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.supportOffset), `supportOffset NaN olmalıydı: ${m.supportOffset}`);
  assert.ok(Number.isFinite(m.supportKnee), 'destek dizi ayak bileğine bağlı, etkilenmemeli');
  assert.ok(Number.isFinite(m.trunk), 'gövde ölçümü etkilenmemeli');
});

test('measure: destek ayak bileği görünmezse destek dizi NaN olur, supportOffset (topuk) etkilenmez', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  p[LM.ankle.left] = { ...p[LM.ankle.left], v: 0.1 }; // destek ayak (sol) bileği kadrajda net değil
  const m = measure(frames, contact, ball, 'right');
  assert.ok(Number.isNaN(m.supportKnee), `supportKnee NaN olmalıydı: ${m.supportKnee}`);
  assert.ok(Number.isFinite(m.supportOffset), 'Ş1 artık topuktan hesaplanıyor, ayak bileği görünürlüğünden etkilenmemeli');
  assert.ok(Number.isFinite(m.trunk), 'gövde ölçümü etkilenmemeli');
});

// Ş5: temas karesindeki diz ölçülür. Komşu karelere bakan iki kural denendi, gerçek veride ikisi
// de yanıldı (128°/54°/7°). Ölçüm gösterilir, puana ise sadece 50+ fps'de girer (coach testi).
test('measure: Ş5 kickKnee temas karesinde ölçülür, komşu kareler karışmaz', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 10, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  frames[contact - 1] = buildPose({ ...inputs, hipX: inputs.hipX - 6, kickKnee: 128 });
  const p = frames[contact];
  const m = measure(frames, contact, { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y }, 'right', 60);
  assert.ok(Math.abs(m.kickKnee - 20) < 2, `kickKnee ${m.kickKnee} (temas karesinin 20°'si bekleniyordu)`);
  assert.equal(m.fps, 60);
});

// cp-08-metrikler: Ş8 yeni ölçüm, takip: temastan sonra vuran kalçanın en büyük fleksiyonu.
test('measure: Ş8 followHip, temastan sonra uyluk yataya kalkarsa ~90 olur', () => {
  const inputs = { hipX: 1000, dir: 1, trunk: 0, supportKnee: 35, kickKnee: 20, side: 'right' };
  const frames = buildTrackSequence({ contact: 20, total: 30, ...inputs });
  const contact = 20;
  const raiseFrame = contact + 8; // pencere içinde (contact+15'e kadar)
  const hipXAt = inputs.hipX + inputs.dir * (raiseFrame - contact) * 6;
  // hipWidth/shoulderWidth: 0 -> hip.right ve shoulder.right tam orta noktalarda (sol/sağ ofseti
  // olmadan), böylece trunk=0 ile omuz tam kalçanın üstünde kalır ve açı tam 90° olur.
  const pose = buildPose({ ...inputs, hipX: hipXAt, hipWidth: 0, shoulderWidth: 0 });
  const hip = pose[LM.hip.right];
  // Uyluk yatay: diz, kalçayla aynı yükseklikte (trunk=0 -> omuz tam kalçanın üstünde, açı = 90°)
  pose[LM.knee.right] = { x: hip.x + inputs.dir * 50, y: hip.y };
  frames[raiseFrame] = pose;
  const p = frames[contact];
  const ball = { x: p[LM.ankle.left].x, y: p[LM.ankle.left].y };
  const m = measure(frames, contact, ball, 'right', 30);
  assert.ok(Math.abs(m.followHip - 90) < 2, `followHip ${m.followHip}`);
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

// Kalabalık/arkadan çekim (Messi–Liverpool yayını): oyuncu bir karede bulunamayınca takip,
// kalçası yakın ama boyu çok farklı başka birine (öndeki büyük oyuncu) atlıyordu.
// Artık boyu %25'ten fazla farklı kişi reddedilir ve kısa kayıptan sonra takip asıl oyuncuyla devam eder.
test('buildTrack: kısa kayıpta boyu farklı yakındaki kişiye atlamaz, oyuncu geri gelince devam eder', () => {
  const inputs = { dir: 1, trunk: 0, supportKnee: 30, kickKnee: 20, side: 'right' };
  const frames = [];
  for (let i = 0; i < 12; i++) {
    const player = buildPose({ ...inputs, hipX: 1000 + i * 4 });
    // Yakında duran, 1.6 kat büyük (kameraya yakın) başka biri
    const big = buildPose({ ...inputs, hipX: 1000 + i * 4 + 30 }).map((q) => ({ ...q, x: 1030 + i * 4 + (q.x - (1030 + i * 4)) * 1.6, y: q.y * 1.6 - 300 }));
    frames.push(i === 6 || i === 7 ? [big] : [player, big]); // 6-7. karelerde oyuncu bulunamadı
  }
  const contact = 3;
  const p = frames[contact][0];
  // Büyük kişi kameraya daha yakın; otomatik kural onu seçerdi. Bu test takibin boyu farklı birine
  // ATLAMADIĞINI ölçüyor, o yüzden oyuncu kullanıcı dokunuşuyla seçilmiş (seed) gibi veriliyor.
  const tr = buildTrack(frames, contact, { x: p[LM.toe.right].x, y: p[LM.toe.right].y }, p);
  assert.equal(tr[6], null, '6. karede büyük kişiye atlamamalı');
  assert.equal(tr[7], null, '7. karede büyük kişiye atlamamalı');
  assert.equal(tr[9], frames[9][0], 'oyuncu geri gelince takip ona devam etmeli');
});

test('pickKicker: kameraya en yakın (en uzun görünen) kişiyi seçer, topa bakmaz', async () => {
  const { pickKicker } = await import('../metrics.js');
  const near = buildPose({ hipX: 600, dir: 1, side: 'right' });
  const keeper = buildPose({ hipX: 900, dir: 1, side: 'right' }).map((q) => ({ ...q, y: 300 + (q.y - 300) * 0.4 }));
  assert.equal(pickKicker([keeper, near]), near);
  assert.equal(pickKicker([]), null);
});
