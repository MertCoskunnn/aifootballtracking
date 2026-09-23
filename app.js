// Uygulama katmanı: video → iskelet (MediaPipe) → ölçüm → hoca.
import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
import { measure, measureFreeKick, buildTrack } from './metrics.js?v=6';
import { evaluate } from './coach.js?v=6';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

// frames: her karede bulunan tüm kişiler (en fazla 3). track: seçilen oyuncunun kare kare iskeleti.
const state = { frames: [], track: null, index: 0, contact: null, ball: null, busy: false };
let landmarker = null;

async function getLandmarker() {
  if (landmarker) return landmarker;
  setStatus('Model yükleniyor (ilk seferde birkaç saniye)…');
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 3, // kadrajda başka biri varsa oyuncuyu kaçırmamak için
  });
  return landmarker;
}

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

const MAX_SECONDS = 20; // uzun videolar dakikalarca sürer, şut anı zaten birkaç saniye

// İşlem sırasında tüm kontroller kilitli: kullanıcı işlemin ortasında videoyu başka yere atlatamasın
function setBusy(b) {
  state.busy = b;
  for (const id of ['prev', 'next', 'play', 'scrub', 'markContact', 'file', 'fps']) $(id).disabled = b;
  $('progress').hidden = !b;
  $('stageWrap').classList.toggle('busy', b);
}

// Videoyu kare kare gezip her karenin iskeletini bir kez çıkarır ve saklar.
// Sonra kaydırıcı sadece saklanan sonuçları çizer, her şey anında olur.
async function processVideo() {
  setBusy(true);
  const lm = await getLandmarker();
  const fps = Number($('fps').value);
  const dur = await realDuration();
  const seconds = Math.min(dur, MAX_SECONDS);
  const total = Math.max(1, Math.floor(seconds * fps));
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  state.frames = [];
  let found = 0;
  const t0 = performance.now();
  for (let i = 0; i < total; i++) {
    await seek(Math.min(dur - 0.001, i / fps));
    const r = lm.detectForVideo(video, Math.round((i * 1000) / fps) + 1);
    const people = r.landmarks.map((pose) =>
      pose.map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height, v: p.visibility ?? 1 })));
    if (people.length) found++;
    state.frames.push(people);
    // Canlı geri bildirim: iskelet işlenirken çizilir, ilerleme ve kalan süre gösterilir
    state.index = i;
    draw();
    const pct = Math.round(((i + 1) / total) * 100);
    const left = Math.round((((performance.now() - t0) / (i + 1)) * (total - i - 1)) / 1000);
    $('progressBar').style.width = pct + '%';
    setStatus(`İskelet çıkarılıyor: %${pct} (${i + 1}/${total} kare), kalan ~${left} sn. Bitene kadar butonlar kilitli.`);
  }
  $('scrub').max = total - 1;
  setBusy(false);
  const ratio = found / total;
  const prefix = dur > MAX_SECONDS ? `Video uzun, ilk ${MAX_SECONDS} sn işlendi. ` : '';
  setStatus(prefix + (ratio < 0.6
    ? `Dikkat: karelerin sadece %${Math.round(ratio * 100)}'ünde iskelet bulundu. Tüm vücut kadrajda mı?`
    : `Hazır: ${total} kare, %${Math.round(ratio * 100)}'ünde iskelet bulundu. Oynat ya da kaydır, temas karesini bul.`));
  show(0);
}

// Oynat / durdur: video oynarken iskelet her karede üstüne çizilir
function togglePlay() {
  if (state.busy || !state.frames.length) return;
  if (!video.paused) { video.pause(); return; }
  if (state.index >= state.frames.length - 1) state.index = 0;
  video.currentTime = state.index / Number($('fps').value);
  video.play();
}

// Oynarken iskeleti videonun o anki karesine eşitler
function syncToVideo() {
  if (state.busy || !state.frames.length) return;
  const i = Math.min(state.frames.length - 1, Math.round(video.currentTime * Number($('fps').value)));
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

// Bir kareyi göster: videoyu o ana al, iskeleti ve işaretleri çiz
async function show(i) {
  if (!video.paused) video.pause();
  state.index = i;
  $('scrub').value = i;
  $('frameLabel').textContent = `${i + 1} / ${state.frames.length}`;
  await seek(Math.min(video.duration - 0.001, i / Number($('fps').value)));
  draw();
}

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];

