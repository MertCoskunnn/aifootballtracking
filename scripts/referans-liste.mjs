// cp-19-referans-liste: test-videolar/ ağacını tarayıp tests/referans-liste.json üretir.
// Menü artık seçmeli (cp-15-secmeli-menu, otomatik mod yok): her videonun (açı, tür, ayak)
// seçimi artık klasör yolundan geliyor, elle yazılmış bir liste (eski tests/referans-liste.json,
// cp-14-referans-toplu) yerine. Beklenen yapı, test-videolar'a göre:
//   <tur>/<ayak>/<aci>/<etiket>_<ad>.mp4
//   tur    ∈ {frikik, plase, ayakustu, pas}
//   ayak   ∈ {sol, sag}
//   aci    ∈ {yandan, arkadan}
//   etiket ∈ {iyi, kotu} — dosya adı bu önekle BAŞLAMIYORSA 'etiketsiz' sayılır (öneki yok demek
//            "iyi/kötü" diye ayrıca etiketlenmemiş, referans.html yine de analiz eder).
// Bu yapıya UYMAYAN her .mp4 (kök dizindeki eski dosyalar, tests/referans.html'in eski
// test-videolar/referans/ klasörü, yanlış derinlik/isim) ATLANIR ve ekrana nedeniyle listelenir —
// sessizce yutulmaz, çünkü Mert'in kendi videolarını yanlış yere koyması kolay bir hata.
//
// Saf kısım (Node testli, tests/referans-liste.test.mjs): parseEntryPath, buildListe,
// encodeRelPathForFetch. Taramanın kendisi (scanTestVideolar) fs'e dokunur, saf değildir ama
// gerçek bir geçici klasörle de test edilebilir (aynı dosyada).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const TUR = ['frikik', 'plase', 'ayakustu', 'pas'];
export const AYAK = ['sol', 'sag'];
export const ACI = ['yandan', 'arkadan'];
export const ETIKET = ['iyi', 'kotu'];

// Klasör taksonomisi (Türkçe) → pipeline.analyzeKick/rules.getRuleSet'in beklediği İngilizce
// kodlar (bkz. index.html'deki <select> value'ları: mode shot/placement/pass/freekick,
// foot right/left, angle side/behind). referans.js bunu her girişte bir kez kullanır.
export const TUR_TO_MODE = { ayakustu: 'shot', plase: 'placement', pas: 'pass', frikik: 'freekick' };
export const AYAK_TO_FOOT = { sag: 'right', sol: 'left' };
export const ACI_TO_ANGLE = { yandan: 'side', arkadan: 'behind' };

/**
 * Bir referans-liste.json girişini (tur/ayak/aci) pipeline.analyzeKick + rules.getRuleSet'in
 * beklediği { mode, foot, angle } üçlüsüne çevirir. entry: { tur, ayak, aci, ... } (parseEntryPath
 * çıktısı ya da referans-liste.json'daki bir kayıt).
 */
export function toPipelineParams(entry) {
  return { mode: TUR_TO_MODE[entry.tur], foot: AYAK_TO_FOOT[entry.ayak], angle: ACI_TO_ANGLE[entry.aci] };
}

/**
 * test-videolar'a göre göreli, '/' ayraçlı bir dosya yolunu ayrıştırır.
 * relPosixPath: ör. 'frikik/sol/arkadan/iyi_Messi.mp4' (her zaman '/' ayraçlı, Windows'ta bile —
 * çağıran taraf path.sep'i '/'e çevirmiş olmalı, bkz. toPosixRelative).
 * Dönen: { ok:true, entry:{file,tur,ayak,aci,etiket} } ya da { ok:false, reason }.
 */
export function parseEntryPath(relPosixPath) {
  const segments = relPosixPath.split('/').filter(Boolean);
  if (segments.length !== 4) {
    return { ok: false, reason: `beklenen yapı tur/ayak/aci/dosya.mp4 (derinlik 4), bulunan derinlik ${segments.length}` };
  }
  const [tur, ayak, aci, filename] = segments;
  if (!TUR.includes(tur)) return { ok: false, reason: `bilinmeyen tür klasörü '${tur}' (beklenen: ${TUR.join('/')})` };
  if (!AYAK.includes(ayak)) return { ok: false, reason: `bilinmeyen ayak klasörü '${ayak}' (beklenen: ${AYAK.join('/')})` };
  if (!ACI.includes(aci)) return { ok: false, reason: `bilinmeyen açı klasörü '${aci}' (beklenen: ${ACI.join('/')})` };
  if (!/\.mp4$/i.test(filename)) return { ok: false, reason: `.mp4 değil: '${filename}'` };

  const m = /^(iyi|kotu)_/.exec(filename);
  const etiket = m ? m[1] : 'etiketsiz';

  return { ok: true, entry: { file: relPosixPath, tur, ayak, aci, etiket } };
}

