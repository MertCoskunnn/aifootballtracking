// Uygulama katmanı: video → vision.js (göz) → detect.js/scan.js (otomatik vuruş bulma) → metrics.js (cetvel) → coach.js (hoca).
// cp-07-otomatik: kullanıcı artık temas karesini ve topu elle aramak zorunda değil. Video yüklenince
// uygulama vuruşları kendisi bulur (uzun videolarda iki geçişli tarama), bir liste gösterir, kullanıcı
// bir vuruşa tıklar. Elle işaretleme akışı hâlâ var: hem "vuruş bulunamadı" durumunda hem de
// otomatik sonucu düzeltmek isteyen kullanıcı için bir yedek yol ("Elle düzelt").
// cp-10-regresyon: tarama/analiz mantığı buradan pipeline.js'e taşındı. Neden: uygulama ve
// tarayıcıda çalışan regresyon kontrol sayfası (tests/regresyon.html) AYNI kodu çalıştırmalı,
// yoksa "Messi hâlâ 100 mü" kontrolü sadece burada doğru, orada yanlış olabilir. Bu dosyada artık
// sadece arayüz ve akış var; tarama adımlarının kendisi pipeline.js'te.
// cp-15-secmeli-menu: Otomatik mod kalktı (ürün kararı). Açı, vuruş türü ve ayak artık kullanıcının
// KENDİ seçtiği üç ayrı liste; hiçbiri varsayılan değerle gelmiyor ("Seç..."). Otomatik kalan tek
// şeyler: iskeletin oturması (buildTrack), topun bulunması ve temas karesinin bulunması (findKicks) —
// bunlar hâlâ detect.js/pipeline.js'te. classifyView/suggestMode artık modu/açıyı SEÇMİYOR, sadece
// "seçtiğin açı ile videonun görünüşü uyuşmuyor" diye yumuşak bir uyarı için kullanılıyor (viewWarning).
import * as pipeline from './pipeline.js?v=27';
import { measure, measureFreeKick, buildTrack } from './metrics.js?v=27';
import { evaluate } from './coach.js?v=27';
import { ballFlight, fitFlight, flightPath, flightTrail, collectCandidates } from './trajectory.js?v=27';
import { getRuleSet } from './rules.js?v=27';
import { pickTrackedPerson, pickDisplayBall, pickLiveDisplay, nearestBallWidth } from './display.js?v=27';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

// frames: şu an ekranda/track'te olan vision.js kare listesi [{t,people,balls}, ...]
// (bir vuruşun kendi penceresi, ya da elle-düzelt için ilk birkaç saniye).
// track: seçilen oyuncunun kare kare tek iskeleti (frames ile aynı uzunlukta).
// kicks: taramada bulunan tüm vuruşlar, her biri kendi frames penceresini taşır (tekrar oynatılabilsin diye).
const state = { frames: [], track: null, index: 0, contact: null, ball: null, busy: false, kicks: [], activeKick: null, stopRequested: false };

function setStatus(t) { $('status').textContent = t; }

// Videoyu belli bir ana götürür. Tarayıcı bazen 'seeked' olayını atlar (aynı zamana sarma gibi),
// o yüzden 1 saniyelik yedek süre var: işlem asla sonsuza kadar beklemez.
// (pipeline.js'in kendi seek'i tarama akışı için; bu, show()'un oynatma/kare gösterimi için.)
function seek(t) {
  return new Promise((res) => {
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return res();
    const done = () => { clearTimeout(timer); res(); };
    const timer = setTimeout(() => { video.removeEventListener('seeked', done); res(); }, 1000);
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = t;
  });
}

// İşlem sırasında tüm kontroller kilitli: kullanıcı işlemin ortasında videoyu başka yere atlatamasın.
// Tarama (scanVideo) kendi Durdur butonunu ayrıca yönetir.
function setBusy(b) {
  state.busy = b;
  for (const id of ['prev', 'next', 'play', 'scrub', 'markContact', 'file', 'mode', 'foot', 'view']) $(id).disabled = b;
  $('progress').hidden = !b;
  $('stopBtn').hidden = !b;
  $('stageWrap').classList.toggle('busy', b);
  if (!b) updateReady();
}

// --- otomatik tarama: iki geçiş (cp-07-otomatik, mantığı artık pipeline.js'te, bkz. scan.js) ---

// pipeline.runPass'i ilerleme çubuğu/durum metni ve canlı çizimle sarar. Sadece "Elle düzelt"
// akışının ilk 8 saniyeyi hazırlaması için kullanılıyor artık (scanVideo tamamen pipeline'da).
function runPass(t0, t1, fps, label) {
  const started = performance.now();
  return pipeline.runPass(video, t0, t1, fps, {
    shouldStop: () => state.stopRequested,
    onFrame: (frame, i, total) => {
      drawLive(frame);
      const pct = Math.round(((i + 1) / total) * 100);
      const elapsed = (performance.now() - started) / 1000;
      const left = Math.round((elapsed / (i + 1)) * (total - i - 1));
      $('progressBar').style.width = pct + '%';
      setStatus(`${label}: %${pct} (${i + 1}/${total} kare), kalan ~${left} sn.`);
    },
  });
}

