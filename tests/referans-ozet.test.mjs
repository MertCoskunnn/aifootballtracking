// scripts/referans-ozet.mjs testleri (cp-19-referans-liste): grup özeti hesapları — ayrışma
// (iyi ort. − kötü ort. puan) ve kural bazlı medyan/min/max kalibrasyon verisi.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mean, median, groupRows } from '../scripts/referans-ozet.mjs';

test('mean: finite olmayanları yok sayar, hiç yoksa null', () => {
  assert.equal(mean([1, 2, 3]), 2);
  assert.equal(mean([1, NaN, null, undefined, 5]), 3);
  assert.equal(mean([]), null);
  assert.equal(mean([NaN]), null);
});

test('median: tek/çift sayıda eleman', () => {
  assert.equal(median([1, 2, 3]), 2);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([5]), 5);
});

test('groupRows: tur/ayak/aci grubuna ayırır, vuruş sayısını doğru sayar', () => {
  const rows = [
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'iyi', total: 90, items: [] },
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'kotu', total: 40, items: [] },
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 80, items: [] },
  ];
  const groups = groupRows(rows);
  assert.equal(groups.length, 2);
  const frikik = groups.find((g) => g.tur === 'frikik');
  assert.equal(frikik.vurusSayisi, 2);
});

test('groupRows: ayrışma = iyi ortalama - kötü ortalama', () => {
  const rows = [
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'iyi', total: 90, items: [] },
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'iyi', total: 80, items: [] },
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'kotu', total: 40, items: [] },
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'kotu', total: 30, items: [] },
  ];
  const [g] = groupRows(rows);
  assert.equal(g.iyiOrtPuan, 85);
  assert.equal(g.kotuOrtPuan, 35);
  assert.equal(g.ayrisma, 50);
});

test('groupRows: iyi ya da kötü örnek eksikse ayrışma null (yanlış "0 fark" gösterilmez)', () => {
  const rows = [
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 90, items: [] },
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'etiketsiz', total: 60, items: [] },
  ];
  const [g] = groupRows(rows);
  assert.equal(g.kotuOrtPuan, null);
  assert.equal(g.ayrisma, null);
});

test('groupRows: total null (ölçülemez) satırlar ortalamadan dışlanır ama sayılır', () => {
  const rows = [
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 90, items: [] },
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: null, items: [] },
  ];
  const [g] = groupRows(rows);
  assert.equal(g.iyiOrtPuan, 90);
  assert.equal(g.olculemezSayisi, 1);
  assert.equal(g.vurusSayisi, 2);
});

test('groupRows: her kuralın medyan/min/max/n değeri hesaplanır', () => {
  const rows = [
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 90, items: [{ key: 'trunk', value: 10, score: 90 }] },
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 80, items: [{ key: 'trunk', value: 20, score: 70 }] },
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'kotu', total: 30, items: [{ key: 'trunk', value: null, score: null }] },
  ];
  const [g] = groupRows(rows);
  assert.deepEqual(g.kurallar.trunk, { medyan: 15, min: 10, max: 20, n: 2 });
});

test('groupRows: birden fazla grup tur/ayak/aci sırasına dizilir', () => {
  const rows = [
    { tur: 'plase', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 1, items: [] },
    { tur: 'ayakustu', ayak: 'sag', aci: 'yandan', etiket: 'iyi', total: 1, items: [] },
    { tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'iyi', total: 1, items: [] },
  ];
  const groups = groupRows(rows);
  assert.deepEqual(groups.map((g) => g.tur), ['ayakustu', 'frikik', 'plase']);
});
