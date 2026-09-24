// scripts/referans-liste.mjs testleri (cp-19-referans-liste): yol ayrıştırma, fetch kodlama ve
// liste inşası saf fonksiyonlar + gerçek geçici klasörle tarama testi.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseEntryPath, encodeRelPathForFetch, buildListe, scanTestVideolar, toPosixRelative, toPipelineParams } from '../scripts/referans-liste.mjs';

test('parseEntryPath: dört seviyeli geçerli yol, etiketli', () => {
  const r = parseEntryPath('frikik/sol/arkadan/iyi_Messi.mp4');
  assert.equal(r.ok, true);
  assert.deepEqual(r.entry, { file: 'frikik/sol/arkadan/iyi_Messi.mp4', tur: 'frikik', ayak: 'sol', aci: 'arkadan', etiket: 'iyi' });
});

test('parseEntryPath: kotu etiketi de tanınır', () => {
  const r = parseEntryPath('plase/sag/yandan/kotu_deneme.mp4');
  assert.equal(r.ok, true);
  assert.equal(r.entry.etiket, 'kotu');
});

test('parseEntryPath: önek yoksa etiketsiz sayılır', () => {
  const r = parseEntryPath('ayakustu/sag/yandan/Ronaldo.mp4');
  assert.equal(r.ok, true);
  assert.equal(r.entry.etiket, 'etiketsiz');
});

test('parseEntryPath: Türkçe/boşluklu/özel karakterli dosya adı sorunsuz ayrıştırılır', () => {
  const r = parseEntryPath('pas/sol/yandan/iyi_Kane, Pritchard, Baker & Eric Dier ... (1080p).mp4');
  assert.equal(r.ok, true);
  assert.equal(r.entry.tur, 'pas');
  assert.equal(r.entry.etiket, 'iyi');
  assert.equal(r.entry.file, 'pas/sol/yandan/iyi_Kane, Pritchard, Baker & Eric Dier ... (1080p).mp4');
});

test('parseEntryPath: emoji/özel unicode içeren dosya adı sorunsuz ayrıştırılır', () => {
  const r = parseEntryPath('frikik/sag/arkadan/etiketsiz-degil_Schusstechnik.\u{FE0F}.mp4');
  // önek "etiketsiz-degil_" iyi/kotu değil, o yüzden etiketsiz kalması beklenir.
  assert.equal(r.ok, true);
  assert.equal(r.entry.etiket, 'etiketsiz');
});

test('parseEntryPath: yanlış derinlik (kök dizindeki eski dosyalar) reddedilir', () => {
  const r = parseEntryPath('Lionel Messi Amazing Freekick Goal in Training _ HD.mp4');
  assert.equal(r.ok, false);
  assert.match(r.reason, /derinlik/);
});

test('parseEntryPath: eski "referans/" klasörü (derinlik 2) reddedilir', () => {
  const r = parseEntryPath('referans/WhatsApp Video 2026-09-23 at 15.08.39.mp4');
  assert.equal(r.ok, false);
});

test('parseEntryPath: bilinmeyen tür klasörü reddedilir', () => {
  const r = parseEntryPath('sut/sol/yandan/iyi_x.mp4');
  assert.equal(r.ok, false);
  assert.match(r.reason, /tür klasörü/);
});

test('parseEntryPath: bilinmeyen ayak klasörü reddedilir', () => {
  const r = parseEntryPath('frikik/left/yandan/iyi_x.mp4');
  assert.equal(r.ok, false);
  assert.match(r.reason, /ayak klasörü/);
});

test('parseEntryPath: bilinmeyen açı klasörü reddedilir', () => {
  const r = parseEntryPath('frikik/sol/onden/iyi_x.mp4');
  assert.equal(r.ok, false);
  assert.match(r.reason, /açı klasörü/);
});

test('parseEntryPath: .mp4 olmayan dosya reddedilir', () => {
  const r = parseEntryPath('frikik/sol/arkadan/iyi_x.mov');
  assert.equal(r.ok, false);
  assert.match(r.reason, /\.mp4/);
});

test('encodeRelPathForFetch: her segment ayrı kodlanır, / korunur', () => {
  const enc = encodeRelPathForFetch('pas/sol/yandan/iyi_Kane, Pritchard & Baker.mp4');
  assert.equal(enc, 'pas/sol/yandan/' + encodeURIComponent('iyi_Kane, Pritchard & Baker.mp4'));
  assert.ok(!enc.includes('%2F'), 'ayraç kodlanmamalı');
});