// Tarama sırasında (henüz vuruş bulunmadı, oyuncu/top seçilmedi) o anki kareyi çizer.
// cp-18-tek-oyuncu-tek-top: kalabalık bir sahnede (ör. yayın görüntüsü) HERKESİ soluk çizmek
// yerine tek bir tahmin gösterir — topa en yakın kişi + en güvenli top (pickLiveDisplay,
// display.js). Kesin değildir (vuruş henüz bulunmadı), sadece "bir şey oluyor" geri bildirimi;
// tarama ekranı zaten ileride bir yükleme ekranıyla değişecek, bu yüzden burada fazla
// mühendislik yapılmadı — tek kişi/tek top bulunamazsa (frame boşsa) hiçbir şey çizilmez.
function drawLive(frame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 400;
  const { person, ball } = pickLiveDisplay(frame);
  if (person) drawPose(person, s, true);
  if (ball) drawBallMarker(ball, s, false);
}

// cp-17-nisangah: topu saran işaret artık oyunlardaki crosshair gibi ince bir nişangah — topun
// GERÇEK tespit boyutuna (b.w) göre ölçeklenen bir çember + dört kısa çentik. Eskiden çember
// toptan çok büyüktü: sıradan tespitler sabit bir taban yarıçapa yakın çiziliyordu, temas topu
// ise b.w'den tamamen bağımsız, sabit 14*s piksel yarıçaplıydı (küçük bir topta devasa kalıyordu).
// Yarıçap artık b.w/2 × 1.15 (topu tam sarıp biraz taşan bir pay) — çizgi kalınlığı hâlâ s ile
// ölçekleniyor. Temas topu turuncu ve biraz kalın, diğer tespitler soluk beyaz ve ince.
function drawBallMarker(b, s, isContact) {
  if (!b) return;
  const r = Math.max(3, ((b.w || 8) / 2) * 1.15) * s;
  ctx.strokeStyle = isContact ? '#ffb547' : 'rgba(255,255,255,0.55)';
  ctx.lineWidth = (isContact ? 2 : 1) * s;
  ctx.beginPath(); ctx.arc(b.x, b.y, r, 0, Math.PI * 2); ctx.stroke();
  // dört kısa çentik: çemberin biraz dışından başlayıp dışa doğru kısa bir çizgi
  const gap = r * 0.25, tick = Math.max(3 * s, r * 0.35);
  ctx.beginPath();
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    ctx.moveTo(b.x + dx * (r + gap), b.y + dy * (r + gap));
    ctx.lineTo(b.x + dx * (r + gap + tick), b.y + dy * (r + gap + tick));
  }
  ctx.stroke();
}

// Oyuncu/top henüz seçilmemişken (elle işaretleme akışının başı, state.track yok) o karedeki
// TÜM ham top tespitlerini gösterir — kullanıcı hangi topun doğru top olduğunu bulmaya çalışıyor,
// tek bir tahminle onu yanıltmayalım. state.track kurulduktan sonra bu fonksiyon kullanılmaz,
// yerini pickDisplayBall (display.js, cp-18-tek-oyuncu-tek-top) alır.
function drawBalls(frame, s) {
  for (const b of frame.balls || []) drawBallMarker(b, s, false);
}

// Vuruş bulunamadığında (ya da video çok kısa/otomatik hiçbir şey vermediğinde) elle işaretleme
// akışına düşer: ilk 8 sn'yi (ya da zaten elde varsa o kareleri) yoğun işler ve ekrana yükler.
async function fallbackManual(existingFrames) {
  $('noKick').hidden = false;
  let frames = existingFrames;
  if (!frames) {
    setStatus('Vuruş bulunamadı, ilk 8 sn elle işaretlemen için hazırlanıyor…');
    const dur = await pipeline.realDuration(video);
    frames = await runPass(0, Math.min(pipeline.SHORT_VIDEO_MAX, dur), pipeline.DENSE_FPS, 'Hazırlanıyor');
  }
  loadFrames(frames, null);
  show(0);
  updateReady();
  setStatus('Vuruş bulunamadı. Elle işaretleyebilirsin: aşağıdaki adımları izle.');
}

// Bir geçişin (kaba/yoğun) başlarken gösterilen tek seferlik mesaj: pipeline.scanVideo bize
// sadece kare başına ilerleme (onProgress) verir, "bu geçiş başlıyor" anını etiketten çıkarırız.
function passStartText(label) {
  if (label === 'Taranıyor') return 'Kısa video: tek geçişte taranıyor…';
  if (label === 'Kaba tarama') return '1/2: Video hızlıca taranıyor (kaba geçiş, 5 fps)…';
  return `2/2: ${label} inceleniyor (yoğun geçiş, 30 fps)…`; // label = "Aday n/total"
}

