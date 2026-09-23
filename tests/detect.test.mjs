// detect.js testleri: vuruş bulma (findKicks) ve kamera açısı sınıflandırma (classifyView).
// Sahte kareler {t, people, balls} biçiminde, gerçek video ya da MediaPipe gerekmez.
// detect.js SADECE şu MediaPipe noktalarını kullanır: 23/24 kalça, 27/28 ayak bileği, 31/32 ayak ucu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { findKicks, classifyView } from '../detect.js';

const FPS = 30;

// Tek kişilik sahte iskelet. Bacak boyu (kalça->bilek) sabit 100 olsun diye kalçayı ayak
// bileğinin tam 100px üstüne koyarız (detect.js diz kullanmaz, bu basitleştirme yeterli).
function personAt({ rightAnkleX, leftAnkleX, y = 600 }) {
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  p[27] = { x: leftAnkleX, y }; p[31] = { x: leftAnkleX, y }; // sol ayak bileği + ucu (destek)
  p[23] = { x: leftAnkleX, y: y - 100 };                       // sol kalça
  p[28] = { x: rightAnkleX, y }; p[32] = { x: rightAnkleX, y }; // sağ ayak bileği + ucu (vuran)
  p[24] = { x: rightAnkleX, y: y - 100 };                       // sağ kalça
  return p;
}

// (a) Duran top: vuran ayak (sağ) topa ~20 bacak boyu/sn hızla yaklaşırken, destek ayağı (sol)
// topun yanına ~5 bacak boyu/sn gibi daha yavaş bir hızla iniyor. Vuruş bulunmalı, doğru ayak (sağ)
// ve doğru kare (top kaybolmadan hemen önceki kare) seçilmeli — destek ayak DEĞİL.
function buildStaticBallKick() {
  const contact = 20, total = 28;
  const ballX = 1000, ballY = 600, ballW = 20;
  const rightStep = (20 * 100) / FPS; // ~20 bacak boyu/sn
  const leftStep = (5 * 100) / FPS; // ~5 bacak boyu/sn
  const leftTargetX = ballX - 20; // destek ayak topun 20px yanına iniyor (nearFoot içinde ama yavaş)
  const frames = [];
  for (let i = 0; i < total; i++) {
    const rightAnkleX = i <= contact ? ballX - (contact - i) * rightStep : ballX;
    const leftAnkleX = i <= contact ? leftTargetX - (contact - i) * leftStep : leftTargetX;
    const people = [personAt({ rightAnkleX, leftAnkleX, y: ballY })];
    const balls = i <= contact ? [{ x: ballX, y: ballY, w: ballW, s: 0.9 }] : []; // temastan sonra top kadraj dışı
    frames.push({ t: i / FPS, people, balls });
  }
  return { frames, contact };
}

test('findKicks: hızlı yaklaşan vuran ayak + yavaş inen destek ayak — doğru kare ve ayak bulunur', () => {
  const { frames, contact } = buildStaticBallKick();
  const kicks = findKicks(frames, FPS);
  assert.equal(kicks.length, 1, `beklenmedik vuruş sayısı: ${JSON.stringify(kicks)}`);
  assert.equal(kicks[0].contact, contact);
  assert.equal(kicks[0].foot, 'right');
  assert.equal(kicks[0].person, 0);
});

// (b) Sürülen top: kicksten önce top kareye 0.3 çap/kare hızla yuvarlanıyor, vuruşta kayboluyor.
// Yine de vuruş bulunmalı.
function buildRollingBallKick() {
  const contact = 20, total = 28;
  const ballFinalX = 1000, ballY = 600, ballW = 20;
  const rollStep = 0.3 * ballW; // 0.3 çap/kare
  const rightStep = (20 * 100) / FPS;
  const leftStep = (5 * 100) / FPS;
  const leftTargetX = ballFinalX - 20;
  const frames = [];
  for (let i = 0; i < total; i++) {
    const ballX = ballFinalX - (contact - i >= 0 ? (contact - i) * rollStep : 0);
    const rightAnkleX = i <= contact ? ballFinalX - (contact - i) * rightStep : ballFinalX;
    const leftAnkleX = i <= contact ? leftTargetX - (contact - i) * leftStep : leftTargetX;
    const people = [personAt({ rightAnkleX, leftAnkleX, y: ballY })];
    const balls = i <= contact ? [{ x: ballX, y: ballY, w: ballW, s: 0.9 }] : [];
    frames.push({ t: i / FPS, people, balls });
  }
  return { frames, contact };
}

