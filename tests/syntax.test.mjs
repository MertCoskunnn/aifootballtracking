// Tarayıcı modüllerinin sözdizimi kontrolü (2026-09-25). Neden: `node --check app.js` kökteki .js
// dosyasında sözdizimi hatasını sessizce geçti ('Messi'nin' tırnak hatası push'landı, uygulama
// açılmadı). Aynı içerik .mjs olarak kontrol edilince hata yakalanıyor; bu test her dosyayı öyle dener.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  ...fs.readdirSync(root).filter((f) => f.endsWith('.js')).map((f) => path.join(root, f)),
  ...fs.readdirSync(path.join(root, 'tests')).filter((f) => f.endsWith('.js')).map((f) => path.join(root, 'tests', f)),
];
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hoca-syntax-'));

for (const file of files) {
  test(`sözdizimi (ES modülü): ${path.relative(root, file)}`, () => {
    const copy = path.join(tmp, path.basename(file, '.js') + '.mjs');
    fs.copyFileSync(file, copy);
    const r = spawnSync(process.execPath, ['--check', copy], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
  });
}