function drawPose(p, s, main) {
  const kick = $('foot').value === 'right' ? [24, 26, 28, 30, 32] : [23, 25, 27, 29, 31];
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
  const main = state.track ? state.track[state.index] : null;
  // Oyuncu seçilmeden önce herkes aynı çizilir. Seçildikten sonra oyuncu parlak, diğerleri soluk.
  for (const p of state.frames[state.index] || []) drawPose(p, s, state.track ? p === main : true);
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

// --- olaylar ---
$('file').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  if (!f) return;
  Object.assign(state, { contact: null, ball: null, track: null });
  $('report').hidden = true;
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
  try { await processVideo(); } catch (err) { setStatus('Hata: ' + err.message); setBusy(false); }
  updateReady();
});

$('play').addEventListener('click', togglePlay);

$('scrub').addEventListener('input', (e) => show(Number(e.target.value)));
$('prev').addEventListener('click', () => state.index > 0 && show(state.index - 1));
$('next').addEventListener('click', () => state.index < state.frames.length - 1 && show(state.index + 1));
$('foot').addEventListener('change', draw);

// Kamera kurulumu moda göre değişir: şut/pas yandan, frikik arkadan (RESEARCH.md bölüm 3-4)
const SETUP_HINTS = {
  shot: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  pass: 'Çekim: tam yandan, telefon sabit, tüm vücut ve top kadrajda.',
  freekick: 'Çekim: arkadan ya da çapraz arkadan, telefon sabit, oyuncu ve top kadrajda.',
};
$('mode').addEventListener('change', () => { $('setupHint').textContent = SETUP_HINTS[$('mode').value]; });
document.addEventListener('keydown', (e) => {
  if (state.busy || $('stageWrap').hidden) return;
  if (e.key === 'ArrowLeft') $('prev').click();
  if (e.key === 'ArrowRight') $('next').click();
  if (e.key === ' ') { e.preventDefault(); togglePlay(); }
});

$('markContact').addEventListener('click', () => {
  video.pause();
  state.contact = state.index;
  state.ball = null;
  state.track = null;
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
  state.track = buildTrack(state.frames, state.contact, state.ball);
  if (!state.track[state.contact]) setStatus('Temas karesinde kimse bulunamadı. Başka bir kare seç.');
  else setStatus('Oyuncu seçildi: topa en yakın kişi. Başka biri seçildiyse topa tekrar tıkla.');
  draw(); updateReady();
});

$('analyze').addEventListener('click', () => {
  const mode = $('mode').value;
  try {
    // Frikik arkadan kamerayla ölçülür (measureFreeKick), şut/pas yandan (measure)
    const m = mode === 'freekick'
      ? measureFreeKick(state.track, state.contact, state.ball, $('foot').value)
      : measure(state.track, state.contact, state.ball, $('foot').value);
    renderReport(evaluate(m, mode), mode);
  } catch (err) { setStatus(err.message); }
});

const MODE_TITLE = { shot: 'Şut', pass: 'Pas', freekick: 'Frikik' };

function renderReport(res, mode) {
  const el = $('report');
  const band = (s) => (s >= 80 ? '' : s >= 50 ? 'mid' : 'low');
  const p = state.track[state.contact];
  const lowVis = p && [23, 24, 25, 26, 27, 28].some((i) => p[i].v < 0.5);
  el.innerHTML = `
    <h2>${MODE_TITLE[mode] ?? 'Pas'} raporu</h2>
    <div class="score"><span class="big">${res.total}</span><span>/ 100</span></div>
    <div class="coach">${res.verdict}${res.focus.length ? '<br><br><b>Odaklan:</b> ' + res.focus.map((f) => f.tip).join(' ') : ''}</div>
    ${lowVis ? '<p class="warn">Temas karesinde bacak noktalarının bazıları net görünmüyor. Sonuç yanıltıcı olabilir.</p>' : ''}
    ${res.items.map((i) => `
      <div class="metric">
        <span class="name">${i.name} <small>(${i.ref})</small></span>
        <span class="val">${i.score === null ? i.shown : `${i.shown} · ${i.score}`}</span>
        <div class="bar"><i class="${band(i.score ?? 0)}" style="width:${i.score ?? 0}%"></i></div>
        ${i.tip ? `<span class="tip">${i.tip}</span>` : ''}
      </div>`).join('')}
    <p class="hint">Eşikler ilk sürüm, gerçek videolarla ayarlanacak. 2D tek kamera: derinlik ölçülemez.</p>`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth' });
}
