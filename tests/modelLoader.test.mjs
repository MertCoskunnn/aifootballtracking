// modelLoader.js saf kısımları: base64ToBytes ve concatBytes. loadModelBytes (fetch'e bağlı)
// tarayıcıya ihtiyaç duyar, burada test edilmez — scripts/artifact-paketle.mjs'in ürettiği
// base64'ü modelLoader.js'in geri çözebildiğini garanti eden asıl kısım budur (cp-artifact-paketleme).
import test from 'node:test';
import assert from 'node:assert/strict';
import { base64ToBytes, concatBytes } from '../modelLoader.js';

test('base64ToBytes: bilinen vektör ("Hello" -> SGVsbG8=)', () => {
  const bytes = base64ToBytes('SGVsbG8=');
  assert.equal(Buffer.from(bytes).toString('utf8'), 'Hello');
});

test('base64ToBytes: dolgusuz (padding yok, uzunluk zaten 4 katı)', () => {
  // "Hello!" (6 bayt) -> base64 8 karakter, dolgu yok
  const bytes = base64ToBytes('SGVsbG8h');
  assert.equal(Buffer.from(bytes).toString('utf8'), 'Hello!');
});

test('base64ToBytes: tek "=" dolgu', () => {
  const bytes = base64ToBytes(Buffer.from('ab').toString('base64')); // 'YWI='
  assert.equal(Buffer.from(bytes).toString('utf8'), 'ab');
});

test('base64ToBytes: çift "==" dolgu', () => {
  const bytes = base64ToBytes(Buffer.from('a').toString('base64')); // 'YQ=='
  assert.equal(Buffer.from(bytes).toString('utf8'), 'a');
});

test('base64ToBytes: model dosyaları gibi rastgele ikili baytlarda (0x00 dahil) tam tur (round-trip)', () => {
  const original = new Uint8Array(4096);
  for (let i = 0; i < original.length; i++) original[i] = (i * 37 + 11) % 256; // 0..255 hepsi geçer
  const b64 = Buffer.from(original).toString('base64'); // paketleyicinin (Node/Buffer) ürettiği metin
  const decoded = base64ToBytes(b64); // modelLoader.js'in (Buffer'sız) çözdüğü hali
  assert.deepEqual(Array.from(decoded), Array.from(original));
});

test('base64ToBytes: boşluk/satır sonu içeren metni yok sayıp çözer', () => {
  const bytes = base64ToBytes('SGVs\nbG8=  ');
  assert.equal(Buffer.from(bytes).toString('utf8'), 'Hello');
});

test('base64ToBytes: 4\'ün katı olmayan uzunlukta anlaşılır hata fırlatır', () => {
  assert.throws(() => base64ToBytes('SGVsbG8'), /uzunlu/);
});

test('concatBytes: birden fazla parçayı sırayla birleştirir (shard birleştirme)', () => {
  const a = new Uint8Array([1, 2, 3]);
  const b = new Uint8Array([4, 5]);
  const c = new Uint8Array([6]);
  assert.deepEqual(Array.from(concatBytes([a, b, c])), [1, 2, 3, 4, 5, 6]);
});

test('concatBytes: boş liste boş dizi döner', () => {
  assert.equal(concatBytes([]).length, 0);
});
