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

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const FEET = [27, 28, 31, 32]; // ayak bileği (sol/sağ), ayak ucu (sol/sağ)

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
 * flightPoint: trajectory.js#ballFlight çıktısından bu kareye denk gelen nokta ({i,x,y}) ya da null
 *   (çağıran taraf state.flight dizisinden index'e göre bulur, bkz. app.js flightPointAt).
 *
 * Kural (Mert'in isteği): temas KARESİNDE işaretlenen top gösterilir; temastan ÖNCEKİ karelerde
 * o karenin ham tespitlerinden ankor'a EN YAKIN olanı (top kare kare kaydığı için en iyi proxy);
 * temastan SONRAKİ karelerde SADECE ballFlight yolunun o kareye denk gelen noktası — yol o karede
 * topu bulamadıysa (miss) hiçbir top gösterilmez, başka bir tespite atlanmaz.
 * Dönen: {x,y,w} biçiminde tek top ya da null.
 */
export function pickDisplayBall(frame, index, contact, ballAnchor, flightPoint) {
  if (contact === null || !ballAnchor) return null;
  if (index === contact) {
    return { x: ballAnchor.x, y: ballAnchor.y, w: ballAnchor.w ?? nearestWidth(frame, ballAnchor) };
  }
  if (index > contact) return flightPoint || null;
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return null;
  return cands.reduce((a, b) => (dist(b, ballAnchor) < dist(a, ballAnchor) ? b : a));
}

// Temas topu genelde sadece {x,y} taşır (genişlik bilgisi yok, elle işaretlemede hiç ölçülmedi).
// Nişangahı doğru boyutlandırmak için o karedeki ham tespitlerden ankor'a en yakın olanın w'sini
// ödünç alırız; hiç tespit yoksa makul bir varsayılana (16 piksel) düşülür.
function nearestWidth(frame, point) {
  const cands = (frame?.balls || []).filter((b) => b.w > 0);
  if (!cands.length) return 16;
  return cands.reduce((a, b) => (dist(b, point) < dist(a, point) ? b : a)).w;
}

/**
 * Tek bir çağrıda hem oyuncu hem top seçimi (app.js draw()'ın kullandığı kısayol).
 * Dönen: { person, ball } — ikisi de yukarıdaki fonksiyonların dönüşü, ikisi de null olabilir.
 */
export function pickDisplay(frame, index, track, contact, ballAnchor, flightPoint) {
  return {
    person: pickTrackedPerson(track, index),
    ball: pickDisplayBall(frame, index, contact, ballAnchor, flightPoint),
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
