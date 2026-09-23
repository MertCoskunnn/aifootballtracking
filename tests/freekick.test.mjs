// measureFreeKick() testleri: arkadan/çapraz arkadan kamera varsayımı (RESEARCH.md bölüm 3, F1..F5).
// Sahte iskeletlerle: x = yanal (oyuncunun kendi sağ-solu, aynalanma yok), y = piksel (aşağı artar).
import test from 'node:test';
import assert from 'node:assert/strict';
import { measureFreeKick, LM } from '../metrics.js';
import { evaluate } from '../coach.js';

// --- yardımcı: arkadan çekim için 33 noktalık sahte bir vücut ---
// hipWidth=0: kalça sol/sağ aynı noktada, böylece hip[destek]=hip[vuruş]=kalça merkezi (matematiği basitleştirir).
// Destek bacağı: diz, kalça-bilek doğrusunun tam ortasında -> bacak boyu = kalça-bilek mesafesi (kontrollü).
// Vuruş bacağı: uyluk dikey + kickKnee derece bükülme (kneeFlexion tanımıyla birebir, bkz. tests/metrics.test.mjs).
function buildFKPose({ hipX, hipY, mirror, side, trunk = 0, kickKnee = 20, supportAnkle, kickAnkleX, kickAnkleY }) {
  const sup = side === 'right' ? 'left' : 'right';
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  const hipCenter = { x: hipX, y: hipY };
  const trunkHeight = 80;
  const trunkRad = (trunk * Math.PI) / 180;
  // Gövde: trunkLean ile aynı üçgen mantığı, koşu yönü yerine `mirror` (side'dan gelir) ile işaretli
  const shoulderCenter = { x: hipCenter.x + mirror * trunkHeight * Math.tan(trunkRad), y: hipCenter.y - trunkHeight };
  p[LM.hip.left] = hipCenter;
  p[LM.hip.right] = hipCenter;
  p[LM.shoulder.left] = { x: shoulderCenter.x - 15, y: shoulderCenter.y };
  p[LM.shoulder.right] = { x: shoulderCenter.x + 15, y: shoulderCenter.y };

  // Destek ayağı: sabit basılı (koşan kalçayla birlikte hareket etmez). `supportAnkle` çağırandan
  // gelir, kalça-ayak bileği mesafesi = 100 olacak şekilde (temas karesindeki kalçaya göre) önceden hesaplanır.
  p[LM.ankle[sup]] = supportAnkle;
  p[LM.knee[sup]] = { x: (hipCenter.x + supportAnkle.x) / 2, y: (hipCenter.y + supportAnkle.y) / 2 };
  p[LM.toe[sup]] = { x: supportAnkle.x, y: supportAnkle.y + 5 };

  // Vuruş bacağı: uyluk dikey, baldır kickKnee kadar sapar (angleAt = 180-kickKnee -> kneeFlexion = kickKnee)
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

// good=true: ders kitabı gibi bir frikik. good=false: bariz hatalı (düz yaklaşım, yanlış tarafta destek
// ayağı, dik gövde, zayıf kurma, çapraz takip yok). side: vuran ayak, mirror işaret kuralını test eder.
function buildFreeKickSequence(side, good) {
  const mirror = side === 'right' ? 1 : -1;
  const contact = 20;
  const total = 36;
  const baseX = 900;
  const baseY = 600;

  const approachSign = good ? -1 : 1; // -1: mirror yönünde diyagonal yaklaşım (iyi), +1: ters (kötü)
  const supL = good ? 15 : -10; // destek ayağının topa yanal mesafesi (F2), leg=100 varsayımıyla oran = supL/100
  const trunkDeg = good ? 20 : -20;
  const kickKneeDeg = good ? 110 : 20; // kurma (F4)
  // Takip (F5): iyide destek ayağını mirror yönünde 60 birim geçer, kötüde ters yöne 40 birim kaçar
  const followOffset = good ? -mirror * 60 : mirror * 40;

  const supportAnkleX = baseX - mirror * supL;
  // Destek ayağı sahada sabit basılı: kalça-bilek mesafesi temas karesindeki kalçaya göre 100 olsun
  const supportAnkle = { x: supportAnkleX, y: baseY + Math.sqrt(10000 - (supportAnkleX - baseX) ** 2) };
  const ball = { x: baseX, y: baseY + 60 };

  const frames = [];
  for (let i = 0; i < total; i++) {
    const k = contact - i; // temastan kaç kare önce (negatifse sonra)
    const hip = k > 0 ? { x: baseX + approachSign * mirror * k * 4, y: baseY + k * 8 } : { x: baseX, y: baseY };
    // Temas karesinde ve sonrasında vuruş ayak bileği doğrudan kontrol edilir: temas anında nötr
    // (dizden dikey iniş, theta=0: bilek diz-uyluk çizgisinin devamında) ki destek ayağı ölçümüyle
    // karışmasın; sonrasında takip konumuna geçer.
    let override;
    if (i === contact) override = { x: hip.x, y: hip.y + 100 };
    else if (i > contact) override = { x: supportAnkleX + followOffset, y: baseY + 20 };
    frames.push(buildFKPose({
      hipX: hip.x, hipY: hip.y, mirror, side,
      trunk: trunkDeg, kickKnee: kickKneeDeg, supportAnkle,
      kickAnkleX: override?.x, kickAnkleY: override?.y,
    }));
  }
  return { frames, contact, ball };
}

for (const side of ['right', 'left']) {
  test(`measureFreeKick: ders kitabı gibi frikik, ${side} ayak — işaretler doğru`, () => {
    const { frames, contact, ball } = buildFreeKickSequence(side, true);
    const m = measureFreeKick(frames, contact, ball, side);
    assert.equal(m.dir, side === 'right' ? 1 : -1);
    assert.ok(m.approachAngle > 15, `approachAngle ${m.approachAngle}`); // diyagonal yaklaşım
    assert.ok(m.supportLateral > 0, `supportLateral ${m.supportLateral}`); // beklenen tarafta
    assert.ok(m.trunkLateral > 0, `trunkLateral ${m.trunkLateral}`); // vuruş bacağı tarafına yatık
    assert.ok(m.backswing > 80, `backswing ${m.backswing}`); // belirgin kurma
    assert.ok(m.crossing > 0.3, `crossing ${m.crossing}`); // gövde önünden çapraz takip
  });

  test(`measureFreeKick: hatalı frikik, ${side} ayak — işaretler ters/düşük`, () => {
    const { frames, contact, ball } = buildFreeKickSequence(side, false);
    const m = measureFreeKick(frames, contact, ball, side);
    assert.ok(m.approachAngle < 0, `approachAngle ${m.approachAngle}`); // ters diyagonal
    assert.ok(m.supportLateral < 0, `supportLateral ${m.supportLateral}`); // yanlış tarafta
    assert.ok(m.trunkLateral < 0, `trunkLateral ${m.trunkLateral}`); // ters yatış
    assert.ok(m.backswing < 40, `backswing ${m.backswing}`); // zayıf kurma
    assert.ok(m.crossing < 0.3, `crossing ${m.crossing}`); // çapraz takip yok
  });

  test(`coach: ders kitabı frikik (${side}) hatalı friktikten belirgin yüksek puan alır, hoca 'frikik' der`, () => {
    const good = buildFreeKickSequence(side, true);
    const bad = buildFreeKickSequence(side, false);
    const goodScore = evaluate(measureFreeKick(good.frames, good.contact, good.ball, side), 'freekick');
    const badScore = evaluate(measureFreeKick(bad.frames, bad.contact, bad.ball, side), 'freekick');
    assert.ok(goodScore.total >= 90, `iyi frikik puanı ${goodScore.total}`);
    assert.ok(badScore.total <= 50, `kötü frikik puanı ${badScore.total}`);
    assert.ok(goodScore.total > badScore.total);
    assert.ok(goodScore.verdict.includes('frikik'));
    assert.ok(badScore.verdict.includes('frikik'));
  });
}
