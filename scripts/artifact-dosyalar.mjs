// Artifact barındırması (claude.ai) için "bu uygulamanın çalışması için gereken TÜM yerel
// dosyalar" listesini üretir. Elle tutulan bir liste değil: index.html'den başlayıp gerçek
// import/script/link/url() grafiğini izler, ayrıca models/ ve vendor/ altındaki her şeyi
// (movenet shard'ları, MediaPipe wasm ikilileri — bunlar import değil runtime'da new URL()/fetch
// ile çekiliyor, statik taramayla görünmezler) koşulsuz ekler. Çıktı: artifact-dosyalar.json,
// { "yayin/yolu": "yerel/yolu" } biçiminde — Artifact publish'in `files` parametresine doğrudan
// verilebilecek şekilde. tests/, scripts/, test-videolar/ ve *.md hariçtir (Artifact'e girmez).
//
// Sorgu ekleri (app.js?v=30 gibi, cp-*'ten beri cache-bust için var): tarayıcı bunu ister ama
// statik sunucu yok sayar, bu yüzden harita düz dosya yoluyla tutulur — hem anahtar hem değer
// query'siz.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
export const PROJECT_ROOT = path.join(SCRIPT_DIR, '..');

// Bu üst klasörler Artifact'e hiç girmez (testler, üretim betikleri, kişisel videolar).
const EXCLUDED_TOP_DIRS = new Set(['tests', 'scripts', 'test-videolar']);
// Bu klasörlerin TAMAMI (statik taramadan bağımsız) dahil edilir: model dosyaları ve vendor
// kütüphaneleri import değil, runtime'da new URL(import.meta.url)/FilesetResolver ile çekiliyor.
const ALWAYS_INCLUDE_DIRS = ['models', 'vendor'];

const GRAPH_EXTS = new Set(['.js', '.mjs', '.css']); // bu uzantılar için içerik taranıp izlenir
const EXCLUDED_EXTS = new Set(['.md']);

/** posix ('/') ayraçlı, PROJECT_ROOT'a göre göreli yol. Windows'ta bile '/' döner. */
export function toPosixRelative(fullPath) {
  return path.relative(PROJECT_ROOT, fullPath).split(path.sep).join('/');
}

/** '?v=30' gibi sorgu eklerini atar. Yol parçası olmayan '#' sonrasını da atar (varsa). */
export function stripQuery(specifier) {
  return specifier.split('#')[0].split('?')[0];
}

/** İlk üst klasörü tests/scripts/test-videolar olan ya da .md uzantılı her yol elenir. */
function isExcluded(relPosixPath) {
  const top = relPosixPath.split('/')[0];
  if (EXCLUDED_TOP_DIRS.has(top)) return true;
  if (EXCLUDED_EXTS.has(path.extname(relPosixPath).toLowerCase())) return true;
  return false;
}

// <script ... src="...">, <link ... href="..."> — sadece bu iki etiket (footer'daki
// <a href="RESEARCH.md"> gibi başka bağlantılar bilinçli olarak yakalanmaz).
const HTML_SRC_RE = /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
const HTML_HREF_RE = /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi;

