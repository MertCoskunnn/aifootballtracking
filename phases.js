// phases.js — Bir vuruşun evrelerini (yaklaşma, basış, kurma, temas, takip) kare indeksleriyle bulur.
// Saf fonksiyon: DOM'a, MediaPipe'a, metrics.js'e bağımlı değil (LM burada kasıtlı tekrarlandı ki
// bu dosya tek başına test edilebilsin ve döngüsel import olmasın).
//
// Neden (GECE-PLANI.md, cp-11-evreler): Bugüne kadar temas dışındaki evreler SABİT KARE SAYISIYLA
// tahmin ediliyordu (örn. "temastan 20 kare önce"). Bunun iki sorunu var:
//   1) 60 fps videoda 20 kare 0.33 sn eder, 30 fps'te ise 0.67 sn — pencere fps'e göre sessizce
//      değişiyor, kullanıcı 60 fps çektiğinde yanlış anı ölçüyorduk.
//   2) Literatüre göre (Lees ve ark. 2010) destek ayağı basışta (plant) ~26°, temasta ~42° büküyor.
//      Basış anını hiç bilmeden bu ikisini ayırt edemiyoruz; "kurman kısa" ile "basışın erken" farklı
//      geri bildirimlerdir ama ikisini de tek "backswing" sayısına sıkıştırıyorduk.
// Bu dosya basış (plant) anını GERÇEK HAREKETE bakarak (destek ayak bileği hızı) bulur, diğer
// evreleri ona göre saniye cinsinden konumlar. Böylece pencereler fps'ten bağımsız, fiziksel anlama
// karşılık gelir.

// MediaPipe Pose nokta numaraları (metrics.js ile birebir aynı, kasıtlı tekrar — yukarı bakın).
const LM = {
  shoulder: { left: 11, right: 12 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
};

const other = (side) => (side === 'right' ? 'left' : 'right');
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const legLength = (p, side) =>
  dist(p[LM.hip[side]], p[LM.knee[side]]) + dist(p[LM.knee[side]], p[LM.ankle[side]]);

// metrics.js'teki visOk ile aynı eşik/mantık: düşük görünürlüklü (v<0.5) noktaya dayanan ölçüm
// yerine "bulunamadı" (null/undefined) döneriz, MediaPipe'ın uydurduğu x,y'ye güvenmeyiz.
const VIS_MIN = 0.5;
const visOk = (p, idxs) => idxs.every((i) => (p[i]?.v ?? 1) >= VIS_MIN);

function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}
// Diz bükülmesi: düz bacak = 0°, dik açı = 90° (metrics.js kneeFlexion ile aynı tanım)
const kneeFlexion = (p, side) => 180 - angleAt(p[LM.hip[side]], p[LM.knee[side]], p[LM.ankle[side]]);
// Kalça fleksiyonu: uyluğun gövde eksenine göre öne kalkışı (metrics.js hipFlexion ile aynı tanım)
const hipFlexion = (p, side) => 180 - angleAt(p[LM.shoulder[side]], p[LM.hip[side]], p[LM.knee[side]]);

// --- Sabitler: neden bu değerler seçildi, gerekçesiyle burada. Bir eşik değişirse önce burası
// değişir (METRICS.md'nin izlediği kural, bkz. o dosyanın başlığı). ---

// Basış eşiği: destek ayak bileğinin hızı (bacak boyu/saniye). Yaklaşma/koşu sırasında bu hız
// tipik olarak birkaç bacak boyu/sn'dir (bir koşu adımı ~0.3 sn sürer, adım uzunluğu genelde
// bacak boyundan büyüktür → 3+ bacak/sn). MediaPipe'ın kare-kare titreşimi (jitter) durağan bir
// ayakta bile ~0.3-0.6 bacak/sn görünür hız üretir. 1.5, bu gürültünün belirgin üstünde ama
// yaklaşma hızının belirgin altında: ayağın gerçekten yere oturduğu anı ayırt etmek için seçildi.
export const PLANT_SPEED_THRESHOLD = 1.5; // bacak boyu / saniye
// Basış temastan hemen önce olur (aynı adımda); literatürde ikisi arası genelde çok kısa. 0.5 sn
// bu payı cömertçe kapsar, daha uzun aramak yanlışlıkla önceki adımı "basış" sayabilir.
export const PLANT_WINDOW_SEC = 0.5;
// Kurma zirvesi aranan pencere: basıştan biraz önce başlar, çünkü diz basıştan hemen önce zaten
// bükülmeye başlamış olabilir (kurma ve basış aynı anda değil, kurma basışa yakın biter).
export const BACKSWING_LOOKBACK_SEC = 0.15;
// Basış hiç bulunamazsa (veri eksik/gürültülü) eski sabit pencereyle aynı süre: 30 fps'te 20 kare.
export const BACKSWING_FALLBACK_SEC = 0.67;
// Yaklaşma başlangıcı: basıştan (yoksa temastan) 0.7 sn geriye. [L10] tipik yaklaşma adımlarının
// süresini kapsayacak kadar geniş, tüm klibi kapsayacak kadar dar (raporda "yaklaşma" hep anlamlı kalsın).
export const APPROACH_LOOKBACK_SEC = 0.7;
// Takip: temastan sonraki 0.5 sn (Ş8/metrics.js followHip ile aynı pencere, tutarlılık için).
export const FOLLOW_WINDOW_SEC = 0.5;

