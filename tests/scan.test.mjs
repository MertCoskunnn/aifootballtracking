// scan.js testleri: kaba geçiş karelerinden aday pencere bulma (cp-07-otomatik).
// Sahte 5 fps kaba kareler, gerçek video ya da MediaPipe gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { candidateWindows } from '../scan.js';

// Tek kişilik sahte iskelet: sol ayak (bilek+uç) x,y konumunda, sağ ayak hep uzakta (karışmasın).
function personAt(x, y) {
  const p = new Array(33).fill(0).map(() => ({ x: 0, y: 0, v: 1 }));
  p[27] = { x, y }; p[31] = { x, y };
  p[28] = { x: x - 800, y }; p[32] = { x: x - 800, y };
  return p;
}

const FPS = 5;
const FAR = -1000; // ayağın topa hiç yaklaşmadığı kareler için sabit uzak konum

test('candidateWindows: ayak topa yakınken top sonraki karelerde kayboluyorsa aday pencere bulunur', () => {
  const ballW = 20;
  const frames = [];
  for (let i = 0; i < 10; i++) {
    const near = i === 4;
    const balls = i <= 4 ? [{ x: 1000, y: 600, w: ballW, s: 0.9 }] : []; // 5. kareden sonra top yok
    const people = [personAt(near ? 1010 : FAR, 600)]; // 3 çap = 60px içinde: 10px yakın
    frames.push({ t: i / FPS, people, balls });
  }
  const windows = candidateWindows(frames);
  assert.equal(windows.length, 1, `beklenmedik pencere sayısı: ${JSON.stringify(windows)}`);
  const evtT = frames[4].t; // 0.8 sn
  assert.ok(Math.abs(windows[0].t0 - (evtT - 1.2)) < 1e-9, `t0 ${windows[0].t0}`);
  assert.ok(Math.abs(windows[0].t1 - (evtT + 0.8)) < 1e-9, `t1 ${windows[0].t1}`);
});

test('candidateWindows: top yeterince hareket etmezse (≤2 çap) aday pencere yok', () => {
  const ballW = 20;
  const frames = [];
  for (let i = 0; i < 8; i++) {
    const near = i === 3;
    // Top her karede sadece 1 çap kayıyor: 2 çap eşiğinin altında, "ayrılmış" sayılmaz
    const ballX = 1000 + i * (ballW * 1); // 20px/kare
    const balls = [{ x: ballX, y: 600, w: ballW, s: 0.9 }];
    const people = [personAt(near ? ballX + 5 : FAR, 600)];
    frames.push({ t: i / FPS, people, balls });
  }
  const windows = candidateWindows(frames);
  assert.equal(windows.length, 0, `beklenmedik pencere bulundu: ${JSON.stringify(windows)}`);
});

test('candidateWindows: ayak hiç topa yaklaşmazsa aday pencere yok', () => {
  const ballW = 20;
  const frames = [];
  for (let i = 0; i < 8; i++) {
    frames.push({
      t: i / FPS,
      people: [personAt(FAR, 600)],
      balls: [{ x: 1000, y: 600, w: ballW, s: 0.9 }], // top hep sabit, kimse yaklaşmıyor
    });
  }
  const windows = candidateWindows(frames);
  assert.equal(windows.length, 0);
});

test('candidateWindows: yakın zamanlı iki aday çakışan pencerelere düşerse tek pencerede birleşir', () => {
  const ballW = 20;
  const total = 12;
  const near = new Set([3, 5]);
  // Top: 0-3'te 1000, 4-5'te 1300 (3->4 arası 300px = 15 çap sıçrama), 6+'da 1600 (5->6 arası yine sıçrama)
  const ballXAt = (i) => (i <= 3 ? 1000 : i <= 5 ? 1300 : 1600);
  const frames = [];
  for (let i = 0; i < total; i++) {
    const bx = ballXAt(i);
    const people = [personAt(near.has(i) ? bx + 10 : FAR, 600)];
    frames.push({ t: i / FPS, people, balls: [{ x: bx, y: 600, w: ballW, s: 0.9 }] });
  }
  const windows = candidateWindows(frames);
  assert.equal(windows.length, 1, `pencereler birleşmedi: ${JSON.stringify(windows)}`);
  const t3 = frames[3].t, t5 = frames[5].t;
  assert.ok(Math.abs(windows[0].t0 - (t3 - 1.2)) < 1e-9, `t0 ${windows[0].t0}`);
  assert.ok(Math.abs(windows[0].t1 - (t5 + 0.8)) < 1e-9, `t1 ${windows[0].t1}`);
});
