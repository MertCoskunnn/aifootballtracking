// Artifact yayını içerik türüne göre kısıtlı: .tflite/.task/.bin (application/octet-stream)
// kabul edilmiyor (bkz. scripts/artifact-paketle.mjs). O yüzden bu üç uzantı pakette
// '<ad>.b64.txt' (düz metin, base64) olarak durur; ham dosya sadece yerel geliştirmede var.
// loadModelBytes bu ikisini birbirinden gizler: önce ham yolu dener (yerelde çalışır — dosya
// zaten var), 404/hata olursa '<yol>.b64.txt'yi dener (Artifact'te çalışır — paketleyicinin
// ürettiği dosya). Kullananlar: vision.js (MediaPipe modelAssetBuffer), movenet.js (TF.js shard'ları).
//
// base64ToBytes SAF: atob/Buffer'a bağlı değil, Node'da (tests/modelLoader.test.mjs) ve
// tarayıcıda aynı davranır — atob tarayıcıda var ama Node'un eski sürümlerinde yok, Buffer ise
// tarayıcıda yok; ikisinden de bağımsız elle base64 çözücü daha güvenilir.

const B64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const B64_LOOKUP = (() => {
  const t = new Uint8Array(256).fill(255);
  for (let i = 0; i < B64_CHARS.length; i++) t[B64_CHARS.charCodeAt(i)] = i;
  return t;
})();

/** Saf: base64 metnini Uint8Array'e çevirir. Boşluk/satır sonu yok sayılır, '=' dolgusu desteklenir. */
export function base64ToBytes(base64) {
  const clean = String(base64).replace(/[^A-Za-z0-9+/=]/g, '');
  if (clean.length % 4 !== 0) throw new Error(`Geçersiz base64 uzunluğu (${clean.length}, 4'ün katı değil)`);
  let outLen = (clean.length / 4) * 3;
  if (clean.endsWith('==')) outLen -= 2;
  else if (clean.endsWith('=')) outLen -= 1;
  const bytes = new Uint8Array(outLen);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = B64_LOOKUP[clean.charCodeAt(i)];
    const e2 = B64_LOOKUP[clean.charCodeAt(i + 1)];
    const e3 = B64_LOOKUP[clean.charCodeAt(i + 2)];
    const e4 = B64_LOOKUP[clean.charCodeAt(i + 3)];
    bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (clean[i + 2] !== '=') bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (clean[i + 3] !== '=') bytes[p++] = ((e3 & 3) << 6) | e4;
  }
  return bytes;
}

/** Saf: Uint8Array listesini tek bir Uint8Array'de birleştirir (TF.js shard'larını sıraya dizmek için). */
export function concatBytes(chunks) {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) { out.set(c, offset); offset += c.length; }
  return out;
}

/**
 * url: mutlak ya da göreli bir dosya yolu (sorgu eki YOK — bu model dosyaları versiyon almaz).
 * Önce url'yi olduğu gibi fetch eder (yerel dev sunucusu: ham .task/.tflite/.bin orada durur).
 * Başarısızsa url + '.b64.txt'yi dener (Artifact paketi: sadece bu var) ve base64'ü çözer.
 * Her ikisi de başarısızsa anlaşılır bir hata fırlatır (sessizce boş dönmez).
 */
export async function loadModelBytes(url) {
  let direct;
  try { direct = await fetch(url); } catch { direct = null; }
  if (direct?.ok) return new Uint8Array(await direct.arrayBuffer());

  const b64Url = `${url}.b64.txt`;
  const res = await fetch(b64Url);
  if (!res.ok) {
    throw new Error(`Model dosyası bulunamadı: ne '${url}' ne '${b64Url}' (HTTP ${res.status}).`);
  }
  return base64ToBytes(await res.text());
}