test('encodeRelPathForFetch: emoji ve nokta içeren ad doğru kodlanır', () => {
  const name = 'iyi_Schusstechnik.\u{FE0F}.mp4';
  const enc = encodeRelPathForFetch(`frikik/sag/arkadan/${name}`);
  assert.equal(enc, `frikik/sag/arkadan/${encodeURIComponent(name)}`);
});

test('buildListe: tur/ayak/aci/file sırasına diziyor', () => {
  const entries = [
    { file: 'pas/sol/yandan/b.mp4', tur: 'pas', ayak: 'sol', aci: 'yandan', etiket: 'etiketsiz' },
    { file: 'ayakustu/sag/yandan/a.mp4', tur: 'ayakustu', ayak: 'sag', aci: 'yandan', etiket: 'iyi' },
    { file: 'ayakustu/sag/yandan/z.mp4', tur: 'ayakustu', ayak: 'sag', aci: 'yandan', etiket: 'iyi' },
  ];
  const liste = buildListe(entries);
  assert.deepEqual(liste.klipler.map((e) => e.file), [
    'ayakustu/sag/yandan/a.mp4', 'ayakustu/sag/yandan/z.mp4', 'pas/sol/yandan/b.mp4',
  ]);
  assert.ok(typeof liste._not === 'string' && liste._not.length > 0);
});

test('scanTestVideolar: gerçek geçici klasörde uyanları kabul eder, uymayanları nedeniyle atlar', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'referans-liste-test-'));
  try {
    const mk = (rel) => { const full = path.join(tmp, ...rel.split('/')); fs.mkdirSync(path.dirname(full), { recursive: true }); fs.writeFileSync(full, ''); };
    mk('frikik/sol/arkadan/iyi_Messi.mp4');
    mk('ayakustu/sag/yandan/Ronaldo.mp4'); // etiketsiz
    mk('eski-kok-dosyasi.mp4'); // derinlik 1: yapıya uymuyor
    mk('referans/eski.mp4'); // derinlik 2: eski yapı
    mk('frikik/sol/arkadan/notes.txt'); // .mp4 değil, taramaya hiç girmemeli

    const { kabul, atlanan } = scanTestVideolar(tmp);
    assert.equal(kabul.length, 2);
    assert.ok(kabul.some((e) => e.file === 'frikik/sol/arkadan/iyi_Messi.mp4' && e.etiket === 'iyi'));
    assert.ok(kabul.some((e) => e.file === 'ayakustu/sag/yandan/Ronaldo.mp4' && e.etiket === 'etiketsiz'));
    // notes.txt tarama sırasında hiç dosya adayı olarak görülmediği için atlanan'da da yok.
    assert.equal(atlanan.length, 2);
    assert.ok(atlanan.some((a) => a.file === 'eski-kok-dosyasi.mp4'));
    assert.ok(atlanan.some((a) => a.file === 'referans/eski.mp4'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test('scanTestVideolar: kök dizin yoksa çökmeden boş sonuç döner', () => {
  const missing = path.join(os.tmpdir(), 'referans-liste-test-yok-' + Date.now());
  const { kabul, atlanan } = scanTestVideolar(missing);
  assert.deepEqual(kabul, []);
  assert.deepEqual(atlanan, []);
});

test('toPipelineParams: tur/ayak/aci -> mode/foot/angle eşlemesi', () => {
  assert.deepEqual(toPipelineParams({ tur: 'ayakustu', ayak: 'sag', aci: 'yandan' }), { mode: 'shot', foot: 'right', angle: 'side' });
  assert.deepEqual(toPipelineParams({ tur: 'plase', ayak: 'sol', aci: 'yandan' }), { mode: 'placement', foot: 'left', angle: 'side' });
  assert.deepEqual(toPipelineParams({ tur: 'pas', ayak: 'sag', aci: 'yandan' }), { mode: 'pass', foot: 'right', angle: 'side' });
  assert.deepEqual(toPipelineParams({ tur: 'frikik', ayak: 'sol', aci: 'arkadan' }), { mode: 'freekick', foot: 'left', angle: 'behind' });
});

test('toPosixRelative: Windows ayracı da / olarak döner', () => {
  const rel = toPosixRelative(path.join('a', 'b'), path.join('a', 'b', 'c', 'd.mp4'));
  assert.equal(rel, 'c/d.mp4');
});
