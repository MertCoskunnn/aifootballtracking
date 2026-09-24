// tests/display.test.mjs — cp-18-tek-oyuncu-tek-top: ekranda SADECE vuran oyuncu, SADECE vurulan
// top gösterme mantığı (display.js). Mert'in isteği: kaleci/yan çizgideki kişiler ve yerdeki başka
// toplar artık çizilmemeli. cp-19-sut-izi-animasyon: temas sonrası top artık trajectory.js#fitFlight
// eğrisinden (flightAt) okunuyor, ham tespit zıplaması nişangahı oynatmıyor. Saf fonksiyonlar,
// canvas gerekmez.
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickTrackedPerson, pickDisplayBall, pickDisplay, pickLiveDisplay } from '../display.js';
import { flightAt } from '../trajectory.js';

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
// İmza (cp-19, cp-20'de flightPointFallback kaldırıldı): pickDisplayBall(frame, index, contact, ballAnchor, t, fit)

test('pickDisplayBall: contact null ya da ankor yoksa null döner', () => {
  const frame = { balls: [ball(10, 10)] };
  assert.equal(pickDisplayBall(frame, 5, null, ball(10, 10), 0, null, null), null);
  assert.equal(pickDisplayBall(frame, 5, 5, null, 0, null, null), null);
});

test('pickDisplayBall: temas karesinde ankoru döner, w yoksa en yakın ham tespitten ödünç alır', () => {
  const frame = { balls: [ball(500, 500, 99), ball(101, 101, 30)] }; // ikinci tespit ankora yakın
  const anchor = { x: 100, y: 100 }; // w yok
  const res = pickDisplayBall(frame, 5, 5, anchor, 0, null, null);
  assert.equal(res.x, 100);
  assert.equal(res.y, 100);
  assert.equal(res.w, 30, 'en yakın ham tespitin (101,101,w=30) genişliği ödünç alınmalı');
});

test('pickDisplayBall: temas karesinde ankorun kendi w\'si varsa onu kullanır (tahmine gerek yok)', () => {
  const frame = { balls: [] };
  const anchor = { x: 100, y: 100, w: 22 };
  const res = pickDisplayBall(frame, 5, 5, anchor, 0, null, null);
  assert.equal(res.w, 22);
});

test('pickDisplayBall: hiç ham tespit yoksa temas karesinde varsayılan genişliğe (16) düşer', () => {
  const frame = { balls: [] };
  const res = pickDisplayBall(frame, 5, 5, { x: 100, y: 100 }, 0, null, null);
  assert.equal(res.w, 16);
});

test('pickDisplayBall: temastan ÖNCE o karedeki tespitlerden ankora EN YAKIN olanı döner, diğerleri yok sayılır', () => {
  const anchor = { x: 100, y: 100 };
  const near = ball(105, 100, 18);
  const far = ball(300, 300, 40);
  const frame = { balls: [far, near] };
  const res = pickDisplayBall(frame, 3, 5, anchor, 0, null, null); // index(3) < contact(5)
  assert.equal(res, near);
});

test('pickDisplayBall: temastan ÖNCE o karede hiç tespit yoksa null döner', () => {
  const res = pickDisplayBall({ balls: [] }, 3, 5, { x: 100, y: 100 }, 0, null, null);
  assert.equal(res, null);
});

// --- cp-19: temas SONRASI, fit varsa nişangah eğriden (flightAt) okunur, ham tespit yok sayılır ---

const FIT = { contactT: 5, tEnd: 6, coef: { x0: 100, vx: 40, ax: -5, y0: 200, vy: -60, ay: 30 } };

test('pickDisplayBall: fit varsa temas SONRASI nişangah flightAt(fit,t) konumunu döner, ham tespitler yok sayılır', () => {
  const anchor = { x: 100, y: 200, w: 24 };
  const frame = { balls: [ball(999, 999, 50)] }; // alakasız, zıplayan bir ham tespit
  const t = 5.2; // contactT(5) ile tEnd(6) arası
  const res = pickDisplayBall(frame, 8, 5, anchor, t, FIT, null);
  const expected = flightAt(FIT, t);
  assert.ok(Math.abs(res.x - expected.x) < 1e-9);
  assert.ok(Math.abs(res.y - expected.y) < 1e-9);
  assert.equal(res.w, 24, 'nişangah boyutu ankor genişliğini korur');
});

test('pickDisplayBall: fit varsa nişangah t\'ye göre SÜREKLİ hareket eder (iki farklı t, iki farklı konum)', () => {
  const anchor = { x: 100, y: 200, w: 24 };
  const frame = { balls: [] };
  const a = pickDisplayBall(frame, 8, 5, anchor, 5.1, FIT, null);
  const b = pickDisplayBall(frame, 9, 5, anchor, 5.9, FIT, null);
  assert.notEqual(a.x, b.x);
  assert.notEqual(a.y, b.y);
});

