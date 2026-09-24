// 3D temas postürü ölçüm aracı (2026-09-25): bir videoyu uygulamanın kendi hattıyla (pipeline.js)
// tarar, bulunan her vuruş için temas anındaki 3D postürü (metrics3d.js#contactPosture) çıkarır.
// Kullanım: tests/postur.html?video=<test-videolar altındaki dosya>&foot=left|right&auto=1
// Amaç: Messi'nin referans postürünü (referans/messi-plase.json) ÖLÇEREK üretmek, sonra başka
// videoları bu referansa göre puanlamak. Sonuç window.__postur'da (makine okunur).
import * as pipeline from '../pipeline.js?v=46';
import { contactPosture, posture3d, compareToReference, POSTURE_KEYS } from '../metrics3d.js?v=46';

const params = new URLSearchParams(location.search);
const FILE = params.get('video');
const FOOT = params.get('foot') === 'right' ? 'right' : 'left';
const video = document.getElementById('video');
const out = document.getElementById('out');
window.__postur = { done: false, kicks: [], error: null };

const say = (t) => { out.textContent = t; };
const r1 = (v) => (Number.isFinite(v) ? Math.round(v * 10) / 10 : null);

async function run() {
  const blob = await fetch('../test-videolar/' + encodeURIComponent(FILE)).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  });
  await new Promise((res, rej) => {
    video.addEventListener('loadeddata', res, { once: true });
    video.addEventListener('error', () => rej(new Error('video açılamadı')), { once: true });
    video.src = URL.createObjectURL(blob);
  });
  const ref = await fetch('../referans/messi-plase.json').then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const res = await pipeline.scanVideo(video, {
    onProgress: (label, i, total) => say(`${label} %${Math.round(((i + 1) / total) * 100)}`),
  });
  const kicks = res.kicks.map((k) => {
    const a = pipeline.analyzeKick(k, { mode: 'placement', foot: FOOT, angle: 'side' });
    const post = contactPosture(a.track, k.contact, FOOT);
    // Temas civarı kare kare (−3..+3): tahminin kareden kareye ne kadar oynadığını görmek için.
    const perFrame = [];
    for (let d = -3; d <= 3; d++) {
      const p = posture3d(a.track[k.contact + d]?.world, FOOT);
      perFrame.push({ d, ...(p ? Object.fromEntries(POSTURE_KEYS.map((key) => [key, r1(p[key])])) : {}) });
    }
    const cmp = ref ? compareToReference(post, ref.posture, 'Messi') : null;
    return {
      t: r1(k.t), foot: k.foot, fps: k.fps, hasWorld: !!a.track[k.contact]?.world,
      posture: post && Object.fromEntries(POSTURE_KEYS.map((key) => [key, r1(post[key])])),
      perFrame, score: cmp?.total ?? null, cumleler: cmp?.items.map((i) => `${i.cumle} [${i.score}]`) ?? [],
    };
  });
  window.__postur = { done: true, file: FILE, foot: FOOT, kicks, error: null };
  say(JSON.stringify(window.__postur, null, 1));
}

run().catch((err) => { window.__postur = { done: true, kicks: [], error: err.message }; say('Hata: ' + err.message); });