// Destek ayak bileğinin kare-kare hızı (bacak boyu/sn). speeds[i] = kare i-1 -> i arasındaki hız.
// Tekrarlanan kareler (örn. 25 fps video 30 fps olarak okunduğunda bazı kareler birebir tekrar
// eder, bkz. detect.js footSpeeds) hızı sıfıra düşürüp sonra iki katına çıkarmaz: tekrar eden
// karede bir önceki geçerli hız korunur, yoksa oyuncu yanlışlıkla "durdu" sanılır.
function supportSpeeds(track, sup, fps) {
  const speeds = new Array(track.length).fill(undefined);
  const ankleIdx = LM.ankle[sup];
  const hipIdx = LM.hip[sup];
  for (let i = 1; i < track.length; i++) {
    const p = track[i];
    const prev = track[i - 1];
    if (!p || !prev) continue; // iskelet yoksa hız bilinmiyor, sonraki karede tekrar denenir
    if (!visOk(p, [ankleIdx]) || !visOk(prev, [ankleIdx])) continue;
    const same = dist(p[ankleIdx], prev[ankleIdx]) < 1e-6 && dist(p[hipIdx], prev[hipIdx]) < 1e-6;
    if (same) { speeds[i] = speeds[i - 1]; continue; }
    const leg = legLength(p, sup) || legLength(prev, sup) || 1;
    speeds[i] = (dist(p[ankleIdx], prev[ankleIdx]) / leg) * fps;
  }
  return speeds;
}

/**
 * Bir vuruşun evrelerini bulur.
 * track: kare başına tek iskelet (33 nokta, {x,y,v}) ya da null (metrics.js buildTrack çıktısı).
 * contact: temas karesinin indeksi. side: vuran ayak ('left'|'right'), destek = diğer ayak.
 * fps: kare/saniye — pencereleri saniyeden kareye çevirmek için.
 * Dönen: { approachStart, plant, backswingPeak, contact, followEnd, confidence } — hepsi kare
 * indeksi (bulunamayanlar null). confidence: { plant, backswingPeak, followEnd } — o evrenin
 * gerçek harekete bakılarak mı bulunduğu (true), yoksa yetersiz/görünmez veri yüzünden null mü
 * kaldığı (false). approachStart için ayrı bir güven yok: her zaman plant/contact'tan türetilen
 * basit bir formüldür, veri eksikliğinden etkilenmez.
 */
export function findPhases(track, contact, side, fps) {
  const sup = other(side);

  // --- Basış (plant): destek ayak bileği hızının eşiğin altına düştüğü ve temasa kadar düşük
  // kaldığı İLK kare. ---
  const speeds = supportSpeeds(track, sup, fps);
  const windowStart = Math.max(0, contact - Math.round(PLANT_WINDOW_SEC * fps));
  let plant = null;
  for (let i = windowStart; i <= contact; i++) {
    if (speeds[i] === undefined || speeds[i] >= PLANT_SPEED_THRESHOLD) continue;
    let staysLow = true;
    for (let j = i + 1; j <= contact; j++) {
      if (speeds[j] !== undefined && speeds[j] >= PLANT_SPEED_THRESHOLD) { staysLow = false; break; }
    }
    if (staysLow) { plant = i; break; }
  }

  // --- Kurma zirvesi (backswingPeak): vuran dizin [plant-0.15sn, contact] (plant yoksa
  // [contact-0.67sn, contact]) aralığındaki en büyük büküşü. ---
  const backswingFrom = plant !== null
    ? Math.max(0, plant - Math.round(BACKSWING_LOOKBACK_SEC * fps))
    : Math.max(0, contact - Math.round(BACKSWING_FALLBACK_SEC * fps));
  let backswingPeak = null;
  let backswingMax = -Infinity;
  for (let i = backswingFrom; i <= contact; i++) {
    const p = track[i];
    if (!p || !visOk(p, [LM.hip[side], LM.knee[side], LM.ankle[side]])) continue;
    const flex = kneeFlexion(p, side);
    if (flex > backswingMax) { backswingMax = flex; backswingPeak = i; }
  }

  // --- Yaklaşma başlangıcı: basıştan (yoksa temastan) 0.7 sn geriye, 0'da kırpılır. ---
  const approachBase = plant !== null ? plant : contact;
  const approachStart = Math.max(0, approachBase - Math.round(APPROACH_LOOKBACK_SEC * fps));

  // --- Takip sonu (followEnd): temastan sonraki 0.5 sn'de vuran kalçanın öne fleksiyon zirvesi. ---
  const followTo = Math.min(track.length - 1, contact + Math.round(FOLLOW_WINDOW_SEC * fps));
  let followEnd = null;
  let followMax = -Infinity;
  for (let i = contact; i <= followTo; i++) {
    const p = track[i];
    if (!p || !visOk(p, [LM.shoulder[side], LM.hip[side], LM.knee[side]])) continue;
    const flex = hipFlexion(p, side);
    if (flex > followMax) { followMax = flex; followEnd = i; }
  }

  return {
    approachStart,
    plant,
    backswingPeak,
    contact,
    followEnd,
    confidence: {
      plant: plant !== null,
      backswingPeak: backswingPeak !== null,
      followEnd: followEnd !== null,
    },
  };
}
