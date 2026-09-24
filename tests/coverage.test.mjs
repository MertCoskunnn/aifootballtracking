// tests/coverage.test.mjs — cp-14a-olcum-yeterliligi: coach.js artık "ölçülemedi" maddeler
// puanı sessizce %100'e taşımıyor. Gerçek veride Ronaldo'nun arkadan çekilmiş bir şutunda 7
// kuraldan sadece Ş7 (karşı kol) ölçülebilmişti; eski evaluate() geri kalan 6 maddeyi görmezden
// gelip tek maddenin ortalamasını (100) toplam puan olarak veriyordu. Bu testler evaluate()'in
// kapsamı (coverage) hesaplayıp MIN_COVERAGE altında kalınca hata fırlatmak yerine "insufficient"
// bir sonuç döndüğünü doğruluyor.
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, MIN_COVERAGE } from '../coach.js';

test('MIN_COVERAGE 0.5', () => {
  assert.equal(MIN_COVERAGE, 0.5);
});

// Ronaldo örneği: şutta 7 kuraldan sadece Ş7 (armOpen) ölçülebiliyor. Puanlanabilir ağırlık
// toplamı 13 (Ş5 düşük fps'de zaten dışlanır, bkz. aşağıdaki test), ölçülen ağırlık 1 -> 1/13 ≈ %8.
test('coach: şutta tek madde (Ş7) ölçülürse insufficient döner, hata fırlatmaz, total null', () => {
  const m = {
    supportOffset: NaN, trunk: NaN, supportKnee: NaN, backswing: NaN, kickKnee: NaN,
    armOpen: 72.5, // ideal ortası, tek başına ölçülebilen madde
    followHip: NaN,
  };
  const res = evaluate(m, 'shot');
  assert.equal(res.total, null);
  assert.equal(res.insufficient, true);
  assert.ok(res.coverage < MIN_COVERAGE, `coverage ${res.coverage} eşiğin altında olmalıydı`);
  assert.ok(Math.abs(res.coverage - 1 / 13) < 1e-9, `coverage ${res.coverage}, beklenen 1/13`);
  assert.equal(res.focus.length, 0, 'insufficient durumda odak listesi boş olmalı');
  // Madde listesi yine dönmeli (app.js hangi maddenin ölçülüp ölçülmediğini göstersin diye)
  assert.equal(res.items.length, 7);
  assert.match(res.verdict, /şut/);
  assert.match(res.verdict, /yandan/, 'şut modunda çekim önerisi yandan çekim olmalı');
});

// Plase ve frikikte hiçbir madde ölçülemezse eskiden "Hiçbir ölçüm yapılamadı" hatası fırlatılırdı.
test('coach: plasede hiçbir madde ölçülemezse hata fırlatmaz, insufficient döner', () => {
  const allNaN = { supportOffset: NaN, trunk: NaN, supportKnee: NaN, backswing: NaN, followHip: NaN, kneeAngVelRatio: NaN };
  const res = evaluate(allNaN, 'placement');
  assert.equal(res.total, null);
  assert.equal(res.insufficient, true);
  assert.equal(res.coverage, 0);
  assert.match(res.verdict, /plase/);
});

test('coach: frikikte hiçbir madde ölçülemezse hata fırlatmaz, insufficient döner ve arkadan çekim önerir', () => {
  const allNaN = { supportLateral: NaN, crossing: NaN, trunkLateral: NaN, backswing: NaN, approachAngle: NaN };
  const res = evaluate(allNaN, 'freekick');
  assert.equal(res.total, null);
  assert.equal(res.insufficient, true);
  assert.equal(res.coverage, 0);
  assert.match(res.verdict, /frikik/);
  assert.match(res.verdict, /arkadan/, 'frikik modunda çekim önerisi arkadan/çapraz arkadan olmalı');
});

// Messi MV2 benzeri: Ş1 (supportOffset), Ş2 (supportKnee), Ş5 (kickKnee), Ş7 (armOpen) ölçülemiyor,
// geri kalan (Ş3 trunk, Ş4 backswing, Ş8 followHip, ağırlık 3+2+2=7) ölçülüyor.
// Puanlanabilir toplam ağırlık 13 (Ş5 düşük fps'de dışlanır) -> kapsam 7/13 ≈ %54, eşiğin (MIN_COVERAGE) üstünde.
test('coach: Messi MV2 benzeri kısmi ölçüm (kapsam ~%54) yeterli sayılır, puan üretir', () => {
  const m = {
    supportOffset: NaN, supportKnee: NaN, kickKnee: NaN, armOpen: NaN,
    trunk: -7.5, backswing: 107.5, followHip: 95, // üçü de ideal aralığın ortasında
  };
  const res = evaluate(m, 'shot');
  assert.equal(res.insufficient, false);
  assert.ok(Number.isFinite(res.total), 'yeterli kapsamda total sayı olmalı');
  assert.ok(Math.abs(res.coverage - 7 / 13) < 1e-9, `coverage ${res.coverage}, beklenen 7/13 (~%54)`);
  assert.ok(res.coverage >= MIN_COVERAGE);
  assert.equal(res.total, 100, 'ölçülen üç madde de ideal aralığın ortasında, puan 100 olmalı');
});

// Ş5 (temas anındaki diz) düşük fps'de puanlanabilir kurallar arasına GİRMEMELİ: yoksa kasıtlı
// dışlanan bir madde payda büyütüp kapsamı yapay olarak düşürür/yükseltir.
test('coach: Ş5 düşük fps\'de kapsam paydasına girmez, 50+ fps\'de girer', () => {
  // Sadece supportOffset (ağırlık 3) ölçülüyor, kickKnee (Ş5) hep NaN: fps'e göre SADECE payda değişmeli.
  const base = { supportOffset: -0.25, trunk: NaN, supportKnee: NaN, backswing: NaN, kickKnee: NaN, armOpen: NaN, followHip: NaN };
  const low = evaluate({ ...base, fps: 30 }, 'shot');
  const high = evaluate({ ...base, fps: 60 }, 'shot');
  assert.ok(Math.abs(low.coverage - 3 / 13) < 1e-9, `30 fps'de coverage ${low.coverage}, beklenen 3/13 (Ş5 payda dışı)`);
  assert.ok(Math.abs(high.coverage - 3 / 14) < 1e-9, `60 fps'de coverage ${high.coverage}, beklenen 3/14 (Ş5 payda içi)`);
  assert.ok(low.coverage > high.coverage, 'Ş5 paydaya girince kapsam oranı düşmeli (aynı pay, büyüyen payda)');
  assert.equal(low.insufficient, true);
  assert.equal(high.insufficient, true);
});
