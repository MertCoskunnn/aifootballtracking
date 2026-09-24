// display.js — Ekranda TEK oyuncu, TEK top gösterme mantığı (cp-18-tek-oyuncu-tek-top).
// Saf fonksiyonlar: DOM'a, canvasa bağlı değil, Node ile test edilir (tests/display.test.mjs).
// app.js draw()/drawLive() bunları kullanıp SONUCU çizer, seçimin kendisi burada yapılır.
//
// Neden: kalabalık bir sahnede (kaleci, yan çizgideki kişiler, yerdeki başka toplar) eskiden
// HERKESİN iskeleti çiziliyordu (seçilen oyuncu parlak, diğerleri soluk 0.35 alpha ile), HER top
// tespiti de ayrı bir nişangahla işaretleniyordu. Mert'e göre bu kafa karıştırıcı: ekranda sadece
// vuran oyuncu ve vurulan top olmalı. Oyuncu/top seçildikten (state.track kurulduktan) SONRA
// geçerli — ondan önce (elle işaretleme akışının başında, kullanıcı henüz kimin/hangi topun doğru
// olduğunu bulmaya çalışırken) app.js hâlâ "herkesi göster" moduna düşüyor, bu dosya o kısma karışmaz.
//
// cp-19-sut-izi-animasyon: temas SONRASI top artık kare-kare ham tespitten değil, trajectory.js'in
// oturttuğu sağlam eğriden (fit, RANSAC + ağırlıklı en küçük kareler) okunuyor. Ham tespitler 25-30
// fps'te zıplıyor (top bulanık ya da bir kare kayıp); fit sürekli bir eğri olduğu için nişangah
// akıcı hareket eder, tek bir kötü tespit onu oynatmaz.
// cp-20-sabit-top bug düzeltmesi: fit kurulamadığında ESKİ kare-tabanlı yedeğe (ballFlight'ın "en
// yakın tespit" yol izleme çıktısı) artık düşülMÜYOR — gerçek raporda bu yedek, temas sonrası
// nişangahı yerde duran başka bir topa atlatıyordu (fitFlight'ın tam da dışladığı/reddettiği
// sabit-top durumunu, eski yol hiç süzmeden alıyordu). Artık kural net: temas SONRASI nişangah
// YALNIZ geçerli bir fit'ten gelir; fit yoksa (RANSAC yetersiz/güvenilmez veri yüzünden kuramadıysa
// ya da sabit-top şüphesiyle reddettiyse) hiçbir top gösterilmez — "belirsiz ama yanlış" yerine "yok".
import { flightAt } from './trajectory.js?v=32';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const FEET = [27, 28, 31, 32]; // ayak bileği (sol/sağ), ayak ucu (sol/sağ)
// fit'in son güvenilir noktasından (tEnd) sonra ne kadar ileri ekstrapole edilebileceğinin TAVANI
// (saniye). trajectory.js#flightTrail'in varsayılan extendSec'iyle aynı: topun kadraj dışına kısa
// bir süre daha "uçmaya devam ediyormuş" gibi görünmesi doğal, ama sınırsız ekstrapolasyon saçmalar.
// cp-21-lag-fix: gerçek tavan bundan da küçük olabilir — bkz. fit.maxExtendSec (trajectory.js),
// veri penceresi (tEnd-contactT) kısaysa bu sabitten daha kısıtlı bir ekstrapolasyona izin verir.
const FIT_EXTEND_SEC = 0.5;

/**
 * Bir kare için gösterilecek TEK iskeleti seçer.
 * track: buildTrack() çıktısı (kare başına tek iskelet ya da null).
 * index: gösterilecek kare indeksi.
 * Dönen: o karedeki iskelet ya da null — track o karede kayıpsa (MAX_GAP aşıldıysa vb.) BAŞKA
 * birine atlanmaz, hiç iskelet gösterilmez (Mert'in isteği: "track o karede yoksa hiç çizme").
 */
export function pickTrackedPerson(track, index) {
  return track ? (track[index] || null) : null;
}

/**
 * Bir kare için gösterilecek TEK topu seçer.
 * frame: { balls: [...] } o karenin ham top tespitleri (her biri {x,y,w,s}).
 * index: gösterilecek kare indeksi. contact: temas karesinin indeksi (null ise henüz işaretlenmedi).
 * ballAnchor: temas anındaki (elle ya da otomatik işaretlenen) top konumu {x,y,w?} ya da null.
 * t: nişangahın çizileceği ZAMAN (video.currentTime oynatırken, kare t'si durdurulmuşken — cp-19,
 *   app.js#currentT). Sadece temas SONRASI fit varsa kullanılır, kare indeksinden bağımsızdır.
 * fit: trajectory.js#fitFlight çıktısı ya da null (RANSAC yetersiz/güvenilmez veri yüzünden
 *   kuramadıysa, ya da sabit-top şüphesiyle bilerek reddettiyse — bkz. trajectory.js cp-20).
 *
 * Kural (Mert'in isteği): temas KARESİNDE işaretlenen top gösterilir; temastan ÖNCEKİ karelerde
 * o karenin ham tespitlerinden ankor'a EN YAKIN olanı (top kare kare kaydığı için en iyi proxy);
 * temastan SONRA YALNIZ fit varsa eğri üzerindeki `t` anındaki nokta (flightAt) gösterilir — ham
 * tespitlerin zıplaması nişangahı OYNATMAZ. fit yoksa (cp-20) hiçbir top gösterilmez: eski kare-
 * tabanlı yedek (ballFlight'ın "en yakın tespit" izlemesi) kaldırıldı, çünkü tam da fitFlight'ın
 * güvensiz bulup reddettiği durumlarda (ör. sahada duran başka bir topa kilitlenme) süzmeden o
 * yanlış tespiti gösteriyordu. Belirsizlikte hiçbir tespite atlanmaz.
 * Dönen: {x,y,w} biçiminde tek top ya da null.
 */
