// Uygulama katmanı: video → vision.js (göz) → detect.js/scan.js (otomatik vuruş bulma) → metrics.js (cetvel) → coach.js (hoca).
// cp-07-otomatik: kullanıcı artık temas karesini ve topu elle aramak zorunda değil. Video yüklenince
// uygulama vuruşları kendisi bulur (uzun videolarda iki geçişli tarama), bir liste gösterir, kullanıcı
// bir vuruşa tıklar. Elle işaretleme akışı hâlâ var: hem "vuruş bulunamadı" durumunda hem de
// otomatik sonucu düzeltmek isteyen kullanıcı için bir yedek yol ("Elle düzelt").
import { processRange } from './vision.js?v=11';
import { findKicks, classifyView, suggestMode } from './detect.js?v=11';
import { candidateWindows } from './scan.js?v=11';
import { measure, measureFreeKick, buildTrack } from './metrics.js?v=11';
import { evaluate } from './coach.js?v=11';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const DENSE_FPS = 30; // pas 2: her aday pencere bu hızda işlenir (findKicks bunun üstünde ayarlandı)
const COARSE_FPS = 5; // pas 1: videonun tamamı bu ucuz hızda taranır
const SHORT_VIDEO_MAX = 8; // saniye: bunun altındaki videolar tek geçişte (dense) taranır, kaba pas atlanır

// frames: şu an ekranda/track'te olan vision.js kare listesi [{t,people,balls}, ...]
// (bir vuruşun kendi penceresi, ya da elle-düzelt için ilk birkaç saniye).
// track: seçilen oyuncunun kare kare tek iskeleti (frames ile aynı uzunlukta).
// kicks: taramada bulunan tüm vuruşlar, her biri kendi frames penceresini taşır (tekrar oynatılabilsin diye).
const state = { frames: [], track: null, index: 0, contact: null, ball: null, busy: false, kicks: [], activeKick: null, stopRequested: false };

function setStatus(t) { $('status').textContent = t; }

// Videoyu belli bir ana götürür. Tarayıcı bazen 'seeked' olayını atlar (aynı zamana sarma gibi),
// o yüzden 1 saniyelik yedek süre var: işlem asla sonsuza kadar beklemez.
function seek(t) {
  return new Promise((res) => {
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return res();
    const done = () => { clearTimeout(timer); res(); };
    const timer = setTimeout(() => { video.removeEventListener('seeked', done); res(); }, 1000);
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = t;
  });
}

// Bazı videolar (telefon kayıtları, webm) süresini baştan söylemez (Infinity).
// Videoyu çok ileri sarınca tarayıcı gerçek süreyi öğrenir.
async function realDuration() {
  if (Number.isFinite(video.duration)) return video.duration;
  await seek(1e7);
  const d = video.duration;
  await seek(0);
  return Number.isFinite(d) ? d : video.currentTime;
}

// İşlem sırasında tüm kontroller kilitli: kullanıcı işlemin ortasında videoyu başka yere atlatamasın.
// Tarama (scanVideo) kendi Durdur butonunu ayrıca yönetir.
function setBusy(b) {
  state.busy = b;
  for (const id of ['prev', 'next', 'play', 'scrub', 'markContact', 'file', 'mode', 'foot']) $(id).disabled = b;
  $('progress').hidden = !b;
  $('stopBtn').hidden = !b;
  $('stageWrap').classList.toggle('busy', b);
  if (!b) updateReady();
}

// --- otomatik tarama: iki geçiş (cp-07-otomatik, bkz. scan.js) ---