test('pickDisplayBall: fit tEnd\'i aşan t, en fazla FIT_EXTEND_SEC (0.5sn) kadar ötesine ekstrapole edilir', () => {
  const anchor = { x: 100, y: 200, w: 24 };
  const frame = { balls: [] };
  const farBeyond = pickDisplayBall(frame, 20, 5, anchor, 50, FIT, null); // tEnd'in çok ötesi
  const clampedExpected = flightAt(FIT, FIT.tEnd + 0.5);
  assert.ok(Math.abs(farBeyond.x - clampedExpected.x) < 1e-9, 'x, tEnd+0.5 ile aynı olmalı (kırpılmış)');
  assert.ok(Math.abs(farBeyond.y - clampedExpected.y) < 1e-9, 'y, tEnd+0.5 ile aynı olmalı (kırpılmış)');
});

// cp-20-nisangah-boyutu bug düzeltmesi: genişlik (w) ankor.w yoksa artık topun O ANKİ (fit'in
// öngördüğü) konumuna göre aranır — eski koddaki hata, genişliği HER ZAMAN temas anındaki (artık
// çok eski/uzak) ankor konumuna göre arıyordu, top uçtukça bu "en yakın" araması alakasız bir
// tespite (ör. yerde duran başka top) kayabiliyor, nişangah gerçek boyutundan kat kat büyük/küçük
// çiziliyordu (gerçek bug raporu: yarıçap ~3 top çapı).
test('pickDisplayBall: genişlik (w) güncel fit konumuna yakın tespitten alınır, eski/uzak ankor konumundaki tespitten DEĞİL', () => {
  const fit = { contactT: 5, tEnd: 6, coef: { x0: 100, vx: 200, ax: 0, y0: 200, vy: 0, ay: 0 } }; // t=5.5 -> x=200,y=200
  const anchor = { x: 100, y: 200 }; // w YOK (elle işaretleme, cp-19 senaryosu)
  const t = 5.5;
  const frame = {
    balls: [
      { x: 100, y: 200, w: 60 }, // eski ankor konumunda duran BAŞKA top (ör. yerde duran top) — yanlış kaynak
      { x: 205, y: 200, w: 18 }, // topun O ANKİ (fit'in öngördüğü ~200,200) konumuna yakın gerçek tespit
    ],
  };
  const res = pickDisplayBall(frame, 8, 5, anchor, t, fit);
  assert.equal(res.w, 18, 'genişlik güncel konuma yakın tespitten alınmalı, eski ankor konumundaki büyük tespitten değil');
});

test('pickDisplayBall: genişlik için güncel konumda hiçbir tespit yoksa (mesafe tavanı aşılırsa) makul varsayılana düşer, uzak bir tespite atlamaz', () => {
  const fit = { contactT: 5, tEnd: 6, coef: { x0: 100, vx: 200, ax: 0, y0: 200, vy: 0, ay: 0 } };
  const anchorNoW = { x: 100, y: 200 }; // w YOK: mesafe tavanını test etmek için
  const t = 5.5; // beklenen konum ~ (200,200)
  const frameFar = { balls: [{ x: 900, y: 900, w: 77 }] }; // fit konumundan ÇOK uzak, tavanı aşar
  const res = pickDisplayBall(frameFar, 8, 5, anchorNoW, t, fit);
  assert.equal(res.w, 16, 'yakında güvenilir tespit yoksa makul varsayılana (16) düşmeli, uzak/alakasız tespite değil');
});

// cp-20-sabit-top bug düzeltmesi: eski kare-tabanlı yedek (flightPointFallback) TAMAMEN kaldırıldı.
// Gerçek bug raporunda bu yedek, fitFlight'ın tam da güvensiz bulup reddettiği durumda (sahada duran
// başka bir topa kilitlenme şüphesi) süzmeden o yanlış tespiti gösteriyordu. Artık kural net: fit
// yoksa temas sonrası HİÇBİR top gösterilmez, başka bir tespite (ne kadar "yakın" olursa olsun) atlanmaz.
test('pickDisplayBall: fit YOKSA temas sonrası hiçbir top gösterilmez (eski kare-tabanlı yedek kaldırıldı)', () => {
  const anchor = { x: 100, y: 100 };
  const frame = { balls: [ball(999, 999, 50)] }; // alakasız bir ham tespit, buna da atlanmamalı
  const res = pickDisplayBall(frame, 8, 5, anchor, 5.2, null); // fit: null
  assert.equal(res, null);
});

test('pickDisplayBall: fit YOKSA (kayıp/güvenilmez veri) null döner, başka bir tespite atlanmaz', () => {
  const frame = { balls: [ball(999, 999, 50)] };
  const res = pickDisplayBall(frame, 9, 5, { x: 100, y: 100 }, 5.3, null);
  assert.equal(res, null);
});

// === 3. pickDisplay: oyuncu + top tek çağrıda ===

test('pickDisplay: person ve ball alanlarını birlikte döner', () => {
  const p = person('a');
  const track = [null, p];
  const anchor = { x: 100, y: 100, w: 20 };
  const res = pickDisplay({ balls: [] }, 1, track, 1, anchor, 0, null, null);
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
