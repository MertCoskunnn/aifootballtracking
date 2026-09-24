// outcome.js + sebep.js testleri: top ne yaptı, hangi postür hatası bunu açıklıyor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readOutcome, outcomeProblems, describeOutcome } from '../outcome.js';
import { diagnose, EFFECTS } from '../sebep.js';

const fit = (vx, vy, ax = 0, ay = 0) => ({ coef: { x0: 0, vx, ax, y0: 0, vy, ay } });

test('readOutcome yandan: 35° kalkış yüksek, yere paralel yerden', () => {
  const up = readOutcome(fit(1000, -Math.tan((35 * Math.PI) / 180) * 1000), 'side', 50);
  assert.equal(up.height, 'yüksek');
  assert.ok(Math.abs(up.launchDeg - 35) < 0.5);
  assert.equal(up.direction, null, 'yandan sağ-sol okunmaz');
  const low = readOutcome(fit(-1200, -50), 'side', 50);
  assert.equal(low.height, 'yerden', 'sola giden top da aynı açıyla okunur');
});

test('readOutcome yandan: hız bacak boyuna göre, yavaş top zayıf', () => {
  assert.equal(readOutcome(fit(300, 0), 'side', 50).speedLabel, 'zayıf'); // 6 bacak/sn
  assert.equal(readOutcome(fit(1500, 0), 'side', 50).speedLabel, 'normal'); // 30 bacak/sn
});

test('readOutcome arkadan: yön ve falso', () => {
  assert.equal(readOutcome(fit(0, -800), 'behind', 50).direction, 'düz');
  assert.equal(readOutcome(fit(300, -800), 'behind', 50).direction, 'sağ');
  assert.equal(readOutcome(fit(-300, -800), 'behind', 50).direction, 'sol');
  assert.equal(readOutcome(fit(0, -800, 600), 'behind', 50).curve, 'var');
  assert.equal(readOutcome(fit(0, -800, 50), 'behind', 50).curve, 'yok');
  assert.equal(readOutcome(fit(0, -800), 'behind', 50).height, null, 'arkadan yükseklik okunmaz');
});

test('readOutcome: iz yoksa null', () => {
  assert.equal(readOutcome(null, 'side', 50), null);
});

test('outcomeProblems: frikikte havalanma sorun değil, falsosuzluk sorun', () => {
  const high = readOutcome(fit(1000, -1000), 'side', 50);
  assert.ok(outcomeProblems(high, 'shot').has('yüksek'));
  assert.ok(!outcomeProblems(high, 'freekick').has('yüksek'));
  const straight = readOutcome(fit(0, -800, 10), 'behind', 50);
  assert.ok(outcomeProblems(straight, 'freekick').has('falsosuz'));
});

test('describeOutcome: okunabilir Türkçe cümle', () => {
  assert.match(describeOutcome(readOutcome(fit(300, -800), 'behind', 50)), /sağa gitti/);
  assert.equal(describeOutcome(null), null);
});

const item = (key, value, ideal, score, weight = 2) => ({ key, ref: key, name: key, value, ideal, score, weight, tip: 'düzelt', drill: 'alıştırma' });

test('diagnose: top havalandı ve gövde geride → doğrulanmış neden, "çünkü" cümlesi', () => {
  const items = [item('trunk', -28, [-18, 3], 33, 3), item('backswing', 70, [85, 130], 57, 2)];
  const d = diagnose(items, new Set(['yüksek']));
  assert.equal(d.bulgular[0].key ?? d.bulgular[0].ref, 'trunk');
  assert.equal(d.bulgular[0].dogrulandi, true);
  assert.match(d.bulgular[0].cumle, /^Top havalandı, çünkü temas anında gövden fazla geride kaldı\.$/);
  assert.equal(d.aciklanamayan.length, 0);
});

test('diagnose: doğrulanmış neden, ağırlığı büyük ama doğrulanmamış hatanın önüne geçer', () => {
  const items = [item('backswing', 40, [85, 130], 0, 3), item('trunk', -22, [-18, 3], 73, 3)];
  const d = diagnose(items, new Set(['yüksek']));
  assert.equal(d.bulgular[0].ref, 'trunk');
  assert.equal(d.bulgular[1].ref, 'backswing');
  assert.match(d.bulgular[1].cumle, /Bu genelde vuruşu güçsüzleştirir/);
});

test('diagnose: top okunamadıysa hatalar tahmin diliyle söylenir', () => {
  const d = diagnose([item('crossing', 0.05, [0.3, 1.0], 38, 3)], new Set());
  assert.equal(d.bulgular[0].dogrulandi, false);
  assert.match(d.bulgular[0].cumle, /falso almasını engeller/);
});