// Ana tarama akışı. Kısa videolarda tek yoğun geçiş; uzun videolarda önce kaba geçiş, sonra
// sadece aday pencereler yoğun işlenir (5 dk'lık videoyu baştan sona 30 fps işlemek imkansız).
// Adımların kendisi artık pipeline.scanVideo'da: burada sadece ilerleme/durum metnini çiziyor
// ve sonucu (kicks / fallbackFrames / stopped) ekrana yansıtıyoruz.
async function scanVideo() {
  setBusy(true);
  state.kicks = [];
  state.activeKick = null;
  state.stopRequested = false;
  $('kickList').hidden = true;
  $('noKick').hidden = true;
  $('report').hidden = true;
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  let started = performance.now();
  let lastLabel = null;
  const onProgress = (label, i, total) => {
    if (label !== lastLabel) {
      started = performance.now();
      lastLabel = label;
      setStatus(passStartText(label));
      if (i === 0) return; // geçiş başlarken tek seferlik mesaj görünsün, hemen %0 ile ezilmesin
    }
    const pct = Math.round(((i + 1) / total) * 100);
    const elapsed = (performance.now() - started) / 1000;
    const left = Math.round((elapsed / (i + 1)) * (total - i - 1));
    $('progressBar').style.width = pct + '%';
    setStatus(`${label}: %${pct} (${i + 1}/${total} kare), kalan ~${left} sn.`);
  };

  let result;
  try {
    result = await pipeline.scanVideo(video, { shouldStop: () => state.stopRequested, onFrame: drawLive, onProgress });
  } catch (err) {
    setStatus('Hata: ' + err.message);
    setBusy(false);
    return;
  }
  if (result.stopped) { setStatus('Durduruldu.'); setBusy(false); return; }
  if (!result.kicks.length) { await fallbackManual(result.fallbackFrames); setBusy(false); return; }
  state.kicks = result.kicks;
  setBusy(false);
  renderKickList();
  // İlk vuruşu hemen aç. Eskiden sadece liste çıkıyordu, hiçbir vuruş yüklenmiyordu: oynat
  // butonu çalışmıyor, video işlemenin son karesinde "donmuş" görünüyordu (Mert'in 5 sn'lik testi).
  loadKick(0);
  setStatus(state.kicks.length > 1
    ? `Tarama tamam: ${state.kicks.length} vuruş bulundu, ilki açıldı. Diğerleri için listeden birine tıkla.`
    : 'Tarama tamam: vuruş bulundu ve açıldı. ⏵ ile oynatabilirsin.');
}

// --- kare gösterimi / oynatma (hem tarama sonrası yüklenen pencere hem elle-düzelt için ortak) ---

// state.frames'i değiştirir (bir vuruşun penceresi ya da elle-düzelt kareleri), oynatma/işaretleme
// durumunu sıfırlar. kick verilirse "otomatik yüklendi" (activeKick) olarak işaretlenir.
// show()'u çağırmaz: çağıran taraf, doğru kareyi TEK bir show() çağrısıyla kendi seçer
// (iki eşzamanlı show() çağrısı seek()'in 'seeked' olayını karıştırıp yanlış karede kalabilir).
function loadFrames(frames, kick) {
  state.frames = frames;
  state.track = null;
  state.contact = null;
  state.ball = null;
  state.activeKick = kick;
  $('scrub').max = Math.max(0, frames.length - 1);
  $('stageWrap').hidden = false;
}

// Bir vuruş listesi satırına tıklanınca: o vuruşun penceresini yükler, temas/topu otomatik ayarlar,
// oyuncuyu takip eder ve analiz eder. cp-15-secmeli-menu: mod/ayak/açı artık kullanıcının kendi
// seçimi — burada SIFIRLANMAZ, hangi vuruşa tıklanırsa tıklansın aynı seçimle değerlendirilir.
function loadKick(i) {
  const k = state.kicks[i];
  loadFrames(k.frames, k);
  state.contact = k.contact;
  state.ball = { x: k.rest.x, y: k.rest.y, w: k.rest.w }; // w varsa nişangah tahmine değil gerçek boyuta göre çizilir
  state.track = buildTrack(k.frames.map((f) => f.people), k.contact, state.ball);
  show(k.contact);
  updateReady();
  runAnalysis();
  renderKickList();
}

