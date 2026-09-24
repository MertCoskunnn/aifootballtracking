// metrics3d.js testleri: 3D açılar kamera yönünden bağımsız mı, referans kıyası doğru mu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { angle3, posture3d, contactPosture, compareToReference, referenceFor } from '../metrics3d.js';

// Sahte 3D iskelet (metre, y aşağı): sağ ayakla vuran, destek (sol) dizi supportFlex kadar bükük.
function body({ supportFlex = 30, kickFlex = 45, lean = 0 } = {}) {
  const w = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0 }));
  const r = (d) => (d * Math.PI) / 180;
  w[23] = { x: -0.1, y: 0, z: 0 }; w[24] = { x: 0.1, y: 0, z: 0 }; // kalçalar
  const sh = (x) => ({ x: x + 0.5 * Math.sin(r(lean)), y: -0.5 * Math.cos(r(lean)), z: 0 });
  w[11] = sh(-0.18); w[12] = sh(0.18);
  w[13] = { x: w[11].x - 0.25, y: w[11].y + 0.1, z: 0 }; w[14] = { x: w[12].x + 0.25, y: w[12].y + 0.1, z: 0 };
  const leg = (h, k, a, flex) => { w[k] = { x: w[h].x, y: 0.45, z: 0 }; w[a] = { x: w[h].x, y: 0.45 + 0.45 * Math.cos(r(flex)), z: 0.45 * Math.sin(r(flex)) }; };
  leg(23, 25, 27, supportFlex);
  leg(24, 26, 28, kickFlex);
  return w;
}
// Kamerayı çevirmek = iskeleti dikey eksen etrafında döndürmek (yandan ↔ arkadan)
const rotY = (w, d) => { const c = Math.cos((d * Math.PI) / 180), s = Math.sin((d * Math.PI) / 180); return w.map((q) => ({ x: c * q.x + s * q.z, y: q.y, z: -s * q.x + c * q.z })); };

test('angle3: dik açı ve düz çizgi', () => {
  assert.ok(Math.abs(angle3({ x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 }) - 90) < 1e-6);
  assert.ok(Math.abs(angle3({ x: -1, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }) - 180) < 1e-6);
});

test('posture3d: diz açıları doğru ve kamera yönünden BAĞIMSIZ (yandan = arkadan)', () => {
  const w = body({ supportFlex: 30, kickFlex: 50 });
  const side = posture3d(w, 'right');
  const behind = posture3d(rotY(w, 90), 'right');
  assert.ok(Math.abs(side.supportKnee - 30) < 0.5 && Math.abs(side.kickKnee - 50) < 0.5);
  for (const k of ['supportKnee', 'kickKnee', 'kickHip', 'trunkLean', 'trunkSide', 'armOpen']) {
    assert.ok(Math.abs(side[k] - behind[k]) < 0.5, `${k}: yandan ${side[k]} arkadan ${behind[k]}`);
  }
});

test('posture3d: sol ayaklı oyuncuda destek tarafı doğru eşlenir', () => {
  const w = body({ supportFlex: 30, kickFlex: 50 }); // sol diz 30, sağ diz 50
  const p = posture3d(w, 'left'); // sol ayakla vuruyorsa destek sağ
  assert.ok(Math.abs(p.supportKnee - 50) < 0.5 && Math.abs(p.kickKnee - 30) < 0.5);
});

test('contactPosture: world yoksa null, varsa temas civarı medyan', () => {
  assert.equal(contactPosture([[], [], []], 1, 'right'), null);
  const mk = (f) => Object.assign([], { world: body({ supportFlex: f }) });
  const p = contactPosture([mk(20), mk(30), mk(90)], 1, 'right');
  assert.ok(Math.abs(p.supportKnee - 30) < 0.5, 'tek karedeki uç değer (90) medyanı bozmaz');
});