test('findKicks: yuvarlanan top (0.3 çap/kare) vurulunca da bulunur', () => {
  const { frames, contact } = buildRollingBallKick();
  const kicks = findKicks(frames, FPS);
  assert.equal(kicks.length, 1, `beklenmedik vuruş sayısı: ${JSON.stringify(kicks)}`);
  assert.equal(kicks[0].contact, contact);
  assert.equal(kicks[0].foot, 'right');
});

// (c) 2 karelik top tespit boşluğu (kısa, fillGaps ile dolar) ama hiçbir ayak topa hızla
// yaklaşmıyor: bu tek başına vuruş sayılmamalı.
test('findKicks: vuruş olmadan 2 karelik top tespit boşluğu vuruş yaratmaz', () => {
  const total = 20;
  const ballX = 1000, ballY = 600, ballW = 20;
  const frames = [];
  for (let i = 0; i < total; i++) {
    const balls = i === 10 || i === 11 ? [] : [{ x: ballX, y: ballY, w: ballW, s: 0.9 }];
    const people = [personAt({ rightAnkleX: 200, leftAnkleX: 150, y: ballY })]; // hep uzakta, sabit (hız 0)
    frames.push({ t: i / FPS, people, balls });
  }
  const kicks = findKicks(frames, FPS);
  assert.equal(kicks.length, 0, `beklenmedik vuruş bulundu: ${JSON.stringify(kicks)}`);
});

// (d) classifyView: kamera açısı sınıflandırması, sadece kalça (23/24) ve ayak bileği (27/28) kullanır.
function poseAt({ hipX, hipY = 600, legLen = 100 }) {
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  p[23] = { x: hipX - 10, y: hipY };
  p[24] = { x: hipX + 10, y: hipY };
  p[27] = { x: hipX - 10, y: hipY + legLen };
  p[28] = { x: hipX + 10, y: hipY + legLen };
  // Dizler: classifyView bacak boyunu kalça→diz→bilek parçalarından ölçer (büküşten etkilenmesin diye)
  p[25] = { x: hipX - 10, y: hipY + legLen / 2 };
  p[26] = { x: hipX + 10, y: hipY + legLen / 2 };
  return p;
}

test('classifyView: kalça 2 bacak boyu yatay kayar, boy sabit kalırsa yandan', () => {
  const contact = 30;
  const n = Math.max(3, Math.round(0.7 * FPS)); // 21
  const legLen = 100;
  const frames = [];
  for (let i = 0; i <= contact; i++) frames.push({ t: i / FPS, people: [] });
  frames[contact - n] = { t: (contact - n) / FPS, people: [poseAt({ hipX: 1000, legLen })] };
  frames[contact] = { t: contact / FPS, people: [poseAt({ hipX: 1000 + 2 * legLen, legLen })] };
  const view = classifyView(frames, { contact, person: 0, flight: { seen: 0 } }, FPS);
  assert.equal(view.view, 'side', `view ${JSON.stringify(view)}`);
});

test('classifyView: oyuncu 0.6 kat küçülürse (kameradan uzaklaşıyor) arkadan', () => {
  const contact = 30;
  const n = Math.max(3, Math.round(0.7 * FPS));
  const legLen = 100;
  const frames = [];
  for (let i = 0; i <= contact; i++) frames.push({ t: i / FPS, people: [] });
  frames[contact - n] = { t: (contact - n) / FPS, people: [poseAt({ hipX: 1000, legLen })] };
  frames[contact] = { t: contact / FPS, people: [poseAt({ hipX: 1000, legLen: legLen * 0.6 })] };
  const view = classifyView(frames, { contact, person: 0, flight: { seen: 0 } }, FPS);
  assert.equal(view.view, 'behind', `view ${JSON.stringify(view)}`);
});
