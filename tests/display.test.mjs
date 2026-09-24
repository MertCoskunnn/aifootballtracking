// tests/display.test.mjs — cp-18-tek-oyuncu-tek-top: ekranda SADECE vuran oyuncu, SADECE vurulan
// top gösterme mantığı (display.js). Mert'in isteği: kaleci/yan çizgideki kişiler ve yerdeki başka
// toplar artık çizilmemeli. Saf fonksiyonlar, canvas gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTrackedPerson, pickDisplayBall, pickDisplay, pickLiveDisplay } from '../display.js';

// --- yardımcı: sahte "kişi" ve "top" nesneleri ---
const person = (tag) => ({ tag }); // pickTrackedPerson içerik umursamıyor, referans eşitliği yeterli
const ball = (x, y, w = 20, s = 0.9) => ({ x, y, w, s });

// === 1. pickTrackedPerson: track yoksa ya da o karede kayıpsa null, başkasına atlamaz ===

test('pickTrackedPerson: track yoksa null döner', () => {
  assert.equal(pickTrackedPerson(null, 5), null);
});

test('pickTrackedPerson: track o karede kayıpsa (null) null döner, başka bir kişiye atlamaz', () => {
  const track = [person('a'), null, person('a')];
  assert.equal(pickTrackedPerson(track, 1), null);
});

test('pickTrackedPerson: track o karede varsa onu döner', () => {
  const p = person('a');
  const track = [null, p, null];
  assert.equal(pickTrackedPerson(track, 1), p);
});

// === 2. pickDisplayBall ===

test('pickDisplayBall: contact null ya da ankor yoksa null döner', () => {
  const frame = { balls: [ball(10, 10)] };
  assert.equal(pickDisplayBall(frame, 5, null, ball(10, 10), null), null);
  assert.equal(pickDisplayBall(frame, 5, 5, null, null), null);
});

test('pickDisplayBall: temas karesinde ankoru döner, w yoksa en yakın ham tespitten ödünç alır', () => {
  const frame = { balls: [ball(500, 500, 99), ball(101, 101, 30)] }; // ikinci tespit ankora yakın
  const anchor = { x: 100, y: 100 }; // w yok
  const res = pickDisplayBall(frame, 5, 5, anchor, null);
  assert.equal(res.x, 100);
  assert.equal(res.y, 100);
  assert.equal(res.w, 30, 'en yakın ham tespitin (101,101,w=30) genişliği ödünç alınmalı');
});

test('pickDisplayBall: temas karesinde ankorun kendi w\'si varsa onu kullanır (tahmine gerek yok)', () => {
  const frame = { balls: [] };
  const anchor = { x: 100, y: 100, w: 22 };
  const res = pickDisplayBall(frame, 5, 5, anchor, null);
  assert.equal(res.w, 22);
});

test('pickDisplayBall: hiç ham tespit yoksa temas karesinde varsayılan genişliğe (16) düşer', () => {
  const frame = { balls: [] };
  const res = pickDisplayBall(frame, 5, 5, { x: 100, y: 100 }, null);
  assert.equal(res.w, 16);
});

test('pickDisplayBall: temastan ÖNCE o karedeki tespitlerden ankora EN YAKIN olanı döner, diğerleri yok sayılır', () => {
  const anchor = { x: 100, y: 100 };
  const near = ball(105, 100, 18);
  const far = ball(300, 300, 40);
  const frame = { balls: [far, near] };
  const res = pickDisplayBall(frame, 3, 5, anchor, null); // index(3) < contact(5)
  assert.equal(res, near);
});

test('pickDisplayBall: temastan ÖNCE o karede hiç tespit yoksa null döner', () => {
  const res = pickDisplayBall({ balls: [] }, 3, 5, { x: 100, y: 100 }, null);
  assert.equal(res, null);
});

test('pickDisplayBall: temastan SONRA sadece flight noktası döner, ham tespitler yok sayılır', () => {
  const anchor = { x: 100, y: 100 };
  const frame = { balls: [ball(999, 999, 50)] }; // flight'ta olmayan, alakasız bir tespit
  const flightPoint = { i: 8, x: 130, y: 90 };
  const res = pickDisplayBall(frame, 8, 5, anchor, flightPoint); // index(8) > contact(5)
  assert.deepEqual(res, flightPoint);
});

test('pickDisplayBall: temastan SONRA o kare flight\'ta yoksa (miss) null döner, başka bir tespite atlanmaz', () => {
  const frame = { balls: [ball(999, 999, 50)] };
  const res = pickDisplayBall(frame, 9, 5, { x: 100, y: 100 }, null); // flightPoint yok (kayıp kare)
  assert.equal(res, null);
});

// === 3. pickDisplay: oyuncu + top tek çağrıda ===

test('pickDisplay: person ve ball alanlarını birlikte döner', () => {
  const p = person('a');
  const track = [null, p];
  const anchor = { x: 100, y: 100, w: 20 };
  const res = pickDisplay({ balls: [] }, 1, track, 1, anchor, null);
  assert.equal(res.person, p);
  assert.equal(res.ball.x, 100);
});

// === 4. pickLiveDisplay: tarama sırasında topa en yakın kişi + en güvenli top ===

function personAt(x, y) {
  // pickLiveDisplay ayak noktalarına (27,28,31,32) bakar
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0 }));
  for (const i of [27, 28, 31, 32]) p[i] = { x, y };
  return p;
}

test('pickLiveDisplay: top yoksa person de null döner', () => {
  const res = pickLiveDisplay({ people: [personAt(0, 0)], balls: [] });
  assert.equal(res.ball, null);
  assert.equal(res.person, null);
});

test('pickLiveDisplay: birden çok top varsa en güvenli (yüksek s) top seçilir', () => {
  const frame = { people: [], balls: [ball(0, 0, 20, 0.3), ball(500, 500, 20, 0.9)] };
  const res = pickLiveDisplay(frame);
  assert.equal(res.ball.x, 500);
});

test('pickLiveDisplay: birden çok kişi varsa topa en yakın ayaklı kişi seçilir', () => {
  const near = personAt(105, 100);
  const far = personAt(900, 900);
  const frame = { people: [far, near], balls: [ball(100, 100, 20, 0.9)] };
  const res = pickLiveDisplay(frame);
  assert.equal(res.person, near);
});

test('pickLiveDisplay: top var ama kimse yoksa person null, ball dolu döner', () => {
  const res = pickLiveDisplay({ people: [], balls: [ball(1, 1)] });
  assert.equal(res.person, null);
  assert.ok(res.ball);
});
