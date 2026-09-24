// cp-07-otomatik: uzun videolar (68 sn, 5 dk) baştan sona 30 fps işlenemez (kare başına ~0.4-1 sn).
// İki geçişli tarama: önce ucuz bir kaba geçiş (5 fps) videonun tamamını gezer, "burada bir şey
// olmuş olabilir" diye birkaç aday an işaretler; sadece o anların etrafı sonra 30 fps'te yoğun
// işlenir (bkz. app.js). Bu dosya sadece aday pencereleri hesaplayan saf mantığı içerir.
// Saf fonksiyon: DOM'a ve MediaPipe'a bağlı değil, Node ile test edilir.
import { trackBalls } from './detect.js?v=39';

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
// --- Sahne kesmesi ve bitiş ekranı (2026-09-24 gece, referans analizi PARAMETRELER.md) ---
// Mert'in referans videoları TikTok/WhatsApp'tan geliyor: çoğunun sonunda siyah bir TikTok bitiş
// ekranı var (videonun %15-40'ı), bazıları birden çok çekimin art arda eklenmesi (sahne kesmesi).
// Bitiş ekranında aranacak vuruş yok; kesmenin iki yanı ise farklı çekimler, oyuncu takibi
// kesmeden geçmemeli (yoksa iskelet başka sahnedeki birine atlar). Ölçüm vision.js'in her kareye
// koyduğu 64x36 gri kopya (frame.gray) üzerinden, model yok, ucuz. Eşikler [T].
export const SCENE_T = {
  // Ölçüm (9 referans videosu, 5 fps, 64x36 gri): normal hareket medyanı 2-17; gerçek kesmeler
  // 39-62 (8 numarada 40-42, 6 numarada 50-62); bitiş ekranına geçiş 80-134. 45 eşiği 8'deki
  // kesmeleri kaçırıyordu, 35'e çekildi. Elde çekimde hızlı bir kaydırma nadiren kesme sanılabilir;
  // bunun zararı küçük (pencere o noktada kırpılır), kaçırılan kesmenin zararı büyük (yanlış kişi).
  cutMeanDiff: 35, // ardışık iki kaba kare arası ortalama piksel farkı (0-255); üstü = kesme
  // Bitiş ekranı: 9 videonun 7'sinde doğru saniyede yakalandı, diğer ikisinde (bitiş ekranı yok) 0 yanlış.
  endCardMean: 45, // ortalama parlaklık bunun altı ve...
  endCardStd: 40,  // ...dağılım bunun altıysa (koyu, tekdüze ekran) = bitiş ekranı
};

const grayStats = (g) => {
  let s = 0, s2 = 0;
  for (const v of g.data) { s += v; s2 += v * v; }
  const n = g.data.length || 1, mean = s / n;
  return { mean, std: Math.sqrt(Math.max(0, s2 / n - mean * mean)) };
};

/** Koyu ve tekdüze kare mi (TikTok bitiş ekranı gibi)? Gri kopya yoksa false. */
export function isEndCard(frame) {
  if (!frame?.gray?.data?.length) return false;
  const { mean, std } = grayStats(frame.gray);
  return mean < SCENE_T.endCardMean && std < SCENE_T.endCardStd;
}

/**
 * Kaba karelerden kullanılabilir sahneleri çıkarır: kesmelerden bölünmüş, bitiş ekranı atılmış
 * zaman aralıkları [{ t0, t1 }]. Gri kopyası olmayan kareler (eski testler) tek sahne sayılır.
 */
export function sceneSegments(frames) {
  const segs = [];
  let cur = null, prev = null;
  // cutStart/cutEnd: sahnenin o ucu gerçek bir kesme ya da bitiş ekranı mı (pencere kırpılır),
  // yoksa videonun kendi başı/sonu mu (eski davranış: kırpılmaz, çağıran taraf video süresine kırpar).
  let afterEndCard = false;
  for (const f of frames) {
    if (isEndCard(f)) {
      if (cur) { cur.cutEnd = true; segs.push(cur); cur = null; }
      prev = null; afterEndCard = true; continue;
    }
    let cut = false;
    if (prev?.gray?.data && f.gray?.data && prev.gray.data.length === f.gray.data.length) {
      let d = 0;
      for (let i = 0; i < f.gray.data.length; i++) d += Math.abs(f.gray.data[i] - prev.gray.data[i]);
      cut = d / f.gray.data.length > SCENE_T.cutMeanDiff;
    }
    if (!cur || cut) {
      if (cur) { cur.cutEnd = true; segs.push(cur); }
      // Kesme iki kaba karenin arasında bir yerde: yeni sahneyi ikisinin ortasından başlat.
      cur = { t0: cut && prev ? (prev.t + f.t) / 2 : f.t, t1: f.t, cutStart: cut || afterEndCard, cutEnd: false };
      if (cut && segs.length) segs[segs.length - 1].t1 = cur.t0;
      afterEndCard = false;
    } else cur.t1 = f.t;
    prev = f;
  }
  if (cur) segs.push(cur);
  return segs;
}

export function candidateWindows(coarseFrames, opts = {}) {
  const { nearDiam = 3, moveDiam = 2, lookahead = 2, before = 1.2, after = 0.8 } = opts;
  const segs = sceneSegments(coarseFrames);
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
      // Pencere, olayın ait olduğu sahnenin dışına taşmaz (kesmeden geçen takip = yanlış kişi);
      // olay hiçbir sahneye düşmüyorsa (bitiş ekranı) atılır.
      const seg = segs.find((s) => t >= s.t0 - 1e-6 && t <= s.t1 + 1e-6);
      if (!seg) continue;
      raw.push({
        t0: seg.cutStart ? Math.max(seg.t0, t - before) : t - before,
        t1: seg.cutEnd ? Math.min(seg.t1, t + after) : t + after,
        seg,
      });
    }
  }
  return mergeWindows(raw).map(({ t0, t1 }) => ({ t0, t1 }));
}

// Çakışan ya da bitişik pencereleri tek pencerede birleştirir, böylece aynı vuruş iki kez
// yoğun işlenmez ve pencereler arasında kesik kesik değil bütün bir aralık taranır.
function mergeWindows(windows) {
  if (!windows.length) return [];
  const sorted = [...windows].sort((a, b) => a.t0 - b.t0);
  const out = [{ ...sorted[0] }];
  for (const w of sorted.slice(1)) {
    const last = out[out.length - 1];
    // Farklı sahnelerin pencereleri birleşmez (aralarında kesme var).
    if (w.t0 <= last.t1 && w.seg === last.seg) last.t1 = Math.max(last.t1, w.t1);
    else out.push({ ...w });
  }
  return out;
}
