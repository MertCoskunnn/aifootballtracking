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
// akıcı hareket eder, tek bir kötü tespit onu oynatmaz. fit kurulamadıysa (çok az/dağınık veri) eski
// kare-tabanlı davranışa (flightPointFallback) düşülür.
import { flightAt } from './trajectory.js?v=27';

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const FEET = [27, 28, 31, 32]; // ayak bileği (sol/sağ), ayak ucu (sol/sağ)
// fit'in son güvenilir noktasından (tEnd) sonra ne kadar ileri ekstrapole edilebileceği (saniye).
// trajectory.js#flightTrail'in varsayılan extendSec'iyle aynı: topun kadraj dışına kısa bir süre
// daha "uçmaya devam ediyormuş" gibi görünmesi doğal, ama sınırsız ekstrapolasyon saçmalar.
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
 * fit: trajectory.js#fitFlight çıktısı ya da null (RANSAC yetersiz veri yüzünden kuramadıysa).
 * flightPointFallback: fit YOKSA kullanılan eski (kare tabanlı) nokta — trajectory.js#ballFlight
 *   çıktısından bu kareye denk gelen nokta ({i,x,y}) ya da null (çağıran taraf bulur).
 *
 * Kural (Mert'in isteği): temas KARESİNDE işaretlenen top gösterilir; temastan ÖNCEKİ karelerde
 * o karenin ham tespitlerinden ankor'a EN YAKIN olanı (top kare kare kaydığı için en iyi proxy);
 * temastan SONRA fit varsa eğri üzerindeki `t` anındaki nokta (flightAt) — ham tespitlerin
 * zıplaması nişangahı OYNATMAZ; fit yoksa eski kare-tabanlı yönteme (flightPointFallback) düşülür,
 * o da yoksa (yol o karede topu bulamadıysa) hiçbir top gösterilmez, başka bir tespite atlanmaz.
 * Dönen: {x,y,w} biçiminde tek top ya da null.
 */
export function pickDisplayBall(frame, index, contact, ballAnchor, t, fit, flightPointFallback) {
  if (contact === null || !ballAnchor) return null;
  const w = ballAnchor.w ?? nearestBallWidth(frame, ballAnchor);
  if (index === contact) return { x: ballAnchor.x, y: ballAnchor.y, w };
  if (index > contact) {
    if (fit) {
      const clampedT = Math.min(t, fit.tEnd + FIT_EXTEND_SEC);
      const { x, y } = flightAt(fit, clampedT);
      return { x, y, w };
    }
    return flightPointFallback || null;
  }
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return null;
  return cands.reduce((a, b) => (dist(b, ballAnchor) < dist(a, ballAnchor) ? b : a));
}

// Temas topu genelde sadece {x,y} taşır (genişlik bilgisi yok, elle işaretlemede hiç ölçülmedi).
// Nişangahı doğru boyutlandırmak için o karedeki ham tespitlerden ankor'a en yakın olanın w'sini
// ödünç alırız; hiç tespit yoksa makul bir varsayılana (16 piksel) düşülür. app.js da fit'e eklenen
// temas noktasının genişliğini bulmak için bunu kullanıyor (cp-19).
export function nearestBallWidth(frame, point) {
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return 16;
  return cands.reduce((a, b) => (dist(b, point) < dist(a, point) ? b : a)).w;
}

/**
 * Tek bir çağrıda hem oyuncu hem top seçimi (app.js draw()'ın kullandığı kısayol).
 * Dönen: { person, ball } — ikisi de yukarıdaki fonksiyonların dönüşü, ikisi de null olabilir.
 */
export function pickDisplay(frame, index, track, contact, ballAnchor, t, fit, flightPointFallback) {
  return {
    person: pickTrackedPerson(track, index),
    ball: pickDisplayBall(frame, index, contact, ballAnchor, t, fit, flightPointFallback),
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
