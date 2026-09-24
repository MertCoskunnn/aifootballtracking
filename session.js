// session.js — Seans özeti (2026-09-25). Bir videoda birden çok vuruş varsa hepsini tek bakışta
// özetler: kaç tanesi puanlanabildi, ortalama, en iyi/en zayıf vuruş, tekrar eden postür farkları.
// Saf modül, DOM yok, Node testli (tests/session.test.mjs). Tek vuruşun puanlanması app.js
// placementReport ile birebir aynı zincir (buildTrack → referenceFor → contactPosture →
// compareToReference); burada sadece o zincir N vuruş üzerinde tekrarlanıp toplanıyor.
import { buildTrack } from './metrics.js?v=55';
import { contactPosture, compareToReference, referenceFor, POSTURE_KEYS, POSTURE_LABEL } from './metrics3d.js?v=55';

/**
 * Tek bir vuruşu (analysis.js collectKicks çıktısı) Messi referansına göre puanlar.
 * kick: { frames: [{t, people}], contact, rest: {x,y,w}, t }. foot: 'left' | 'right'.
 * ref: referans/messi-plase.json içeriği.
 * Dönen: { t, total (0-100) | null, items } — items placementReport'taki gibi (bkz. compareToReference).
 */
// seed: kullanıcının dokunarak seçtiği oyuncu (app.js state.seed); raporla aynı kişiyi puanlamak için.
export function scoreKick(kick, foot, ref, seed = null) {
  const track = buildTrack(kick.frames.map((f) => f.people), kick.contact, { x: kick.rest.x, y: kick.rest.y }, seed);
  const r = referenceFor(ref, foot);
  const posture = contactPosture(track, kick.contact, foot);
  if (!r || !posture) return { t: kick.t, total: null, items: [] };
  const cmp = compareToReference(posture, r.posture, 'Messi');
  return { t: kick.t, total: cmp.total, items: cmp.items };
}

// items içinde score < 85 olan bir kaydın diff'i: yön hesaplamak için tek yerde toplanır.
function directionOf(diffs) {
  const neg = diffs.filter((d) => d < 0).length;
  const pos = diffs.filter((d) => d > 0).length;
  if (neg === pos) return 'mixed';
  return neg > pos ? 'less' : 'more';
}

/**
 * Bir seansın (aynı videodaki tüm vuruşlar) scoreKick sonuçlarını özetler.
 * results: scoreKick çıktılarının dizisi.
 * Dönen: { count, scored, unscored, avg, best, worst, issues }.
 * issues: en sık tekrar eden (n >= 2) postür farkları, en çok tekrarlanan önce, en fazla 3 tane.
 */
export function summarizeSession(results) {
  const count = results.length;
  const scoredResults = results.filter((r) => r.total !== null);
  const scored = scoredResults.length;
  const unscored = count - scored;
  const avg = scored ? Math.round(scoredResults.reduce((a, r) => a + r.total, 0) / scored) : null;
  let best = null, worst = null;
  for (const r of scoredResults) {
    if (!best || r.total > best.total || (r.total === best.total && r.t < best.t)) best = r;
    if (!worst || r.total < worst.total || (r.total === worst.total && r.t < worst.t)) worst = r;
  }
  const issues = [];
  for (const key of POSTURE_KEYS) {
    const diffs = [];
    for (const r of scoredResults) {
      const item = r.items.find((i) => i.key === key);
      if (item && item.score < 85) diffs.push(item.diff);
    }
    if (diffs.length >= 2) {
      issues.push({ key, label: POSTURE_LABEL[key], n: diffs.length, of: scored, direction: directionOf(diffs) });
    }
  }
  issues.sort((a, b) => b.n - a.n || POSTURE_KEYS.indexOf(a.key) - POSTURE_KEYS.indexOf(b.key));
  return { count, scored, unscored, avg, best, worst, issues: issues.slice(0, 3) };
}

// Yön cümlesi ölçüye özgü (2026-09-25, Frodo): "daha az" uyluk için anlamsızdı. [küçükse, büyükse]
const DIR_PHRASE = {
  supportKnee: ['çoğunlukla daha düz', 'çoğunlukla daha bükük'],
  kickKnee: ['çoğunlukla daha açık', 'çoğunlukla daha bükük'],
  kickHip: ['uyluk çoğunlukla daha geride', 'uyluk çoğunlukla daha önde'],
  trunkLean: ['gövde çoğunlukla daha geride', 'gövde çoğunlukla daha öne eğik'],
  trunkSide: ['çoğunlukla vuran tarafa yatık', 'çoğunlukla destek tarafına yatık'],
  armOpen: ['kol çoğunlukla daha kapalı', 'kol çoğunlukla daha açık'],
};

/** Bir issue kaydını hoca diline çevirir: "Destek dizi: 7/10 vuruşta Messi'den farklı, çoğunlukla daha düz." */
export function issueSentence(issue) {
  const label = issue.label.replace(/ \(.*\)$/, ''); // "Vuran uyluk (+ önde)" → "Vuran uyluk"
  const yon = issue.direction === 'mixed' ? 'iki yönde de' : DIR_PHRASE[issue.key][issue.direction === 'less' ? 0 : 1];
  return `${label}: ${issue.n}/${issue.of} vuruşta Messi'den farklı, ${yon}.`;
}