test('compareToReference: referansla aynı postür 100, farklı postür düşük puan ve en büyük fark önce', () => {
  const ref = posture3d(body({ supportFlex: 30, lean: 5 }), 'right');
  assert.equal(compareToReference(ref, ref, 'Messi').total, 100);
  const me = posture3d(body({ supportFlex: 5, lean: 5 }), 'right');
  const c = compareToReference(me, ref, 'Messi');
  assert.ok(c.total < 100);
  assert.equal(c.items[0].key, 'supportKnee');
  assert.match(c.items[0].cumle, /Messi'ye göre destek dizin daha düz/);
});

// Aynalama: sağ ayaklının vuruşu = sol ayaklının (Messi) ayna görüntüsü. İskeleti x'te aynala ve
// sol/sağ noktaları yer değiştir: sağ ayakla ölçülen postür, aynadaki sol ayakla ölçülenle aynı olmalı.
const SWAP = [[11, 12], [13, 14], [23, 24], [25, 26], [27, 28]];
const mirror = (w) => {
  const m = w.map((q) => ({ x: -q.x, y: q.y, z: q.z }));
  for (const [a, b] of SWAP) [m[a], m[b]] = [m[b], m[a]];
  return m;
};

test('aynalama: sağ ayaklı postür, aynadaki sol ayaklıyla birebir aynı ölçülür', () => {
  const w = body({ supportFlex: 25, kickFlex: 55, lean: 8 });
  const right = posture3d(w, 'right');
  const left = posture3d(mirror(w), 'left');
  for (const k of ['supportKnee', 'kickKnee', 'kickHip', 'trunkLean', 'trunkSide', 'armOpen']) {
    assert.ok(Math.abs(right[k] - left[k]) < 1e-6, `${k}: sağ ${right[k]} ayna-sol ${left[k]}`);
  }
});

test('referenceFor: sol ayaklı referans sağ ayağa aynalanır, hedef doksan tarafı doğru', () => {
  const ref = { foot: 'left', posture: { supportKnee: 30 } };
  assert.deepEqual(referenceFor(ref, 'left'), { posture: ref.posture, mirrored: false, target: 'sağ' });
  assert.deepEqual(referenceFor(ref, 'right'), { posture: ref.posture, mirrored: true, target: 'sol' });
  assert.equal(referenceFor(null, 'left'), null);
});

test('compareToReference: her farkta ne yapılacağı (tip) söylenir, fark yoksa tip yok', () => {
  const ref = posture3d(body({ supportFlex: 30 }), 'right');
  const me = posture3d(body({ supportFlex: 5 }), 'right');
  const c = compareToReference(me, ref, 'Messi');
  assert.match(c.items[0].tip, /Destek dizini biraz daha bük/);
  assert.ok(compareToReference(ref, ref).items.every((i) => i.tip === null));
});

test('contactPosture: tekrar eden kare (25 fps → 30 fps örnekleme) medyana iki kez girmez', () => {
  const mk = (f) => Object.assign([], { world: body({ supportFlex: f }) });
  const a = mk(90);
  const dup = Object.assign([], { world: a.world.map((q) => ({ ...q })) });
  // [10, 90, 90(tekrar), 20, 30]: tekrar sayılsa medyan 30 olurdu, atılınca [10,90,20,30] → 25
  const p = contactPosture([mk(10), a, dup, mk(20), mk(30)], 2, 'right');
  assert.ok(Math.abs(p.supportKnee - 25) < 0.5, `medyan ${p.supportKnee}`);
});

test('compareToReference: gürültü bandı içindeki fark ceza almaz, dışındaki alır', () => {
  const ref = posture3d(body({ supportFlex: 30 }), 'right');
  const near = posture3d(body({ supportFlex: 38 }), 'right'); // 8° < 10° bant
  assert.equal(compareToReference(near, ref).total, 100);
  const far = posture3d(body({ supportFlex: 0 }), 'right'); // 30° → bandın 20° dışında → 0
  assert.equal(compareToReference(far, ref).items.find((i) => i.key === 'supportKnee').score, 0);
});

test('Messi referans dosyası: iki vuruşun her biri ortalamaya göre 100 alır', async () => {
  const fs = await import('node:fs');
  const ref = JSON.parse(fs.readFileSync(new URL('../referans/messi-plase.json', import.meta.url), 'utf8'));
  assert.equal(ref.foot, 'left');
  for (const v of ref.vuruslar) assert.equal(compareToReference(v.posture, ref.posture, 'Messi').total, 100, v.id);
});