// Bir kareyi göster: videoyu o karenin gerçek zamanına al (vision.js her karede t saklar,
// böylece sabit fps varsaymaya gerek kalmaz: kaba/yoğun/elle geçişler farklı fps'te olabilir).
async function show(i) {
  if (!video.paused) video.pause();
  state.index = i;
  $('scrub').value = i;
  $('frameLabel').textContent = `${i + 1} / ${state.frames.length}`;
  const f = state.frames[i];
  if (f) await seek(Math.min(video.duration - 0.001, f.t));
  draw();
}

// Oynat / durdur: video oynarken iskelet her karede üstüne çizilir
function togglePlay() {
  if (state.busy || !state.frames.length) return;
  if (!video.paused) { video.pause(); return; }
  if (state.index >= state.frames.length - 1) state.index = 0;
  video.currentTime = state.frames[state.index].t;
  video.play();
}

// Oynarken iskeleti videonun o anki karesine eşitler: en yakın t değerine sahip kareyi bulur
// (frames sabit fps varsaymaz, elimizdeki gerçek zaman damgalarıyla eşleştiririz).
function syncToVideo() {
  if (state.busy || !state.frames.length) return;
  const t = video.currentTime;
  let i = 0, best = Infinity;
  for (let k = 0; k < state.frames.length; k++) {
    const d = Math.abs(state.frames[k].t - t);
    if (d < best) { best = d; i = k; }
  }
  state.index = i;
  $('scrub').value = i;
  $('frameLabel').textContent = `${i + 1} / ${state.frames.length}`;
  draw();
  if (i >= state.frames.length - 1) video.pause();
}
function followPlayback() {
  if (video.paused) return;
  syncToVideo();
  requestAnimationFrame(followPlayback);
}
video.addEventListener('play', () => { $('play').textContent = '⏸'; requestAnimationFrame(followPlayback); });
video.addEventListener('pause', () => { $('play').textContent = '⏵'; });
// Yedek: sekme arka plandayken animasyon durur, 'timeupdate' yine de saniyede birkaç kez gelir
video.addEventListener('timeupdate', () => { if (!video.paused) syncToVideo(); });

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];

