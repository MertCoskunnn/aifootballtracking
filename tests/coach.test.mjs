// coach.js testleri: ölçüm nesnesinden puan ve öneri üretimi.
// metrics.js'i devreye sokmadan doğrudan ölçüm (m) nesneleri kuruyoruz.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate } from '../coach.js';

// RULES.shot ideal aralıklarının tam ortasında: her madde 100 puan almalı.
const GOOD_SHOT = {
  supportOffset: -0.25, // ideal [-0.45, -0.05]
  trunk: -7.5, // ideal [-18, 3]
  supportKnee: 30, // ideal [15, 45]
  backswing: 107.5, // ideal [85, 130]
  kickKnee: 45, // ideal [30, 60]
  armOpen: 72.5, // ideal [35, 110]
  followHip: 95, // ideal [65, 125]
};

test('coach: iyi şut ~100 alır', () => {
  const res = evaluate(GOOD_SHOT, 'shot');
  assert.ok(res.total >= 98, `total ${res.total} beklenenden düşük`);
  assert.equal(res.verdict.includes('şut'), true);
});

test('coach: kötü şut (geriye yaslanmış, destek ayağı önde) düşük alır ve gövdeyi işaret eder', () => {
  const badShot = {
    ...GOOD_SHOT,
    trunk: -45, // geriye yaslanmış, ideal alt sınırın (-18) 27 altında, tol 15 -> puan 0
    supportOffset: 0.4, // topun çok önünde, ideal üst sınırın (-0.05) çok üstünde, tol 0.30 -> puan 0
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

// cp-14a-olcum-yeterliligi: eskiden burada hata fırlatılırdı. Artık evaluate() çökmüyor,
// kapsam (coverage) MIN_COVERAGE'ın altında kaldığı için "insufficient" bir sonuç dönüyor.
test('coach: tüm ölçümler NaN ise hata fırlatmaz, insufficient sonuç döner', () => {
  const allNaN = Object.fromEntries(Object.keys(GOOD_SHOT).map((k) => [k, NaN]));
  const res = evaluate(allNaN, 'shot');
  assert.equal(res.total, null);
  assert.equal(res.insufficient, true);
  assert.equal(res.coverage, 0);
  assert.equal(res.focus.length, 0);
  assert.match(res.verdict, /ölçülemedi/);
});

// cp-08-metrikler: METRICS.md'deki elit-benzeri şut (Lees 2010 / Petrolo 2024 orta noktalarına yakın)
// ve tek fark gövde açısı olan öne-kapanmış bir varyantı karşılaştırır.
test('coach: elit-benzeri şut ≥95 alır', () => {
  const eliteShot = {
    trunk: -10,
    supportKnee: 30,
    backswing: 95,
    kickKnee: 45,
    armOpen: 50,
    followHip: 95,
    supportOffset: -0.25,
  };
  const res = evaluate(eliteShot, 'shot');
  assert.ok(res.total >= 95, `total ${res.total} beklenenden düşük`);
});

test('coach: öne kapanan (+12°) aynı şut daha düşük alır ve Ş3 odakta çıkar', () => {
  const eliteShot = {
    trunk: -10,
    supportKnee: 30,
    backswing: 95,
    kickKnee: 45,
    armOpen: 50,
    followHip: 95,
    supportOffset: -0.25,
  };
  const forwardLeaning = { ...eliteShot, trunk: 12 }; // ideal üst sınırın (3) 9 üstünde, tol 15
  const eliteRes = evaluate(eliteShot, 'shot');
  const forwardRes = evaluate(forwardLeaning, 'shot');
  assert.ok(forwardRes.total < eliteRes.total, `total ${forwardRes.total} elit şuttan düşük olmalıydı (${eliteRes.total})`);
  assert.ok(
    forwardRes.focus.some((f) => f.ref === 'Ş3'),
    'odak listesi gövde kuralını (Ş3) içermiyor'
  );
});

// Ş5 (temas anında diz) 30 fps'de güvenilmez: gösterilir ama puana girmez. 60 fps'de puana girer.
test('coach: Ş5 30 fps\'de puana katılmaz, 60 fps\'de katılır', () => {
  const base = { supportOffset: -0.25, trunk: -10, supportKnee: 30, backswing: 95, kickKnee: 5, armOpen: 50, followHip: 95 };
  const at30 = evaluate({ ...base, fps: 30 }, 'shot');
  const ş5at30 = at30.items.find((i) => i.ref === 'Ş5');
  assert.equal(ş5at30.score, null);
  assert.match(ş5at30.shown, /bilgi/);
  assert.equal(at30.total, 100, 'kötü Ş5 değeri 30 fps\'de toplamı düşürmemeli');
  const at60 = evaluate({ ...base, fps: 60 }, 'shot');
  assert.ok(at60.items.find((i) => i.ref === 'Ş5').score < 50);
  assert.ok(at60.total < 100);
});
