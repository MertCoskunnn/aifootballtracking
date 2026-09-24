// cp-19-referans-liste: tests/referans.html'in bitiş özetini (grup bazlı ayrışma + kural
// kalibrasyonu) hesaplayan saf fonksiyonlar. DOM'a, pipeline.js'e dokunmaz — Node ile test edilir
// (tests/referans-ozet.test.mjs). referans.js bu modülü tarayıcıda import edip aynı fonksiyonları
// tüm sonuçlar toplandıktan sonra çağırır.
//
// Girdi biçimi (bir "satır" = bir vuruşun bir analiz sonucu, referans.js'in ürettiği):
//   { tur, ayak, aci, etiket, total: number|null, items: [{ key, value: number|null, score: number|null }] }
// total: coach.js#evaluate'in döndüğü res.total (insufficient ise null — 'ölçülemez').
// items: coach.js#evaluate'in res.items'ından süzülmüş {key,value,score} (value: ham ölçüm, NaN/yok ise null).

export function mean(nums) {
  const xs = nums.filter((n) => Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(nums) {
  const xs = nums.filter((n) => Number.isFinite(n)).sort((a, b) => a - b);
  if (!xs.length) return null;
  const mid = Math.floor(xs.length / 2);
  return xs.length % 2 ? xs[mid] : (xs[mid - 1] + xs[mid]) / 2;
}

function groupKey(r) { return `${r.tur}/${r.ayak}/${r.aci}`; }

/**
 * Her kuralın (items[].key) medyan/min/max/n değerini bir grup içindeki satırlardan çıkarır.
 * rows: bir (tur,ayak,aci) grubuna ait satırlar.
 * Dönen: { [key]: { medyan, min, max, n } } — sadece finite ölçüm bulunan key'ler için.
 */
function ruleStats(rows) {
  const byKey = new Map();
  for (const r of rows) {
    for (const it of r.items || []) {
      if (!Number.isFinite(it.value)) continue;
      if (!byKey.has(it.key)) byKey.set(it.key, []);
      byKey.get(it.key).push(it.value);
    }
  }
  const out = {};
  for (const [key, vals] of byKey) {
    out[key] = { medyan: median(vals), min: Math.min(...vals), max: Math.max(...vals), n: vals.length };
  }
  return out;
}

/**
 * rows'u (tur,ayak,aci) grubuna göre böler, her grup için vuruş sayısı, iyi/kötü ortalama puan,
 * ayrışma (iyi−kötü, biri eksikse null) ve her kuralın medyan/min/max'ını hesaplar.
 * Dönen: grup özetleri dizisi, tur→ayak→aci sırasına dizilmiş (kararlı rapor sırası).
 */
export function groupRows(rows) {
  const byGroup = new Map();
  for (const r of rows) {
    const k = groupKey(r);
    if (!byGroup.has(k)) byGroup.set(k, []);
    byGroup.get(k).push(r);
  }
  const groups = [];
  for (const [, entries] of byGroup) {
    const { tur, ayak, aci } = entries[0];
    const iyi = entries.filter((r) => r.etiket === 'iyi').map((r) => r.total);
    const kotu = entries.filter((r) => r.etiket === 'kotu').map((r) => r.total);
    const iyiOrtPuan = mean(iyi);
    const kotuOrtPuan = mean(kotu);
    const olculemezSayisi = entries.filter((r) => r.total === null || r.total === undefined).length;
    groups.push({
      tur, ayak, aci,
      vurusSayisi: entries.length,
      iyiOrtPuan,
      kotuOrtPuan,
      ayrisma: (iyiOrtPuan !== null && kotuOrtPuan !== null) ? iyiOrtPuan - kotuOrtPuan : null,
      olculemezSayisi,
      kurallar: ruleStats(entries),
    });
  }
  groups.sort((a, b) => a.tur.localeCompare(b.tur) || a.ayak.localeCompare(b.ayak) || a.aci.localeCompare(b.aci));
  return groups;
}