test('diagnose: sonucu açıklayan hata yoksa açıklanamayan listesine girer; iyi puanlar hata sayılmaz', () => {
  const d = diagnose([item('trunk', -5, [-18, 3], 100, 3)], new Set(['yüksek']));
  assert.equal(d.bulgular.length, 0);
  assert.deepEqual(d.aciklanamayan, ['yüksek']);
});

test('EFFECTS: her kayıtta neden, sonuç listesi ve kaynak var', () => {
  for (const [key, dirs] of Object.entries(EFFECTS)) {
    for (const [dir, e] of Object.entries(dirs)) {
      assert.ok(e.neden && Array.isArray(e.sonuc) && e.kaynak, `${key}.${dir}`);
    }
  }
});

test('diagnose: şutta falso etkisi söylenmez; top kıvrıldıysa çaprazlayan takip "çünkü" ile bağlanır', async () => {
  const { diagnose } = await import('../sebep.js');
  const items = [item('trunkLateral', -6, [5, 22], 26, 2), item('crossing', 0.9, [-0.15, 0.5], 0, 2)];
  const d = diagnose(items, new Set(['kıvrıldı']), 'shot');
  assert.match(d.bulgular[0].cumle, /^Top yana kıvrıldı, çünkü/);
  for (const b of d.bulgular) assert.doesNotMatch(b.cumle, /falso/);
});

test('outcomeProblems: şutta kıvrılma sorun, frikikte değil', () => {
  const curved = readOutcome(fit(0, -800, 600), 'behind', 50);
  assert.ok(outcomeProblems(curved, 'shot').has('kıvrıldı'));
  assert.ok(!outcomeProblems(curved, 'freekick').has('kıvrıldı'));
});

test('kaynakMetni: etiketleri kullanıcı diline çevirir', async () => {
  const { kaynakMetni } = await import('../sebep.js');
  assert.equal(kaynakMetni('[K] Lees 2010'), 'Kaynak: Lees 2010');
  assert.equal(kaynakMetni('[T]'), 'Tahmin (videolarla ayarlanacak)');
  assert.equal(kaynakMetni('[T] aşırı yatış'), 'Tahmin (videolarla ayarlanacak): aşırı yatış');
});

test('readOutcome yandan: top kameradan uzaklaşıyorsa (küçülüyor) yükseklik ve hız okunmaz', async () => {
  const { depthTrend } = await import('../outcome.js');
  const inl = (ws) => ws.map((w, i) => ({ t: i * 0.033, x: 0, y: 0, w }));
  assert.equal(depthTrend(inl([20, 19, 18, 12, 10, 9])), 'uzaklaşıyor');
  assert.equal(depthTrend(inl([20, 20, 21, 20, 19, 20])), 'yanal');
  assert.equal(depthTrend(inl([20, 20])), null, 'az nokta: karar yok');
  const f = { coef: { vx: 300, vy: -500, ax: 0, ay: 0 }, inliers: inl([20, 19, 18, 12, 10, 9]) };
  const o = readOutcome(f, 'side', 50);
  assert.equal(o.height, null);
  assert.equal(o.speedLabel, null);
  assert.deepEqual([...outcomeProblems(o, 'shot')], [], 'okunamayan sonuçtan sorun çıkmaz');
  assert.match(describeOutcome(o), /kameradan uzaklaşarak gitti/);
});

test('combineOutcomes: pencereler çelişiyorsa etiket düşer, tutarlıysa kalır', async () => {
  const { combineOutcomes } = await import('../outcome.js');
  const o = (direction, curve) => ({ angle: 'behind', depth: 'uzaklaşıyor', height: null, speedLabel: null, direction, curve, sideDeg: direction === 'sağ' ? 15 : direction === 'sol' ? -15 : 0 });
  // Referans 9'daki gerçek durum: sağ/düz/sağ/sol, falso var/yok/var/var
  const noisy = combineOutcomes([o('sağ', 'var'), o('düz', 'yok'), o('sağ', 'var'), o('sol', 'var')]);
  assert.equal(noisy.direction, null);
  assert.equal(noisy.curve, null);
  assert.equal(noisy.depth, 'uzaklaşıyor');
  const steady = combineOutcomes([o('sağ', 'var'), o('sağ', 'var'), o('sağ', 'var'), o('sağ', 'yok'), o('sağ', 'var')]);
  assert.equal(steady.direction, 'sağ');
  assert.equal(steady.curve, 'var');
  assert.equal(combineOutcomes([null, null]), null);
  assert.equal(combineOutcomes([o('sağ', 'var'), o('sağ', 'var')]), null, 'en az 3 okuma gerekir');
});