/** path.relative + Windows ayracını '/'e çevirir (JSON ve tarayıcı fetch'i her zaman '/' bekler). */
export function toPosixRelative(baseDir, fullPath) {
  return path.relative(baseDir, fullPath).split(path.sep).join('/');
}

/**
 * Bir test-videolar-göreli yolu tarayıcıda fetch edilebilecek bir URL parçasına çevirir.
 * Türkçe/boşluklu/özel karakterli dosya adları için: '/' ayracını KORUYUP her segmenti AYRI AYRI
 * encodeURIComponent ile kodluyoruz — tüm yolu tek seferde kodlarsak '/' de kaçırılıp yol bozulur.
 */
export function encodeRelPathForFetch(relPosixPath) {
  return relPosixPath.split('/').map(encodeURIComponent).join('/');
}

/**
 * klipler dizisini (parseEntryPath'in ürettiği entry'ler) tur→ayak→aci→file sırasına dizip
 * referans.html'in okuyacağı JSON gövdesini üretir. Sıralama: git diff'i kararlı tutmak için.
 */
export function buildListe(entries) {
  const sorted = [...entries].sort((a, b) =>
    a.tur.localeCompare(b.tur) || a.ayak.localeCompare(b.ayak) || a.aci.localeCompare(b.aci) || a.file.localeCompare(b.file));
  return {
    _not: "cp-19-referans-liste: scripts/referans-liste.mjs ile test-videolar/ ağacından üretildi (elle düzenlenmez). "
      + "Yapı: test-videolar/<tur>/<ayak>/<aci>/<etiket>_<ad>.mp4 (tur∈frikik/plase/ayakustu/pas, "
      + "ayak∈sol/sag, aci∈yandan/arkadan, etiket∈iyi/kotu, önek yoksa 'etiketsiz'). Yeniden üretmek için: "
      + "`node scripts/referans-liste.mjs`.",
    klipler: sorted,
  };
}

/**
 * rootDir (test-videolar) altını rekürsif tarar, her .mp4 için parseEntryPath çalıştırır.
 * Dönen: { kabul: [entry,...], atlanan: [{file, reason}, ...] } — dosya sistemine dokunur, saf değil.
 */
export function scanTestVideolar(rootDir) {
  const kabul = [];
  const atlanan = [];
  if (!fs.existsSync(rootDir)) return { kabul, atlanan };

  const walk = (dir) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.isFile()) continue;
      if (!/\.mp4$/i.test(ent.name)) continue; // .mov/.webm vb. bu araca dahil değil
      const rel = toPosixRelative(rootDir, full);
      const parsed = parseEntryPath(rel);
      if (parsed.ok) kabul.push(parsed.entry);
      else atlanan.push({ file: rel, reason: parsed.reason });
    }
  };
  walk(rootDir);
  return { kabul, atlanan };
}

// --- çalıştırılabilir uç (node scripts/referans-liste.mjs) -------------------------------------
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

export function main() {
  const scriptDir = path.dirname(__filename);
  const projectRoot = path.join(scriptDir, '..');
  const testVideolarDir = path.join(projectRoot, 'test-videolar');
  const outFile = path.join(projectRoot, 'tests', 'referans-liste.json');

  const { kabul, atlanan } = scanTestVideolar(testVideolarDir);
  const liste = buildListe(kabul);
  fs.writeFileSync(outFile, JSON.stringify(liste, null, 2) + '\n', 'utf8');

  console.log(`${kabul.length} klip kabul edildi -> ${toPosixRelative(projectRoot, outFile)}`);
  if (atlanan.length) {
    console.log(`${atlanan.length} dosya atlandı (yapıya uymuyor):`);
    for (const a of atlanan) console.log(`  - ${a.file}: ${a.reason}`);
  }
}

if (isMain) main();
