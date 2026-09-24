// context.js — Bağlam sinyalleri: bir vuruşun DURAN mı yoksa HAREKETLİ TOPA mı yapıldığını saf
// veriden çıkarır. Bu bir mod değil (kullanıcı seçmez), mevcut modların (shot, placement)
// kurallarını RESEARCH-VURUS-TURLERI.md §2/§4'e göre değiştiren bir BAĞLAM: coach.evaluate()
// üçüncü parametre olarak alır (cp-13-vurus-turleri, GECE-PLANI.md).
//
// Saf fonksiyon: DOM'a, MediaPipe'a bağımlı değil, Node ile test edilir (detect.js gibi).
import { trackBalls, fillGaps } from './detect.js?v=30';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// detect.js'in başındaki gerçek video notuyla aynı gerekçe: duran topta kareler arası kayma
// < 0.05 çap (~1.5 çap/sn @30fps, MediaPipe titreşimi dahil), Mert'in sürdüğü topta kare başına
// ~0.3 çap (~9 çap/sn @30fps). Eşik ikisinin belirgin arasında, net bir ayraç için seçildi [T]
// (RESEARCH-VURUS-TURLERI.md §4: "Otomatik ayrım sinyalleri" — duran top vs hareketli top).
// 3'ten 5'e çekildi (2026-09-24, Frodo): Mert K2'de top 3.2 çap/sn (~0.7 m/s) ölçüldü, yani
// yavaşça kayan bir top. H kurallarının dayandığı çalışmalardaki hareketli top ~2.2 m/s
// (~10 çap/sn). Bu kadar yavaş kaymada o teknik ayarlamaları (daha geride destek ayağı, kısa
// kurma) beklemek için dayanak yok. 5, gürültü (~1.5) ile araştırma koşulu (~10) arasında [T].
export const MOVING_BALL_DIAM_PER_SEC = 5;

/**
 * Temas karesinden önceki 0.3 sn'de (temas karesinin KENDİSİ HARİÇ — o karede top zaten
 * vurulmuş/deforme tespit edilmiş olabilir, güvenilmez) topun ortalama hızını top çapı/sn
 * cinsinden ölçer. Bu hız MOVING_BALL_DIAM_PER_SEC'in üstündeyse top hareketli kabul edilir
 * (oyuncunun kendi sürdüğü ya da bir pastan gelen top), değilse duran top.
 *
 * frames: findKicks'e giden aynı yoğun kare listesi [{ t, people, balls }, ...].
 * kick: findKicks çıktısındaki bir vuruş ({ contact, rest: {x,y,w}, ... }).
 * fps: kare/saniye.
 * Dönen: { movingBall, ballSpeed } — ballSpeed top çapı/sn (ölçülemezse 0, movingBall false).
 */
export function detectMovingBall(frames, kick, fps) {
  // Vuruşu bulan top izini seç: temas karesinde kick.rest'e en yakın konumu taşıyan iz
  // (findKicks birden fazla top izini paralel arar, hangisinin bu vuruşu ürettiğini burada
  // tekrar bulmamız gerekiyor çünkü kick nesnesi sadece temas anındaki tek noktayı taşıyor).
  // İz seçimi temas karesine değil, temastan ÖNCEKİ pencereye bakar: temas karesinde ayak topu
  // örttüğü için top çoğu zaman o karede tespit edilmiyor. İlk sürüm izi sadece temas karesinde
  // aradı, Mert'in iki gerçek şutunda hiçbir iz bulamadı ve "top duruyor" (hız 0) dedi (2026-09-24).
  const windowFrames = Math.round(0.3 * fps);
  const from = Math.max(1, kick.contact - windowFrames);
  const maxGap = Math.round(0.2 * fps);
  let track = null, bestD = Infinity;
  for (const raw of trackBalls(frames)) {
    const t = fillGaps(raw, maxGap);
    for (let i = kick.contact; i >= from - 1; i--) {
      if (!t[i]) continue;
      const d = dist(t[i], kick.rest) / (kick.rest.w || t[i].w || 1);
      if (d < bestD) { bestD = d; track = t; }
      break; // bu izin temasa en yakın görünümü yeter
    }
  }
  // Seçilen iz topun temas yerine 3 çaptan uzaksa başka bir toptur: ölçülemedi.
  if (!track || bestD > 3) return { movingBall: false, ballSpeed: null };

  // Kısa tespit boşluklarını doldur (kicksOnTrack ile aynı pencere, detect.js), yoksa gürültülü
  // bir tespit kaybı topu yanlışlıkla "duruyor" ya da "sıçradı" gösterebilir.
  const filled = track; // izler seçilirken zaten dolduruldu (fillGaps)
  const speeds = [];
  for (let i = from; i < kick.contact; i++) {
    const a = filled[i - 1], b = filled[i];
    if (!a || !b || !b.w) continue;
    speeds.push((dist(a, b) / b.w) * fps);
  }
  // Ölçülemeyen hız null (0 değil): "top duruyor" ile "top görünmedi" ayrı şeyler.
  if (!speeds.length) return { movingBall: false, ballSpeed: null };
  const ballSpeed = speeds.reduce((s, v) => s + v, 0) / speeds.length;
  return { movingBall: ballSpeed > MOVING_BALL_DIAM_PER_SEC, ballSpeed };
}
