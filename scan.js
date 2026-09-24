// cp-07-otomatik: uzun videolar (68 sn, 5 dk) baştan sona 30 fps işlenemez (kare başına ~0.4-1 sn).
// İki geçişli tarama: önce ucuz bir kaba geçiş (5 fps) videonun tamamını gezer, "burada bir şey
// olmuş olabilir" diye birkaç aday an işaretler; sadece o anların etrafı sonra 30 fps'te yoğun
// işlenir (bkz. app.js). Bu dosya sadece aday pencereleri hesaplayan saf mantığı içerir.
// Saf fonksiyon: DOM'a ve MediaPipe'a bağlı değil, Node ile test edilir.
import { trackBalls } from './detect.js?v=29';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Bir kişinin herhangi bir ayağının (bilek ya da uç, hangisi yakınsa) bir noktaya uzaklığı
const footDist = (p, pt) => Math.min(...[27, 28, 31, 32].map((i) => dist(p[i], pt)));

/**
 * Kaba geçiş karelerinden aday pencereleri bulur.
 * coarseFrames: processRange'in düşük fps (ör. 5) çıktısı [{ t, people, balls }, ...]
 * opts:
 *   nearDiam:   ayağın topa yakın sayılacağı mesafe, top çapı cinsinden (varsayılan 3)
 *   moveDiam:   "top ayrıldı" sayılacak yer değiştirme, top çapı cinsinden (varsayılan 2)
 *   lookahead:  yakınlıktan sonra kaç kaba kare içinde bu hareketin arandığı (varsayılan 2)
 *   before/after: olay anına göre pencerenin sınırları, saniye (varsayılan -1.2 / +0.8)
 * Dönen: zaman aralıkları [{ t0, t1 }, ...], çakışanlar birleştirilmiş, saniye cinsinden,
 * video sınırlarına göre kırpılmamış (bunu çağıran taraf yapar).
 */
export function candidateWindows(coarseFrames, opts = {}) {
  const { nearDiam = 3, moveDiam = 2, lookahead = 2, before = 1.2, after = 0.8 } = opts;
  // Kadrajda birden çok top olabilir (Messi videosu): tek bir iz yanlış topa kilitlenip
  // vuruşu kaçırıyordu. Her top izi ayrı taranır.
  const raw = [];
  for (const ball of trackBalls(coarseFrames)) {
    for (let i = 0; i < coarseFrames.length; i++) {
      const b = ball[i];
      if (!b) continue;
      // Bir ayak topa yakın mı? (top çapının nearDiam katı içinde)
      const near = (coarseFrames[i].people || []).some((p) => footDist(p, b) <= nearDiam * b.w);
      if (!near) continue;
      // Sonraki birkaç kaba karede top belirgin hareket etti mi ya da kayboldu mu?
      let moved = false;
      for (let k = i + 1; k <= i + lookahead && k < ball.length; k++) {
        const bk = ball[k];
        if (!bk) { moved = true; break; }
        if (dist(bk, b) > moveDiam * b.w) { moved = true; break; }
      }
      if (!moved) continue;
      const t = coarseFrames[i].t;
      raw.push({ t0: t - before, t1: t + after });
    }
  }
  return mergeWindows(raw);
}

// Çakışan ya da bitişik pencereleri tek pencerede birleştirir, böylece aynı vuruş iki kez
// yoğun işlenmez ve pencereler arasında kesik kesik değil bütün bir aralık taranır.
function mergeWindows(windows) {
  if (!windows.length) return [];
  const sorted = [...windows].sort((a, b) => a.t0 - b.t0);
  const out = [{ ...sorted[0] }];
  for (const w of sorted.slice(1)) {
    const last = out[out.length - 1];
    if (w.t0 <= last.t1) last.t1 = Math.max(last.t1, w.t1);
    else out.push({ ...w });
  }
  return out;
}