function drawPose(p, s, main) {
  const footVal = effectiveFoot();
  const kick = footVal === 'right' ? [24, 26, 28, 30, 32] : [23, 25, 27, 29, 31];
  // cp-12-movenet: p.src === 'movenet' ise bu iskelet BlazePose'un bulamadığı bir kutuda
  // MoveNet'ten geldi (dizi özelliği, bkz. vision.js). Vuran bacak turuncusu aynen kalsın diye
  // sadece varsayılan yeşili camgöbeğiyle değiştiriyoruz — hata ayıklama/içerik videosunda
  // "ikinci göz devrede" görünsün diye.
  const boneColor = p.src === 'movenet' ? '#4fc3f7' : '#3ddc84';
  ctx.globalAlpha = main ? 1 : 0.35;
  ctx.lineWidth = 3 * s;
  for (const [a, b] of BONES) {
    ctx.strokeStyle = main && kick.includes(a) && kick.includes(b) ? '#ffb547' : boneColor;
    ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke();
  }
  if (main) {
    ctx.fillStyle = '#ffffff';
    for (const i of [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]) {
      ctx.beginPath(); ctx.arc(p[i].x, p[i].y, 3 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// cp-18-tek-oyuncu-tek-top: oyuncu/top seçildikten (state.track kurulduktan) SONRA ekranda
// SADECE vuran oyuncunun iskeleti ve SADECE vurulan top görünür — kaleci, yan çizgideki kişiler
// ve yerdeki başka toplar artık çizilmiyor (eskiden hepsi soluk/ince çizilirdi, kafa karıştırıcıydı).
// Seçim mantığının kendisi display.js'te (saf, Node testli); burada sadece SONUCU çiziyoruz.
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 400; // çizgi kalınlığı videonun boyutuna göre
  const f = state.frames[state.index];
  ensureFlight(); // eğri (state.fit) + yedek kare-tabanlı yol (state.flight), hem iz hem tek-top seçimi için
  if (state.track) {
    const main = pickTrackedPerson(state.track, state.index);
    if (main) drawPose(main, s, true); // track o karede kayıpsa (null) hiç iskelet çizilmez, başkasına atlanmaz
    // cp-19: nişangahın konumu artık ZAMANA göre (currentT), kare indeksine göre değil — oynatırken
    // akıcı hareket etsin diye (bkz. currentT, pickDisplayBall).
    const ball = pickDisplayBall(f, state.index, state.contact, state.ball, currentT(), state.fit, flightPointAt(state.index));
    if (ball) drawBallMarker(ball, s, state.index === state.contact);
  } else {
    // Henüz oyuncu/top seçilmedi (elle işaretleme akışının başı): kullanıcı doğru kişiyi/topu
    // bulmaya çalışıyor, bu yüzden burada hâlâ HERKES ve HER top tespiti gösterilir.
    for (const p of f?.people || []) drawPose(p, s, true);
    if (f) drawBalls(f, s);
  }
  drawFlight(s);
  if (state.index === state.contact) {
    ctx.fillStyle = '#ffb547'; ctx.font = `bold ${14 * s}px system-ui`;
    ctx.fillText('TEMAS', 10 * s, 22 * s);
  }
}

// cp-19-sut-izi-animasyon: iz artık KARE indeksinden değil, VİDEO ZAMANINDAN sürülüyor — oynatırken
// video.currentTime (her rAF tikinde followPlayback→syncToVideo→draw zaten çalışıyor, 60 Hz'e yakın),
// durdurulmuşken o anki karenin gerçek t'si. Böylece 25-30 fps'te örneklenen tespitler arasında
// "akan" bir çizgi/nişangah elde ederiz, kare kare zıplamaz.
function currentT() {
  if (!video.paused && Number.isFinite(video.currentTime)) return video.currentTime;
  return state.frames[state.index]?.t ?? 0;
}

// Temas/top değişince bir kez: hem YENİ (zaman-tabanlı, sağlam) eğriyi hem ESKİ (kare-tabanlı,
// yalnızca fit kurulamazsa kullanılan yedek) yolu hesaplar.
// - state.fit: trajectory.js#fitFlight — RANSAC + ağırlıklı en küçük kareler, temas civarındaki
//   TÜM top adayları (collectCandidates) + kullanıcının işaretlediği temas noktası üstüne kurulur.
//   Bu, drawFlight()'ın çizdiği iz VE pickDisplayBall'ın temas-sonrası nişangah konumu için kullanılır.
// - state.flight: eski ballFlight çıktısı, sadece fit null dönerse (çok az/dağınık veri) nişangah
//   için yedek konum kaynağı olarak kalıyor ("fit yoksa eski davranış").
function ensureFlight() {
  if (state.contact === null || !state.ball) { state.fit = null; state.flight = null; state.flightKey = null; return; }
  const key = `${state.contact}:${state.ball.x}:${state.ball.y}:${state.frames.length}`;
  if (state.flightKey === key) return;
  state.flightKey = key;
  state.flight = ballFlight(state.frames, state.contact, state.ball, canvas.width * 0.12);
  const contactFrame = state.frames[state.contact];
  const contactT = contactFrame?.t ?? 0;
  const cands = collectCandidates(state.frames, state.contact, 1.2);
  // Temas karesinde top genelde ayağın arkasında kaybolur (ham tespit yok/güvenilmez); kullanıcının
  // işaretlediği (ya da otomatik bulunan) gerçek temas noktasını da adaylara ekliyoruz — fitFlight
  // bunu ANCOR olarak ağırlıklı tutuyor (bkz. trajectory.js ANCHOR_WEIGHT).
  cands.push({ t: contactT, x: state.ball.x, y: state.ball.y, w: state.ball.w ?? nearestBallWidth(contactFrame, state.ball) });
  state.fit = fitFlight(cands, contactT);
}
const flightPointAt = (i) => state.flight?.find((p) => p.i === i) || null;

// Şut çizgisi (FIFA replay hissi, abartısız): en altta temastan şu ana kadarki İNCE SOLUK tam yol
// (flightPath, beyaz, alpha 0.25) — "geçmiş iz". Üstünde, topun hemen gerisinde sönerek incelen bir
// KUYRUK (flightTrail): her segment kendi alpha/width'iyle — önce geniş düşük-alfa turuncu parıltı,
// üstüne açık sarı-beyaz çekirdek. state.fit yoksa (RANSAC yetersiz veri yüzünden kuramadıysa) hiçbir
// şey çizilmez (eskiden ballFlight+Bezier ile "kırık da olsa bir şey" çizerdi, artık ya sağlam ya hiç).
function drawFlight(s) {
  if (!state.fit) return;
  const tNow = currentT();
  if (tNow <= state.fit.contactT) return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';

  const path = flightPath(state.fit, tNow);
  if (path.length >= 2) {
    ctx.globalAlpha = 0.25; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.moveTo(path[0].x, path[0].y);
    for (let k = 1; k < path.length; k++) ctx.lineTo(path[k].x, path[k].y);
    ctx.stroke();
  }

  const trail = flightTrail(state.fit, tNow);
  if (trail.length >= 2) {
    // Alt katman: geniş, düşük alfa turuncu parıltı — kuyrukla birlikte incelip söner
    for (let k = 1; k < trail.length; k++) {
      ctx.globalAlpha = trail[k].alpha * 0.35;
      ctx.strokeStyle = '#ffb547';
      ctx.lineWidth = (trail[k].width + 5) * s;
      ctx.beginPath(); ctx.moveTo(trail[k - 1].x, trail[k - 1].y); ctx.lineTo(trail[k].x, trail[k].y); ctx.stroke();
    }
    // Üst katman: açık sarı-beyaz çekirdek
    for (let k = 1; k < trail.length; k++) {
      ctx.globalAlpha = trail[k].alpha;
      ctx.strokeStyle = '#fff3d6';
      ctx.lineWidth = trail[k].width * s;
      ctx.beginPath(); ctx.moveTo(trail[k - 1].x, trail[k - 1].y); ctx.lineTo(trail[k].x, trail[k].y); ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// cp-15-secmeli-menu: "Hoca, analiz et" üçü de (açı, vuruş türü, ayak) seçilmeden pasif kalır.
function updateReady() {
  const ready = state.contact !== null && !!state.ball && !!$('mode').value && !!$('foot').value && !!$('view').value;
  $('analyze').disabled = !ready;
  $('ballLabel').textContent = state.ball ? 'top işaretlendi ✓' : 'top işaretlenmedi';
}

// --- mod/ayak/açı: artık üçü de kullanıcının kendi seçimi, "Otomatik" yok (cp-15-secmeli-menu) ---

function effectiveMode() { return $('mode').value; }
function effectiveFoot() { return $('foot').value; }
function effectiveView() { return $('view').value; }

// Kullanıcının SEÇTİĞİ açı, algoritmanın videodan tahmin ettiği kamera açısıyla (classifyView)
// uyuşmuyorsa yumuşak bir uyarı döner. Bu açı tespiti güvenilmez (bkz. METRICS.md "açık kalanlar"),
// bu yüzden puanı ETKİLEMEZ, sadece bilgi amaçlı. Açı tespit edilemediyse (unknown) uyarı verilmez.
const VIEW_LABEL = { side: 'Yandan', behind: 'Arkadan', front: 'Önden', unknown: 'Bilinmiyor' };
function viewWarning(angle) {
  const detected = state.activeKick?.view?.view;
  if (!detected || detected === 'unknown' || !angle || detected === angle) return null;
  return `Seçtiğin açı ${VIEW_LABEL[angle]} ama video ${VIEW_LABEL[detected]} çekilmiş görünüyor (bu açı tespiti güvenilmez, puanı etkilemez — kontrol etmek istersen).`;
}

// --- olaylar ---
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  Object.assign(state, { contact: null, ball: null, track: null, kicks: [], activeKick: null });
  $('report').hidden = true;
  $('kickList').hidden = true;
  $('noKick').hidden = true;
  $('stageWrap').hidden = false;
  video.src = URL.createObjectURL(f);
  // Tarayıcı videoyu çözemezse (örn. iPhone'un HEVC formatı) 'error' gelir, yoksa uygulama sessizce donardı
  const ok = await new Promise((r) => {
    video.addEventListener('loadeddata', () => r(true), { once: true });
    video.addEventListener('error', () => r(false), { once: true });
  });
  if (!ok) {
    setStatus('Bu video tarayıcıda açılamadı. iPhone kullanıyorsan: Ayarlar → Kamera → Formatlar → "En Uyumlu" seç ve yeniden çek. Ya da videoyu MP4 (H.264) olarak dışa aktar.');
    return;
  }
  try { await scanVideo(); } catch (err) { setStatus('Hata: ' + err.message); setBusy(false); }
});

$('stopBtn').addEventListener('click', () => { state.stopRequested = true; setStatus('Durduruluyor…'); });

$('play').addEventListener('click', togglePlay);

$('scrub').addEventListener('input', (e) => show(Number(e.target.value)));
$('prev').addEventListener('click', () => state.index > 0 && show(state.index - 1));
$('next').addEventListener('click', () => state.index < state.frames.length - 1 && show(state.index + 1));

// Kamera kurulumu moda göre değişir (RESEARCH.md bölüm 3-4). Hiçbiri seçilmemişken genel bir ipucu gösterilir.
const SETUP_HINTS = {
  '': 'Açıyı, vuruş türünü ve ayağı seç. Sonra videoyu yükle: hoca vuruş anını ve topu kendisi bulur, temas karesini istersen elle düzeltebilirsin.',
  shot: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  placement: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  pass: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  freekick: 'Çekim: arkadan ya da çapraz arkadan, telefon sabit, oyuncu ve top kadrajda.',
};
function updateSetupHint() { $('setupHint').textContent = SETUP_HINTS[$('mode').value] || SETUP_HINTS['']; }
$('mode').addEventListener('change', () => {
  updateSetupHint();
  draw();
  updateReady();
  runAnalysis(); // mod değişince mevcut temas/topla yeniden analiz et (üçü de seçiliyse)
});
$('foot').addEventListener('change', () => { draw(); updateReady(); runAnalysis(); });
$('view').addEventListener('change', () => { updateReady(); runAnalysis(); });

document.addEventListener('keydown', (e) => {
  if (state.busy || $('stageWrap').hidden) return;
  if (e.key === 'ArrowLeft') $('prev').click();
  if (e.key === 'ArrowRight') $('next').click();
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

// Elle düzelt: mevcut pencerede (otomatik yüklenmiş bir vuruş ya da elle-düzelt kareleri üstünde)
// temas karesini yeniden işaretler. Otomatik vuruş bağlantısı kopar (activeKick sıfırlanır),
// çünkü artık ölçüm elle seçilen temas/topa göre yapılacak.
$('markContact').addEventListener('click', () => {
  video.pause();
  state.contact = state.index;
  state.ball = null;
  state.track = null;
  state.activeKick = null;
  setStatus(`Temas karesi: ${state.index + 1}. Şimdi topun üstüne tıkla.`);
  draw(); updateReady();
});

canvas.addEventListener('click', (e) => {
  if (state.busy) return;
  if (state.contact === null) { togglePlay(); return; } // temas seçilmeden önce videoya tıklamak oynat/durdur
  if (state.index !== state.contact) show(state.contact);
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return; // görünmeyen tuvalde tıklama konumu hesaplanamaz
  state.ball = {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
  state.track = buildTrack(state.frames.map((f) => f.people), state.contact, state.ball);
  if (!state.track[state.contact]) setStatus('Temas karesinde kimse bulunamadı. Başka bir kare seç.');
  else setStatus('Oyuncu seçildi: topa en yakın kişi. Başka biri seçildiyse topa tekrar tıkla.');
  draw(); updateReady();
});

$('analyze').addEventListener('click', runAnalysis);

// --- vuruş listesi ---

const FOOT_LABEL = { right: 'Sağ', left: 'Sol' };
const MODE_TITLE = { shot: 'Ayak üstü şut', pass: 'Pas', freekick: 'Frikik', placement: 'Plase' };

function fmtTime(t) {
  const m = Math.floor(t / 60);
  const s = (t % 60).toFixed(1).padStart(4, '0');
  return `${m}:${s}`;
}

function renderKickList() {
  const wrap = $('kickList');
  if (!state.kicks.length) { wrap.hidden = true; return; }
  wrap.hidden = false;
  $('kickCount').textContent = state.kicks.length;
  // cp-15-secmeli-menu: otomatik mod/açı sütunu kaldırıldı (ürün kararı 1 ve 5). "kv" (açı) bilgi
  // amaçlı kalıyor — classifyView'ın videodan tahmini, hiçbir seçimi sürmüyor, sadece kullanıcı
  // hangi açıyı seçeceğine karar verirken (ya da viewWarning ile karşılaştırırken) bir ipucu.
  $('kickRows').innerHTML = state.kicks.map((k, i) => `
    <div class="kickRow ${state.activeKick === k ? 'active' : ''}" data-i="${i}">
      <span class="kt">${fmtTime(k.t)}</span>
      <span class="kf">${FOOT_LABEL[k.foot]}</span>
      <span class="kv" title="${k.view.reason}">${VIEW_LABEL[k.view.view]}</span>
      <span class="ks">${k.score !== null ? k.score : '—'}</span>
    </div>`).join('');
  for (const row of wrap.querySelectorAll('.kickRow')) {
    row.addEventListener('click', () => loadKick(Number(row.dataset.i)));
  }
}

// --- analiz ---

// Otomatik tespit edilmiş bir vuruş (activeKick) yüklüyse pipeline.analyzeKick kullanılır: aynı
// buildTrack+measure/measureFreeKick+evaluate zincirini regresyon sayfasıyla birebir paylaşır.
// "Elle düzelt" akışında (activeKick yok) kullanıcı temas/topu kendi seçtiği için ortada bir
// "kick" nesnesi yok; o yüzden ölçüm doğrudan metrics.js/coach.js ile yapılır.
function runAnalysis() {
  if (state.contact === null || !state.ball || !state.track) return;
  const mode = effectiveMode();
  const foot = effectiveFoot();
  const angle = effectiveView();
  // cp-15-secmeli-menu: üçü de (açı, vuruş türü, ayak) seçilmeden analiz çalışmaz — "analyze"
  // butonu zaten disabled ama mod/ayak/açı değişince buradan da tekrar çağrılıyor (bkz. olay dinleyicileri).
  if (!mode || !foot || !angle) return;
  // cp-16-kural-matrisi: ölçmeden ÖNCE bu (vuruş türü, ayak, açı) kombinasyonu hiç ölçülebiliyor mu
  // diye bak (ör. frikik yandan çekilmişse). Ölçülemezse measure()/evaluate() hiç çalıştırılmaz,
  // kullanıcıya doğrudan hangi açıdan çekmesi gerektiği söylenir.
  const ruleSet = getRuleSet(mode, foot, angle);
  if (ruleSet.olculemez) { renderUnmeasurable(ruleSet, mode); return; }
  try {
    let res;
    if (state.activeKick) {
      const a = pipeline.analyzeKick(state.activeKick, { mode, foot });
      state.track = a.track;
      res = a.result;
    } else {
      // measure() temas civarındaki pencereleri (Ş5/Ş7/Ş8) saniyeye çevirmek için fps ister:
      // burada her zaman yoğun geçişin (DENSE_FPS) karelerini kullanıyoruz.
      const m = mode === 'freekick'
        ? measureFreeKick(state.track, state.contact, state.ball, foot, pipeline.DENSE_FPS)
        : measure(state.track, state.contact, state.ball, foot, pipeline.DENSE_FPS);
      res = evaluate(m, mode);
    }
    if (state.activeKick) { state.activeKick.score = res.total; renderKickList(); }
    renderReport(res, mode, foot, ruleSet, viewWarning(angle));
  } catch (err) { setStatus(err.message); }
}

// cp-16-kural-matrisi: (mod, ayak, açı) kombinasyonu hiç ölçülemiyorsa (ör. frikik yandan çekilmiş)
// measure()/evaluate() hiç çağrılmaz, doğrudan rules.js'in mesajı gösterilir.
function renderUnmeasurable(ruleSet, mode) {
  const el = $('report');
  el.innerHTML = `
    <h2>${MODE_TITLE[mode] ?? 'Vuruş'} raporu</h2>
    <div class="coach">${ruleSet.mesaj}</div>`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth' });
}

function renderReport(res, mode, foot, ruleSet, warning) {
  const el = $('report');
  const band = (s) => (s >= 80 ? '' : s >= 50 ? 'mid' : 'low');
  const p = state.track[state.contact];
  const lowVis = p && [23, 24, 25, 26, 27, 28].some((i) => p[i].v < 0.5);
  // Ş5 (temas anındaki diz) ölçüldüyse 60 fps ipucu göster: METRICS.md'deki 30 fps bulanıklığı notu.
  const s5 = res.items.find((i) => i.ref === 'Ş5');
  const s5Measured = s5 && s5.score !== null;
  // cp-14a-olcum-yeterliligi: coach.js kapsam yetersizse total:null, insufficient:true döner
  // (Ronaldo'nun arkadan çekilmiş şutunda tek madde ölçülüp gerisi "ölçülemedi" iken eskiden
  // yanıltıcı bir 100 puan çıkıyordu). Puan yerine "—" göster, madde listesi yine aşağıda çıksın.
  // cp-16-kural-matrisi: rapor başlığının altında hangi referans oyuncuya göre ölçüldüğümüz
  // görünüyor ("Referans: Ronaldo (Ayak üstü şut, Sağ ayak)"); [T] ise referansNotu bunu açıklıyor.
  const refLine = ruleSet?.referans
    ? `<p class="hint">Referans: ${ruleSet.referans} (${MODE_TITLE[mode]}, ${FOOT_LABEL[foot]} ayak)${ruleSet.referansNotu ? ` — ${ruleSet.referansNotu}` : ''}</p>`
    : '';
  el.innerHTML = `
    <h2>${MODE_TITLE[mode] ?? 'Pas'} raporu</h2>
    ${refLine}
    <div class="score"><span class="big">${res.insufficient ? '—' : res.total}</span>${res.insufficient ? '' : '<span>/ 100</span>'}</div>
    <div class="coach">${res.verdict}${res.focus.length ? '<br><br><b>Odaklan:</b><br>' + res.focus.map((f) => `${f.tip}${f.drill ? `<br><span class="hint">Alıştırma: ${f.drill}</span>` : ''}`).join('<br><br>') : ''}</div>
    ${warning ? `<p class="warn">${warning}</p>` : ''}
    ${res.movingBall ? '<p class="hint">Top hareketliydi: hareketli topa vuruş kuralları uygulandı.</p>' : ''}
    ${lowVis ? '<p class="warn">Temas karesinde bacak noktalarının bazıları net görünmüyor. Sonuç yanıltıcı olabilir.</p>' : ''}
    ${res.items.map((i) => `
      <div class="metric">
        <span class="name">${i.name} <small>(${i.ref})</small></span>
        <span class="val">${i.score === null ? i.shown : `${i.shown} · ${i.score}`}</span>
        <div class="bar"><i class="${band(i.score ?? 0)}" style="width:${i.score ?? 0}%"></i></div>
        ${i.tip ? `<span class="tip">${i.tip}</span>` : ''}
      </div>`).join('')}
    ${s5Measured ? '<p class="hint">İpucu: temas anı ölçümleri için 60 fps çekim daha doğru sonuç verir.</p>' : ''}
    <p class="hint">Eşikler: METRICS.md — Lees 2010, Petrolo 2024 (elit oyuncular), Messi ölçümleri. 2D tek kamera: derinlik ölçülemez.</p>`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth' });
}
