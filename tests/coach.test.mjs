// coach.js testleri: ölçüm nesnesinden puan ve öneri üretimi.
// metrics.js'i devreye sokmadan doğrudan ölçüm (m) nesneleri kuruyoruz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../coach.js';

// RULES.shot ideal aralıklarının tam ortasında: her madde 100 puan almalı.
const GOOD_SHOT = {
  supportOffset: -0.1, // ideal [-0.25, 0.05]
  trunk: 10, // ideal [0, 20]
  supportKnee: 35, // ideal [20, 50]
  backswing: 110, // ideal [90, 140]
  kickKnee: 25, // ideal [5, 45]
  armOpen: 70, // ideal [40, 110]
  followRise: 0.6, // ideal [0.35, 1.2]
};

test('coach: iyi şut ~100 alır', () => {
  const res = evaluate(GOOD_SHOT, 'shot');
  assert.ok(res.total >= 98, `total ${res.total} beklenenden düşük`);
  assert.equal(res.verdict.includes('şut'), true);
});

test('coach: kötü şut (geriye yaslanmış, destek ayağı önde) düşük alır ve gövdeyi işaret eder', () => {
  const badShot = {
    ...GOOD_SHOT,
    trunk: -30, // geriye yaslanmış, ideal alt sınırın (0) 30 altında, tol 20 -> puan 0
    supportOffset: 0.4, // topun çok önünde, ideal üst sınırın (0.05) 0.35 üstünde, tol 0.35 -> puan 0
  };
  const res = evaluate(badShot, 'shot');
  assert.ok(res.total < 60, `total ${res.total} beklenenden yüksek`);
  assert.ok(
    res.focus.some((f) => f.ref === 'Ş3'),
    'odak listesi gövde kuralını (Ş3) içermiyor'
  );
});

test('coach: NaN ölçüm "ölçülemedi" gösterir ve puana katılmaz', () => {
  const m = { ...GOOD_SHOT, armOpen: NaN };
  const res = evaluate(m, 'shot');
  const armItem = res.items.find((i) => i.key === 'armOpen');
  assert.equal(armItem.shown, 'ölçülemedi');
  assert.equal(armItem.score, null);
  // Kalan tüm maddeler ideal aralıkta olduğundan toplam yine ~100 olmalı (NaN madde dışlanır)
  assert.ok(res.total >= 98, `total ${res.total}`);
});

test('coach: tüm ölçümler NaN ise hata fırlatır', () => {
  const allNaN = Object.fromEntries(Object.keys(GOOD_SHOT).map((k) => [k, NaN]));
  assert.throws(() => evaluate(allNaN, 'shot'));
});