export function pickDisplayBall(frame, index, contact, ballAnchor, t, fit) {
  if (contact === null || !ballAnchor) return null;
  if (index === contact) {
    const w = ballAnchor.w ?? nearestBallWidth(frame, ballAnchor);
    return { x: ballAnchor.x, y: ballAnchor.y, w };
  }
  if (index > contact) {
    if (!fit) return null; // cp-20: fit yoksa temas sonrası nişangah çizilmez, eski yedeğe düşülmez
    const safeExtendSec = Math.min(FIT_EXTEND_SEC, fit.maxExtendSec ?? FIT_EXTEND_SEC);
    const clampedT = Math.min(t, fit.tEnd + safeExtendSec);
    const { x, y } = flightAt(fit, clampedT);
    // cp-20-nisangah-boyutu bug düzeltmesi: genişlik eskiden HER ZAMAN ankor'a (temas anındaki
    // ESKİ konuma) en yakın ham tespitten ödünç alınıyordu — ama top uçtukça bu konumdan çok
    // uzaklaşır, o yüzden "ankor'a en yakın" artık alakasız bir tespiti (ör. yerde duran başka
    // top, bir oyuncu kutusu) yakalayabiliyordu ve nişangah gerçek boyutundan kat kat büyük/küçük
    // çiziliyordu. Genişlik artık topun O ANKİ (fit'in öngördüğü x,y) konumuna göre aranır; ayrıca
    // bir mesafe tavanı var (ankor genişliğinin ~3 katı) — o kadar yakında hiçbir tespit yoksa
    // (top o karede bulunamamış) rastgele uzak bir tespite atlamak yerine ankor genişliğine düşülür.
    const cap = Math.max(60, (ballAnchor.w || 16) * 3);
    const w = ballAnchor.w ?? nearestBallWidth(frame, { x, y }, cap) ?? 16;
    return { x, y, w };
  }
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return null;
  return cands.reduce((a, b) => (dist(b, ballAnchor) < dist(a, ballAnchor) ? b : a));
}

// Temas topu genelde sadece {x,y} taşır (genişlik bilgisi yok, elle işaretlemede hiç ölçülmedi).
// Nişangahı doğru boyutlandırmak için o karedeki ham tespitlerden VERİLEN NOKTAYA (point) en yakın
// olanın w'sini ödünç alırız; hiç tespit yoksa (ya da hepsi maxDist'ten uzaksa) null döner, çağıran
// taraf kendi varsayılanına düşer. app.js da fit'e eklenen temas noktasının genişliğini bulmak için
// bunu kullanıyor (cp-19). point, "şu an topun nerede olduğu"nu temsil etmeli — temas SONRASI için
// eski/sabit bir ankor konumu DEĞİL, güncel (fit'in öngördüğü) konum verilmeli (cp-20, bkz. yukarısı).
export function nearestBallWidth(frame, point, maxDist = Infinity) {
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return 16;
  const nearest = cands.reduce((a, b) => (dist(b, point) < dist(a, point) ? b : a));
  if (dist(nearest, point) > maxDist) return null;
  return nearest.w;
}

/**
 * Dokunulan noktadaki kişiyi seçer (kullanıcı "vuran oyuncu bu" diye dokunduğunda).
 * people: o karedeki iskeletler. pt: dokunulan nokta {x,y} (canvas pikseli).
 * Kural: iskeletin noktalarından dokunuşa en yakın olanı seç; ama en yakın nokta, o kişinin
 * boyunun yarısından uzaktaysa (boş zemine dokunulduysa) kimseyi seçme.
 * Dönen: iskelet ya da null.
 */
export function personAtPoint(people, pt) {
  let best = null, bestD = Infinity;
  for (const p of people || []) {
    const ys = p.map((q) => q.y);
    const height = Math.max(...ys) - Math.min(...ys) || 1;
    const d = Math.min(...p.map((q) => dist(q, pt))) / height;
    if (d < bestD) { bestD = d; best = p; }
  }
  return bestD <= 0.5 ? best : null;
}

/**
 * Tek bir çağrıda hem oyuncu hem top seçimi (app.js draw()'ın kullandığı kısayol).
 * Dönen: { person, ball } — ikisi de yukarıdaki fonksiyonların dönüşü, ikisi de null olabilir.
 */
export function pickDisplay(frame, index, track, contact, ballAnchor, t, fit) {
  return {
    person: pickTrackedPerson(track, index),
    ball: pickDisplayBall(frame, index, contact, ballAnchor, t, fit),
  };
}

/**
 * Canlı önizleme (tarama sırasında, henüz track/temas yok): topa en yakın kişi + en güvenli top.
 * Kalabalık bir sahnede (Liverpool yayını gibi) herkesi çizmek yerine tek bir "muhtemelen bu"
 * tahmini gösterir — kesin değildir (vuruş henüz bulunmadı), sadece görsel geri bildirim.
 * Dönen: { person, ball } — top yoksa ikisi de null (kimin oynadığı topsuz belli olmaz),
 * top var ama kimse yoksa { person: null, ball }.
 */
export function pickLiveDisplay(frame) {
  const balls = (frame?.balls || []).filter((b) => b.w > 0);
  const ball = balls.length ? balls.reduce((a, b) => (b.s > a.s ? b : a)) : null;
  if (!ball) return { person: null, ball: null };
  const people = frame?.people || [];
  if (!people.length) return { person: null, ball };
  const footDist = (p) => Math.min(...FEET.map((i) => dist(p[i], ball)));
  const person = people.reduce((a, p) => (footDist(p) < footDist(a) ? p : a));
  return { person, ball };
}