// import x from '...'; import {a} from '...'; import * as a from '...'; import '...'; ve import('...')
const JS_IMPORT_RE = /\bimport\s+(?:[^'";]*?\sfrom\s+)?["']([^"']+)["']/g;
const JS_DYNAMIC_IMPORT_RE = /\bimport\(\s*["']([^"']+)["']\s*\)/g;

// CSS url(...) — bugün stil dosyasında yerel referans yok ama ileride eklenirse taranır.
const CSS_URL_RE = /url\(\s*["']?([^"')]+)["']?\s*\)/g;

function extractSpecifiers(content, kind) {
  const specs = [];
  const push = (re) => { let m; while ((m = re.exec(content))) specs.push(m[1]); };
  if (kind === 'html') { push(HTML_SRC_RE); push(HTML_HREF_RE); }
  else if (kind === 'css') { push(CSS_URL_RE); }
  else { push(JS_IMPORT_RE); push(JS_DYNAMIC_IMPORT_RE); }
  return specs;
}

function isLocalSpecifier(spec) {
  if (/^[a-z]+:\/\//i.test(spec)) return false; // http(s):, data:, blob: vb. — yerel değil
  return true;
}

/**
 * index.html'den başlayıp yerel import/script/link/url() grafiğini gezer.
 * Dönen: Set<string> (PROJECT_ROOT'a göre posix göreli yollar, sorgusuz).
 */
export function walkGraph(entryRelPath) {
  const visited = new Set();
  const queue = [entryRelPath];

  while (queue.length) {
    const relPath = queue.shift();
    if (visited.has(relPath)) continue;
    if (isExcluded(relPath)) continue;
    const fullPath = path.join(PROJECT_ROOT, relPath);
    if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) continue;
    visited.add(relPath);

    const ext = path.extname(relPath).toLowerCase();
    const kind = ext === '.html' || ext === '.htm' ? 'html' : ext === '.css' ? 'css' : 'js';
    if (kind !== 'html' && !GRAPH_EXTS.has(ext)) continue; // .json vb. içerik taranmaz, sadece toplanır

    const content = fs.readFileSync(fullPath, 'utf8');
    const dir = path.dirname(fullPath);
    for (const rawSpec of extractSpecifiers(content, kind)) {
      if (!isLocalSpecifier(rawSpec)) continue;
      const cleanSpec = stripQuery(rawSpec);
      if (!cleanSpec) continue;
      const resolved = path.resolve(dir, cleanSpec);
      const rel = toPosixRelative(resolved);
      if (rel.startsWith('..')) continue; // proje dışına çıkan yol yok sayılır
      queue.push(rel);
    }
  }
  return visited;
}

/** dir (PROJECT_ROOT'a göreli, posix) altındaki her dosyayı (hariç: .md) rekürsif toplar. */
function walkDirAll(relDir) {
  const out = [];
  const fullDir = path.join(PROJECT_ROOT, relDir);
  if (!fs.existsSync(fullDir)) return out;
  const walk = (d) => {
    for (const ent of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) { walk(full); continue; }
      if (!ent.isFile()) continue;
      const rel = toPosixRelative(full);
      if (isExcluded(rel)) continue;
      out.push(rel);
    }
  };
  walk(fullDir);
  return out;
}

/** Tüm dosya listesini üretir: grafik taraması + models//vendor/ tam içeriği. Sıralı döner. */
export function collectArtifactFiles(entryRelPath = 'index.html') {
  const set = new Set(walkGraph(entryRelPath));
  for (const dir of ALWAYS_INCLUDE_DIRS) for (const rel of walkDirAll(dir)) set.add(rel);
  return [...set].sort((a, b) => a.localeCompare(b));
}

/** { "yayin/yolu": "yerel/yolu" } — bu projede ikisi de aynı (yeniden adlandırma/bundling yok). */
export function buildManifest(files) {
  const map = {};
  for (const f of files) map[f] = f;
  return map;
}

function fileSize(relPath) {
  return fs.statSync(path.join(PROJECT_ROOT, relPath)).size;
}

// --- çalıştırılabilir uç (node scripts/artifact-dosyalar.mjs) -----------------------------------
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);

export function main() {
  const files = collectArtifactFiles('index.html');
  const manifest = buildManifest(files);
  const outFile = path.join(PROJECT_ROOT, 'artifact-dosyalar.json');
  fs.writeFileSync(outFile, JSON.stringify(manifest, null, 2) + '\n', 'utf8');

  const totalBytes = files.reduce((sum, f) => sum + fileSize(f), 0);
  const mb = (totalBytes / (1024 * 1024)).toFixed(2);
  console.log(`${files.length} dosya -> ${toPosixRelative(outFile)} (toplam ${mb} MB)`);
}

if (isMain) main();