// Videonun [t0,t1) aralığını fps hızında işler; ilerleme/kalan süre durum satırına yazılır,
// her kare canlı olarak (henüz oyuncu seçilmeden) tuvale çizilir.
function runPass(t0, t1, fps, label) {
  const started = performance.now();
  return processRange(video, {
    t0, t1, fps,
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

// Tarama sırasında (henüz oyuncu seçilmeden) o anki kareyi çizer: herkes eşit parlaklıkta,
// tespit edilen her top ince beyaz bir çemberle işaretlenir.
function drawLive(frame) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 400;
  for (const p of frame.people || []) drawPose(p, s, true);
  drawBalls(frame, s);
}

function drawBalls(frame, s) {
  for (const b of frame.balls || []) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1 * s;
    ctx.beginPath(); ctx.arc(b.x, b.y, Math.max(4, (b.w || 8) / 2) * s, 0, Math.PI * 2); ctx.stroke();
  }
}

// findKicks + classifyView + suggestMode'u bir pencerenin yoğun karelerine uygular,
// bulunan vuruşları state.kicks'e ekler. Her vuruş kendi 'frames' penceresini taşır ki
// listeden tıklanınca o pencere tekrar oynatılabilsin.
function collectKicks(denseFrames) {
  const kicks = findKicks(denseFrames, DENSE_FPS);
  for (const k of kicks) {
    const view = classifyView(denseFrames, k, DENSE_FPS);
    const suggestion = suggestMode(view.view);
    state.kicks.push({ ...k, frames: denseFrames, fps: DENSE_FPS, t: denseFrames[k.contact].t, view, suggestion, score: null });
  }
}

// Vuruş bulunamadığında (ya da video çok kısa/otomatik hiçbir şey vermediğinde) elle işaretleme
// akışına düşer: ilk 8 sn'yi (ya da zaten elde varsa o kareleri) yoğun işler ve ekrana yükler.
async function fallbackManual(existingFrames) {
  $('noKick').hidden = false;
  let frames = existingFrames;
  if (!frames) {
    setStatus('Vuruş bulunamadı, ilk 8 sn elle işaretlemen için hazırlanıyor…');
    const dur = await realDuration();
    frames = await runPass(0, Math.min(SHORT_VIDEO_MAX, dur), DENSE_FPS, 'Hazırlanıyor');
  }
  loadFrames(frames, null);
  show(0);
  updateReady();
  setStatus('Vuruş bulunamadı. Elle işaretleyebilirsin: aşağıdaki adımları izle.');
}

// Ana tarama akışı. Kısa videolarda tek yoğun geçiş; uzun videolarda önce kaba geçiş, sonra
// sadece aday pencereler yoğun işlenir (5 dk'lık videoyu baştan sona 30 fps işlemek imkansız).
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
  const dur = await realDuration();

  try {
    if (dur <= SHORT_VIDEO_MAX) {
      setStatus('Kısa video: tek geçişte taranıyor…');
      const dense = await runPass(0, dur, DENSE_FPS, 'Taranıyor');
      if (state.stopRequested) { setStatus('Durduruldu.'); setBusy(false); return; }
      collectKicks(dense);
      if (!state.kicks.length) { await fallbackManual(dense); setBusy(false); return; }
    } else {
      setStatus('1/2: Video hızlıca taranıyor (kaba geçiş, 5 fps)…');
      const coarse = await runPass(0, dur, COARSE_FPS, 'Kaba tarama');
      if (state.stopRequested) { setStatus('Durduruldu.'); setBusy(false); return; }
      const windows = candidateWindows(coarse);
      if (!windows.length) { await fallbackManual(null); setBusy(false); return; }
      let n = 0;
      for (const w of windows) {
        n++;
        setStatus(`2/2: Aday an ${n}/${windows.length} inceleniyor (yoğun geçiş, 30 fps)…`);
        const t0 = Math.max(0, w.t0), t1 = Math.min(dur, w.t1);
        const dense = await runPass(t0, t1, DENSE_FPS, `Aday ${n}/${windows.length}`);
        if (state.stopRequested) break;
        collectKicks(dense);
      }
      if (!state.kicks.length) { await fallbackManual(null); setBusy(false); return; }
    }
  } catch (err) {
    setStatus('Hata: ' + err.message);
    setBusy(false);
    return;
  }
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
// oyuncuyu takip eder ve analiz eder. Mod/ayak seçimleri "Otomatik"a döner (tespit edilen değeri kullanır).
function loadKick(i) {
  const k = state.kicks[i];
  loadFrames(k.frames, k);
  state.contact = k.contact;
  state.ball = { x: k.rest.x, y: k.rest.y };
  state.track = buildTrack(k.frames.map((f) => f.people), k.contact, state.ball);
  $('mode').value = 'auto';
  $('foot').value = 'auto';
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
  ctx.globalAlpha = main ? 1 : 0.35;
  ctx.lineWidth = 3 * s;
  for (const [a, b] of BONES) {
    ctx.strokeStyle = main && kick.includes(a) && kick.includes(b) ? '#ffb547' : '#3ddc84';
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

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const s = canvas.width / 400; // çizgi kalınlığı videonun boyutuna göre
  const f = state.frames[state.index];
  const main = state.track ? state.track[state.index] : null;
  // Oyuncu seçilmeden önce herkes aynı çizilir. Seçildikten sonra oyuncu parlak, diğerleri soluk.
  for (const p of f?.people || []) drawPose(p, s, state.track ? p === main : true);
  if (f) drawBalls(f, s); // tespit edilen her top ince beyaz çemberle (kalın olan aşağıdaki, temas topu)
  if (state.ball && state.index === state.contact) {
    ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2 * s;
    ctx.beginPath(); ctx.arc(state.ball.x, state.ball.y, 14 * s, 0, Math.PI * 2); ctx.stroke();
  }
  if (state.index === state.contact) {
    ctx.fillStyle = '#ffb547'; ctx.font = `bold ${14 * s}px system-ui`;
    ctx.fillText('TEMAS', 10 * s, 22 * s);
  }
}

function updateReady() {
  $('analyze').disabled = !(state.contact !== null && state.ball);
  $('ballLabel').textContent = state.ball ? 'top işaretlendi ✓' : 'top işaretlenmedi';
}

// --- mod/ayak: "Otomatik" seçiliyse tespit edilen vuruşun değerini kullanır ---

function effectiveMode() {
  const sel = $('mode').value;
  if (sel !== 'auto') return sel;
  return state.activeKick?.suggestion?.mode || 'shot';
}
function effectiveFoot() {
  const sel = $('foot').value;
  if (sel !== 'auto') return sel;
  return state.activeKick?.foot || 'right';
}

// Kullanıcının seçtiği mod, tespit edilen kamera açısıyla uyuşmuyorsa uyarı döner (madde 5):
// yandan çekimde şut/pas ölçülür, arkadan çekimde frikik. Açı bilinmiyorsa uyarı verilmez (kanıt yok).
const VIEW_LABEL = { side: 'Yandan', behind: 'Arkadan', front: 'Önden', unknown: 'Bilinmiyor' };
function viewWarning(mode) {
  const view = state.activeKick?.view?.view;
  if (!view || view === 'unknown') return null;
  const compatible = (mode === 'freekick' && view === 'behind') || ((mode === 'shot' || mode === 'pass') && view === 'side');
  if (compatible) return null;
  return `Bu açıdan (${VIEW_LABEL[view]}) ${MODE_TITLE[mode]} ölçümleri güvenilir değil.`;
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

// Kamera kurulumu moda göre değişir (RESEARCH.md bölüm 3-4). "Otomatik" seçiliyken genel bir ipucu gösterilir.
const SETUP_HINTS = {
  auto: 'Videoyu yükle, hoca vuruşu ve kamera açısını kendisi bulsun. Yandan çekimde şut/pas, arkadan çekimde frikik ölçülür.',
  shot: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  pass: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  freekick: 'Çekim: arkadan ya da çapraz arkadan, telefon sabit, oyuncu ve top kadrajda.',
};
$('mode').addEventListener('change', () => {
  $('setupHint').textContent = SETUP_HINTS[$('mode').value];
  draw();
  runAnalysis(); // mod değişince mevcut temas/topla yeniden analiz et (varsa)
});
$('foot').addEventListener('change', () => { draw(); runAnalysis(); });

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
const MODE_TITLE = { shot: 'Şut', pass: 'Pas', freekick: 'Frikik' };

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
  $('kickRows').innerHTML = state.kicks.map((k, i) => `
    <div class="kickRow ${state.activeKick === k ? 'active' : ''}" data-i="${i}">
      <span class="kt">${fmtTime(k.t)}</span>
      <span class="kf">${FOOT_LABEL[k.foot]}</span>
      <span class="kv" title="${k.view.reason}">${VIEW_LABEL[k.view.view]}</span>
      <span class="km">${k.suggestion.mode ? MODE_TITLE[k.suggestion.mode] : k.suggestion.note}</span>
      <span class="ks">${k.score !== null ? k.score : '—'}</span>
    </div>`).join('');
  for (const row of wrap.querySelectorAll('.kickRow')) {
    row.addEventListener('click', () => loadKick(Number(row.dataset.i)));
  }
}

// --- analiz ---

function runAnalysis() {
  if (state.contact === null || !state.ball || !state.track) return;
  const mode = effectiveMode();
  const foot = effectiveFoot();
  try {
    // Frikik arkadan kamerayla ölçülür (measureFreeKick), şut/pas yandan (measure)
    // measure() temas civarındaki pencereleri (Ş5/Ş7/Ş8) saniyeye çevirmek için fps ister:
    // burada her zaman yoğun geçişin (DENSE_FPS) karelerini kullanıyoruz.
    const m = mode === 'freekick'
      ? measureFreeKick(state.track, state.contact, state.ball, foot)
      : measure(state.track, state.contact, state.ball, foot, DENSE_FPS);
    const res = evaluate(m, mode);
    if (state.activeKick) { state.activeKick.score = res.total; renderKickList(); }
    renderReport(res, mode, viewWarning(mode));
  } catch (err) { setStatus(err.message); }
}

function renderReport(res, mode, warning) {
  const el = $('report');
  const band = (s) => (s >= 80 ? '' : s >= 50 ? 'mid' : 'low');
  const p = state.track[state.contact];
  const lowVis = p && [23, 24, 25, 26, 27, 28].some((i) => p[i].v < 0.5);
  // Ş5 (temas anındaki diz) ölçüldüyse 60 fps ipucu göster: METRICS.md'deki 30 fps bulanıklığı notu.
  const s5 = res.items.find((i) => i.ref === 'Ş5');
  const s5Measured = s5 && s5.score !== null;
  el.innerHTML = `
    <h2>${MODE_TITLE[mode] ?? 'Pas'} raporu</h2>
    <div class="score"><span class="big">${res.total}</span><span>/ 100</span></div>
    <div class="coach">${res.verdict}${res.focus.length ? '<br><br><b>Odaklan:</b> ' + res.focus.map((f) => f.tip).join(' ') : ''}</div>
    ${warning ? `<p class="warn">${warning}</p>` : ''}
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
