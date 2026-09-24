// Tarama/analiz katmanı (cp-10-regresyon): eskiden app.js'in içindeydi, DOM'a dokunmuyordu ama
// app.js'ten ayrı yaşamıyordu. Artık burada yaşıyor ki hem uygulama (app.js) hem tarayıcı
// regresyon sayfası (tests/regresyon.js) AYNI kodu çalıştırsın — "Messi hâlâ 100 mü" kontrolü
// elle tıklamaya değil, tek bir koda dayansın.
// Bu modül saf DEĞİL: vision.js'e (MediaPipe, CDN) bağlı. Ama DOM'a doğrudan dokunmaz, sadece
// kendisine verilen `video` elemanını (ve vision.js'i) kullanır — bir <video id="..."> arar gibi
// document'a gitmez. Saf kısımlar (collectKicks, analyzeKick, eşleştirme/tolerans) analysis.js'te:
// vision.js Node'da import edilemediği için (CDN URL'i), o dosya Node testlerinde kullanılabiliyor.
import { processRange, setMoveNetEnabled, getVisionStats } from './vision.js?v=29';
import { candidateWindows } from './scan.js?v=29';
import { collectKicks, analyzeKick } from './analysis.js?v=29';

export { collectKicks, analyzeKick };
// cp-12-movenet: vision.js'in MoveNet açma/kapama ve istatistik uçları, app.js ve regresyon
// sayfası vision.js'e doğrudan import atmasın diye buradan geçiyor (mevcut mimariyle tutarlı).
export { setMoveNetEnabled, getVisionStats };

// pas 2: her aday pencere bu hızda işlenir (findKicks bunun üstünde ayarlandı)
export const DENSE_FPS = 30;
// pas 1: videonun tamamı bu ucuz hızda taranır
export const COARSE_FPS = 5;
// saniye: bunun altındaki videolar tek geçişte (dense) taranır, kaba pas atlanır
export const SHORT_VIDEO_MAX = 8;

// Tarayıcı bazen 'seeked' olayını atlar (aynı zamana sarma gibi), o yüzden 1 saniyelik yedek
// süre var: işlem asla sonsuza kadar beklemez.
function seek(video, t) {
  return new Promise((res) => {
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return res();
    const done = () => { clearTimeout(timer); res(); };
    const timer = setTimeout(() => { video.removeEventListener('seeked', done); res(); }, 1000);
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = t;
  });
}

/**
 * Bazı videolar (telefon kayıtları, webm) süresini baştan söylemez (Infinity).
 * Videoyu çok ileri sarınca tarayıcı gerçek süreyi öğrenir.
 */
export async function realDuration(video) {
  if (Number.isFinite(video.duration)) return video.duration;
  await seek(video, 1e7);
  const d = video.duration;
  await seek(video, 0);
  return Number.isFinite(d) ? d : video.currentTime;
}

/**
 * Videonun [t0,t1) aralığını fps hızında işler (processRange sarmalayıcısı).
 * onFrame(frame, i, total): her kare sonrası çağrılır (ilerleme ve canlı çizim için).
 * shouldStop(): true dönerse işlem durur (kullanıcı iptal etti).
 * Dönen: kare listesi.
 */
export function runPass(video, t0, t1, fps, { onFrame, shouldStop } = {}) {
  return processRange(video, { t0, t1, fps, onFrame, shouldStop });
}

/**
 * Sadece verilen [t0,t1) aralığını yoğun (DENSE_FPS) işler ve o pencerenin vuruş listesini
 * döner. Regresyon sayfasının hızlı yolu: beklenen temas zamanının etrafını taramak, videonun
 * tamamını taramaktan çok daha hızlı (bkz. tests/regresyon.js ?mod=pencere).
 * opts: { onFrame, shouldStop } — runPass'e olduğu gibi geçer.
 * Dönen: collectKicks çıktısı (bulunamazsa boş dizi).
 */
export async function scanWindow(video, t0, t1, opts = {}) {
  const dense = await runPass(video, t0, t1, DENSE_FPS, opts);
  return collectKicks(dense, DENSE_FPS);
}

/**
 * Ana tarama akışı. Kısa videolarda tek yoğun geçiş; uzun videolarda önce kaba geçiş, sonra
 * sadece aday pencereler yoğun işlenir (5 dk'lık videoyu baştan sona 30 fps işlemek imkansız).
 * onProgress(label, i, total): hangi geçişte olduğumuzu (etiket) ve o geçişin ilerlemesini bildirir;
 *   çağıran taraf (app.js) burada durum metnini ve ilerleme çubuğunu günceller.
 * onFrame(frame): o anki kareyi çizmek için (canlı iskelet/top gösterimi).
 * shouldStop(): true dönerse tarama durur.
 * Dönen: { kicks, fallbackFrames, stopped? }
 *   kicks: bulunan vuruşlar (collectKicks biçiminde).
 *   fallbackFrames: kısa video taranıp hiç vuruş bulunamazsa, zaten işlenmiş kareler (elle
 *     düzelt akışı bunları tekrar işlemesin diye); diğer durumlarda null.
 *   stopped: true ise kullanıcı taramanın erken (kaba ya da tek geçiş) aşamasında durdurdu,
 *     hiçbir sonuç yok. Not: uzun videoda aday pencereler işlenirken durdurulursa bu alan
 *     YOKTUR — o ana kadar bulunan vuruşlar geçerli sayılır (app.js'teki eski davranışla aynı).
 */
export async function scanVideo(video, { onProgress, onFrame, shouldStop } = {}) {
  const dur = await realDuration(video);
  const stopped = () => !!shouldStop?.();
  const wrap = (label) => ({
    onFrame: (frame, i, total) => { onProgress?.(label, i, total); onFrame?.(frame); },
    shouldStop,
  });

  if (dur <= SHORT_VIDEO_MAX) {
    const dense = await runPass(video, 0, dur, DENSE_FPS, wrap('Taranıyor'));
    if (stopped()) return { kicks: [], fallbackFrames: null, stopped: true };
    const kicks = collectKicks(dense, DENSE_FPS);
    return { kicks, fallbackFrames: kicks.length ? null : dense };
  }

  const coarse = await runPass(video, 0, dur, COARSE_FPS, wrap('Kaba tarama'));
  if (stopped()) return { kicks: [], fallbackFrames: null, stopped: true };
  const windows = candidateWindows(coarse);
  if (!windows.length) return { kicks: [], fallbackFrames: null };

  const kicks = [];
  for (let n = 0; n < windows.length; n++) {
    const w = windows[n];
    const t0 = Math.max(0, w.t0), t1 = Math.min(dur, w.t1);
    const dense = await runPass(video, t0, t1, DENSE_FPS, wrap(`Aday ${n + 1}/${windows.length}`));
    if (stopped()) break; // yumuşak durdurma: önceki pencerelerden bulunan vuruşlar korunur
    kicks.push(...collectKicks(dense, DENSE_FPS));
  }
  return { kicks, fallbackFrames: null };
}
