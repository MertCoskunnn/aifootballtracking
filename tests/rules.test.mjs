// tests/rules.test.mjs — cp-16-kural-matrisi: (vuruş türü × ayak × açı) → referans oyuncu +
// geçerli kurallar + kaynak, ya da { olculemez: true, mesaj }. coach.js'in RULES/CONTEXT_OVERRIDES/
// MIN_COVERAGE'ı buradan okuduğunu da (aynı veri, aynı referans) doğrular.
import test from 'node:test';
import assert from 'node:assert/strict';
import { getRuleSet, RULES, MIN_COVERAGE } from '../rules.js';
import { evaluate, MIN_COVERAGE as COACH_MIN_COVERAGE } from '../coach.js';

// === 1. Ölçülemez kombinasyonlar (yanlış açı) ===

test('getRuleSet: ayak üstü şut arkadan ölçülemez', () => {
  const res = getRuleSet('shot', 'right', 'behind');
  assert.equal(res.olculemez, true);
  assert.match(res.mesaj, /yandan/);
});

test('getRuleSet: plase arkadan ölçülemez', () => {
  const res = getRuleSet('placement', 'left', 'behind');
  assert.equal(res.olculemez, true);
  assert.match(res.mesaj, /yandan/);
});

test('getRuleSet: pas arkadan ölçülemez', () => {
  const res = getRuleSet('pass', 'right', 'behind');
  assert.equal(res.olculemez, true);
  assert.match(res.mesaj, /yandan/);
});

test('getRuleSet: frikik yandan ölçülemez', () => {
  const res = getRuleSet('freekick', 'left', 'side');
  assert.equal(res.olculemez, true);
  assert.match(res.mesaj, /arkadan/);
});

// === 2. Ölçülebilir kombinasyonlar + referans oyuncu ===

// Not (cp-20-rapor-temizligi): referansNotu artık kullanıcıya gösterilen SADE metin ("referans
// ölçümü bekleniyor"), eski iç "[T] ... (sahte ölçüm yok)" notasyonunu taşımıyor. Testler artık
// "ölçüm bekleniyor mu (pending) yoksa gerçek kaynaklı mı (METRICS.md/Messi)" ayrımını bu sade
// metnin varlığına/yokluğuna bakarak doğruluyor.
const PENDING_MARK = 'ölçümü bekleniyor';

test('getRuleSet: ayak üstü şut (sağ ve sol) yandan ölçülür, referans Ronaldo, ölçüm bekleniyor notlu', () => {
  for (const foot of ['right', 'left']) {
    const res = getRuleSet('shot', foot, 'side');
    assert.equal(res.olculemez, false);
    assert.equal(res.referans, 'Ronaldo');
    assert.ok(res.referansNotu.includes(PENDING_MARK));
    assert.equal(res.kurallar, RULES.shot, 'coach.js#evaluate ile aynı kural dizisi kullanılmalı');
  }
});

test('getRuleSet: plase sol → Messi (kaynaklı, bekleyen not yok), plase sağ → Neymar (bekleyen not var)', () => {
  const left = getRuleSet('placement', 'left', 'side');
  assert.equal(left.olculemez, false);
  assert.equal(left.referans, 'Messi');
  assert.equal(left.referansNotu.includes(PENDING_MARK), false, 'Messi referansı bekleyen olmamalı, METRICS.mddan geliyor');

  const right = getRuleSet('placement', 'right', 'side');
  assert.equal(right.olculemez, false);
  assert.equal(right.referans, 'Neymar');
  assert.ok(right.referansNotu.includes(PENDING_MARK));
});

test('getRuleSet: frikik sol → Messi (kaynaklı), frikik sağ → Neymar (bekleyen not var)', () => {
  const left = getRuleSet('freekick', 'left', 'behind');
  assert.equal(left.referans, 'Messi');
  assert.equal(left.referansNotu.includes(PENDING_MARK), false);

  const right = getRuleSet('freekick', 'right', 'behind');
  assert.equal(right.referans, 'Neymar');
  assert.ok(right.referansNotu.includes(PENDING_MARK));
});

test('getRuleSet: pas için referans oyuncu yok (sadece araştırma eşikleri)', () => {
  for (const foot of ['right', 'left']) {
    const res = getRuleSet('pass', foot, 'side');
    assert.equal(res.olculemez, false);
    assert.equal(res.referans, null);
    assert.equal(res.referansNotu, null);
  }
});

// === 3. Bilinmeyen değerler hata fırlatır (sessizce yanlış sonuç vermek yerine) ===

test('getRuleSet: bilinmeyen mod/ayak/açı hata fırlatır', () => {
  assert.throws(() => getRuleSet('volley', 'right', 'side'));
  assert.throws(() => getRuleSet('shot', 'orta', 'side'));
  assert.throws(() => getRuleSet('shot', 'right', 'onden'));
});

// === 4. Her kuralın eşiği (ideal/tol) ve kaynağı (source) var — info kuralları hariç ===

test('RULES: puanlanan her kuralda ideal/tol/source dolu, info kuralında (PL4) yok', () => {
  for (const mode of Object.keys(RULES)) {
    for (const r of RULES[mode]) {
      assert.equal(typeof r.source, 'string', `${mode}/${r.key}: source alanı yok`);
      assert.ok(r.source.length > 10, `${mode}/${r.key}: source çok kısa`);
      if (r.info) continue;
      assert.ok(Array.isArray(r.ideal) && r.ideal.length === 2, `${mode}/${r.key}: ideal aralığı yok`);
      assert.equal(typeof r.tol, 'number', `${mode}/${r.key}: tol yok`);
    }
  }
});

// === 5. coach.js aynı veriyi kullanıyor (regresyon: rules.js taşınması puanları değiştirmedi) ===

test('coach.js MIN_COVERAGE, rules.js ile aynı (0.5)', () => {
  assert.equal(MIN_COVERAGE, 0.5);
  assert.equal(COACH_MIN_COVERAGE, MIN_COVERAGE);
});

test('coach.js#evaluate hâlâ rules.js#RULES.shot ideal aralığının ortasında ~100 verir (taşıma regresyonu yok)', () => {
  const GOOD_SHOT = { supportOffset: -0.25, trunk: -7.5, supportKnee: 30, backswing: 107.5, kickKnee: 45, armOpen: 72.5, followHip: 95 };
  const res = evaluate(GOOD_SHOT, 'shot');
  assert.ok(res.total >= 98, `total ${res.total}`);
});
