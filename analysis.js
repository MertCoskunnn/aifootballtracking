// Saf analiz mantığı (cp-10-regresyon): pipeline.js'in DOM'a ve vision.js'e (MediaPipe, CDN)
// bağlı olmayan kısmı buradadır. Amaç: bu dosya Node ile (tarayıcısız, `node --test`) test
// edilebilsin. vision.js CDN'den import yaptığı için Node bunu import edemez; bu yüzden
// collectKicks/analyzeKick gibi "sadece veriyle çalışan" fonksiyonlar pipeline.js'ten
// ayrıldı. pipeline.js bunları buradan alıp app.js'e (ve regresyon sayfasına) yeniden sunar.
import { findKicks, classifyView, suggestMode } from './detect.js?v=27';
import { detectMovingBall } from './context.js?v=27';
import { buildTrack, measure, measureFreeKick } from './metrics.js?v=27';
import { evaluate } from './coach.js?v=27';
import { assessKickQuality } from './quality.js?v=27';

/**
 * Yoğun (dense) karelerden vuruş listesi çıkarır: findKicks + her vuruş için kamera açısı
 * (classifyView), mod önerisi (suggestMode) ve top bağlamı (detectMovingBall — cp-13-vurus-turleri,
 * duran mı hareketli top mu). Her vuruş kendi 'frames' penceresini taşır ki listeden tıklanınca
 * (ya da regresyon sayfasında) o pencere tekrar oynatılabilsin/ölçülebilsin.
 * denseFrames: processRange çıktısı [{ t, people, balls, gray }, ...] (bir pencerenin tüm kareleri;
 * gray varsa — vision.js, cp-15-kalite-kapisi — kalite kapıları da değerlendirilir, yoksa
 * quality.ok:true/deger:null "ölçülemedi" ile geçer, tarama çökmez).
 * fps: bu karelerin işlendiği hız (genelde DENSE_FPS=30)
 * Dönen: [{ contact, foot, person, rest, onset, flight, frames, fps, t, view, suggestion, context,
 *   quality: { kamera:{ok,kayma}, netlik:{ok,deger} }, score }]
 */
export function collectKicks(denseFrames, fps) {
  const kicks = findKicks(denseFrames, fps);
  return kicks.map((k) => {
    const view = classifyView(denseFrames, k, fps);
    const suggestion = suggestMode(view.view);
    const context = detectMovingBall(denseFrames, k, fps);
    // cp-15-kalite-kapisi: sabit kamera + net görüntü ürün kararı (PRODUCT-PLAN.md). Burada sadece
    // ölçüm dolduruluyor; kapının kendisini (uyarı/engelleme) UI'a bağlamak proje yöneticisinde.
    const quality = assessKickQuality(denseFrames, k, fps);
    return { ...k, frames: denseFrames, fps, t: denseFrames[k.contact].t, view, suggestion, context, quality, score: null };
  });
}

/**
 * Bir vuruşu ölçer ve puanlar: buildTrack (temas karesi + rest topu) + measure/measureFreeKick + evaluate.
 * mode/foot hiç verilmezse vuruşun kendi önerisini kullanır: mod için kick.suggestion.mode
 * (yoksa 'shot'), ayak için kick.foot. (Denetim notu: 'auto' özel dizge yolu kaldırıldı — app.js
 * (cp-15-secmeli-menu) artık kullanıcıya her zaman AÇIK mode/foot seçimi zorunlu kılıyor, hiçbir
 * çağıran taraf 'auto' geçirmiyordu; gerçek kullanılan tek yol, opts hiç verilmediğindeki bu
 * öneri-tabanlı varsayılandı, o kaldı.)
 * kick: collectKicks'in ürettiği nesnelerden biri (frames, contact, rest, fps taşımalı).
 * Dönen: { mode, foot, track, measurements, result }
 */
export function analyzeKick(kick, { mode, foot } = {}) {
  const effMode = mode || kick.suggestion?.mode || 'shot';
  const effFoot = foot || kick.foot || 'right';
  const ball = { x: kick.rest.x, y: kick.rest.y };
  const track = buildTrack(kick.frames.map((f) => f.people), kick.contact, ball);
  const measurements = effMode === 'freekick'
    ? measureFreeKick(track, kick.contact, ball, effFoot, kick.fps || 30)
    : measure(track, kick.contact, ball, effFoot, kick.fps);
  // kick.context: detectMovingBall'dan (collectKicks). Hareketli topsa (RESEARCH-VURUS-TURLERI.md
  // §2, H1/H3) shot/placement'ta ilgili kurallar genişler; pass/freekick/duran topta değişmez.
  const result = evaluate(measurements, effMode, kick.context);
  return { mode: effMode, foot: effFoot, track, measurements, result };
}

/**
 * Mert K1/K2 gibi "hangi dosya hangi klip" bilinmediğinde, gerçek video sürelerine bakarak
 * en yakın beklenen süreye eşleştirir (tests/regresyon.js, cp-10-regresyon).
 * durations: [{ file, duration }] — adaydan ölçülen gerçek süreler.
 * targetSeconds: beklenen.json'daki durationApprox.
 * excludeFiles: başka bir beklentiye zaten atanmış dosya adları (aynı dosya iki kez seçilmesin).
 * Dönen: en yakın süreye sahip dosya adı, uygun aday kalmadıysa null.
 */
export function matchByDuration(durations, targetSeconds, excludeFiles = []) {
  let best = null, bestDiff = Infinity;
  for (const d of durations) {
    if (excludeFiles.includes(d.file)) continue;
    const diff = Math.abs(d.duration - targetSeconds);
    if (diff < bestDiff) { bestDiff = diff; best = d.file; }
  }
  return best;
}

/**
 * Regresyon toleransı: zaman ±tolSec sapabilir, puan tam eşit olmalı (beklenen.json, GECE-PLANI.md).
 * actual: { tSec, score }, expected: { tSec, score }
 * Dönen: { pass, timeDiff, scoreDiff } — fark varsa (pass=false) sayılar raporda gösterilsin diye.
 */
export function withinTolerance(actual, expected, tolSec = 0.15) {
  const timeDiff = Math.abs(actual.tSec - expected.tSec);
  const scoreDiff = actual.score - expected.score;
  const pass = timeDiff <= tolSec && scoreDiff === 0;
  return { pass, timeDiff, scoreDiff };
}
