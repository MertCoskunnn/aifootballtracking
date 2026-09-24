// Artifact yayını içerik türüne göre kısıtlı: .html .css .js .mjs .wasm .json .txt .md .csv .svg
// .png .jpg .webp .woff2 .mp4 vb. kabul ediliyor, .tflite/.task/.bin (application/octet-stream)
// REDDEDİLİYOR. artifact-dosyalar.json (scripts/artifact-dosyalar.mjs) "ihtiyaç duyulan dosyalar"
// envanteri; bu betik onu gerçekten yayınlanabilir bir pakete DÖNÜŞTÜRÜR:
//   - .tflite/.task/.bin  -> içerik base64 METNE çevrilir, '<ad>.b64.txt' olarak yazılır
//     (uzantı hilesi YOK: dosya gerçekten metin, modelLoader.js bunu tarayıcıda geri çözer).
//   - başka her şey (.js/.mjs/.css/.html/.json/.wasm/...) olduğu gibi kopyalanır.
//   - vision_wasm_nosimd_* iki dosyası pakete HİÇ girmez: modern telefonlar SIMD destekler,
//     64 MB/sürüm sınırı için gereksiz ~11 MB atılır (vision.js SIMD yoksa önceden anlaşılır
//     hata verir, bkz. FilesetResolver.isSimdSupported() kontrolü).
// Çıktı: <çıkış>/yayin-haritasi.json — { "yayınlanan/yol": "yayınlanan/yol" } (paket kendi içinde
// zaten yayın yapısının aynısı; Artifact publish'in `files` parametresine bu köke göre verilebilir).
//
// Kullanım: node scripts/artifact-paketle.mjs <çıkış-klasörü>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
export const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');

// Artifact'in application/octet-stream diye reddettiği uzantılar: base64 metne çevrilir.
export const BASE64_EXTS = new Set(['.tflite', '.task', '.bin']);

// 64 MB/sürüm sınırı için pakete hiç alınmaz — modern telefonlar SIMD destekler, SIMD'siz
// yedek yalnızca eski/nadir tarayıcılar için (bkz. vision.js'teki isSimdSupported kontrolü).
export const PACKAGE_EXCLUDE = new Set([
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_nosimd_internal.wasm',
]);

/** artifact-dosyalar.json'u okur: { yayınYolu: yerelYolu } (bu projede ikisi aynı, bkz. o betik). */
export function loadManifest() {
  const raw = fs.readFileSync(path.join(PROJECT_ROOT, 'artifact-dosyalar.json'), 'utf8');
  return JSON.parse(raw);
}

/** Bir dosyanın PAKETTEKİ yayın adı: base64 uzantılarda '<yol>.b64.txt', diğerlerinde değişmez. */
export function publishNameFor(relPath) {
  const ext = path.extname(relPath).toLowerCase();
  return BASE64_EXTS.has(ext) ? `${relPath}.b64.txt` : relPath;
}

/**
 * artifact-dosyalar.json'daki her dosyayı outDir'e yazar (base64 dönüşümü + nosimd hariç tutma
 * dahil) ve outDir/yayin-haritasi.json'u üretir. Dönen: { files:[{path,bytes,base64}], totalBytes }.
 */
export function buildPackage(outDir) {
  const manifest = loadManifest();
  fs.mkdirSync(outDir, { recursive: true });

  const yayinHaritasi = {};
  const files = [];
  for (const yerelYolu of Object.values(manifest)) {
    if (PACKAGE_EXCLUDE.has(yerelYolu)) continue;
    const srcFull = path.join(PROJECT_ROOT, yerelYolu);
    const isBase64 = BASE64_EXTS.has(path.extname(yerelYolu).toLowerCase());
    const destName = publishNameFor(yerelYolu);
    const destFull = path.join(outDir, destName);
    fs.mkdirSync(path.dirname(destFull), { recursive: true });

    if (isBase64) {
      const bin = fs.readFileSync(srcFull);
      fs.writeFileSync(destFull, bin.toString('base64'), 'utf8');
    } else {
      fs.copyFileSync(srcFull, destFull);
    }
    const bytes = fs.statSync(destFull).size;
    yayinHaritasi[destName] = destName;
    files.push({ path: destName, bytes, base64: isBase64 });
  }

  fs.writeFileSync(path.join(outDir, 'yayin-haritasi.json'), JSON.stringify(yayinHaritasi, null, 2) + '\n', 'utf8');
  const totalBytes = files.reduce((sum, f) => sum + f.bytes, 0);
  return { files, totalBytes };
}

const LIMIT_BYTES = 64 * 1024 * 1024;

// --- çalıştırılabilir uç (node scripts/artifact-paketle.mjs <çıkış-klasörü>) ---------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

export function main(argv) {
  const outDir = argv[0];
  if (!outDir) {
    console.error('Kullanım: node scripts/artifact-paketle.mjs <çıkış-klasörü>');
    process.exitCode = 1;
    return;
  }
  const { files, totalBytes } = buildPackage(path.resolve(outDir));
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  const limitMb = (LIMIT_BYTES / (1024 * 1024)).toFixed(0);
  console.log(`${files.length} dosya -> ${outDir} (toplam ${mb} MB / ${limitMb} MB sınırı)`);
  if (totalBytes > LIMIT_BYTES) {
    console.error(`UYARI: paket ${limitMb} MB sürüm sınırını aşıyor!`);
    process.exitCode = 1;
  }
  const overSized = files.filter((f) => f.bytes > 15 * 1024 * 1024 && !f.path.endsWith('.b64.txt'));
  const overSizedText = files.filter((f) => f.bytes > 16 * 1024 * 1024);
  for (const f of [...overSized, ...overSizedText]) {
    console.error(`UYARI: ${f.path} dosya başı sınırını aşıyor (${(f.bytes / (1024 * 1024)).toFixed(2)} MB)`);
    process.exitCode = 1;
  }
}

if (isMain) main(process.argv.slice(2));
