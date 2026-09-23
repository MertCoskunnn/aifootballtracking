// Uygulama katmanı: video → iskelet (MediaPipe) → ölçüm → hoca.
import { PoseLandmarker, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';
import { measure } from './metrics.js';
import { evaluate } from './coach.js';

const WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';

const $ = (id) => document.getElementById(id);
const video = $('video');
const canvas = $('canvas');
const ctx = canvas.getContext('2d');

const state = { frames: [], index: 0, contact: null, ball: null, busy: false };
let landmarker = null;

async function getLandmarker() {
  if (landmarker) return landmarker;
  setStatus('Model yükleniyor (ilk seferde birkaç saniye)…');
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  landmarker = await PoseLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
  });
  return landmarker;
}

function setStatus(t) { $('status').textContent = t; }

function seek(t) {
  return new Promise((res) => {
    video.addEventListener('seeked', res, { once: true });
    video.currentTime = t;
  });
}

// Videoyu kare kare gezip her karenin iskeletini bir kez çıkarır ve saklar.
// Sonra kaydırıcı sadece saklanan sonuçları çizer, her şey anında olur.
async function processVideo() {
  state.busy = true;
  const lm = await getLandmarker();
  const fps = Number($('fps').value);
  const total = Math.max(1, Math.floor(video.duration * fps));
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  state.frames = [];
  let found = 0;
  for (let i = 0; i < total; i++) {
    await seek(Math.min(video.duration - 0.001, i / fps));
    const r = lm.detectForVideo(video, Math.round((i * 1000) / fps) + 1);
    const pts = r.landmarks[0]
      ? r.landmarks[0].map((p) => ({ x: p.x * canvas.width, y: p.y * canvas.height, v: p.visibility ?? 1 }))
      : null;
    if (pts) found++;
    state.frames.push(pts);
    if (i % 5 === 0) setStatus(`İskelet çıkarılıyor: ${i + 1} / ${total} kare`);
  }
  $('scrub').max = total - 1;
  state.busy = false;
  const ratio = found / total;
  setStatus(ratio < 0.6
    ? `Dikkat: karelerin sadece %${Math.round(ratio * 100)}'ünde iskelet bulundu. Tüm vücut kadrajda mı?`
    : `Hazır: ${total} kare, %${Math.round(ratio * 100)}'ünde iskelet bulundu. Temas karesini bul.`);
  show(0);
}

// Bir kareyi göster: videoyu o ana al, iskeleti ve işaretleri çiz
async function show(i) {
  state.index = i;
  $('scrub').value = i;
  $('frameLabel').textContent = `${i + 1} / ${state.frames.length}`;
  await seek(Math.min(video.duration - 0.001, i / Number($('fps').value)));
  draw();
}

const BONES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24],
  [23, 25], [25, 27], [27, 29], [29, 31], [27, 31], [24, 26], [26, 28], [28, 30], [30, 32], [28, 32]];

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const p = state.frames[state.index];
  const s = canvas.width / 400; // çizgi kalınlığı videonun boyutuna göre
  if (p) {
    const kick = $('foot').value === 'right' ? [24, 26, 28, 30, 32] : [23, 25, 27, 29, 31];
    ctx.lineWidth = 3 * s;
    for (const [a, b] of BONES) {
      ctx.strokeStyle = kick.includes(a) && kick.includes(b) ? '#ffb547' : '#3ddc84';
      ctx.beginPath(); ctx.moveTo(p[a].x, p[a].y); ctx.lineTo(p[b].x, p[b].y); ctx.stroke();
    }
    ctx.fillStyle = '#ffffff';
    for (const i of [11, 12, 23, 24, 25, 26, 27, 28, 31, 32]) {
      ctx.beginPath(); ctx.arc(p[i].x, p[i].y, 3 * s, 0, Math.PI * 2); ctx.fill();
    }
  }
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
  Object.assign(state, { contact: null, ball: null });
  $('report').hidden = true;
  $('stageWrap').hidden = false;
  video.src = URL.createObjectURL(f);
  await new Promise((r) => video.addEventListener('loadeddata', r, { once: true }));
  try { await processVideo(); } catch (err) { setStatus('Hata: ' + err.message); state.busy = false; }
  updateReady();
});

$('scrub').addEventListener('input', (e) => show(Number(e.target.value)));
$('prev').addEventListener('click', () => state.index > 0 && show(state.index - 1));
$('next').addEventListener('click', () => state.index < state.frames.length - 1 && show(state.index + 1));
$('foot').addEventListener('change', draw);
document.addEventListener('keydown', (e) => {
  if (state.busy || $('stageWrap').hidden) return;
  if (e.key === 'ArrowLeft') $('prev').click();
  if (e.key === 'ArrowRight') $('next').click();
});

$('markContact').addEventListener('click', () => {
  state.contact = state.index;
  state.ball = null;
  setStatus(`Temas karesi: ${state.index + 1}. Şimdi topun üstüne tıkla.`);
  draw(); updateReady();
});

canvas.addEventListener('click', (e) => {
  if (state.contact === null) { setStatus('Önce temas karesini işaretle.'); return; }
  if (state.index !== state.contact) show(state.contact);
  const r = canvas.getBoundingClientRect();
  state.ball = {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
  draw(); updateReady();
});

$('analyze').addEventListener('click', () => {
  const mode = $('mode').value;
  try {
    const m = measure(state.frames, state.contact, state.ball, $('foot').value);
    renderReport(evaluate(m, mode), mode);
  } catch (err) { setStatus(err.message); }
});

function renderReport(res, mode) {
  const el = $('report');
  const band = (s) => (s >= 80 ? '' : s >= 50 ? 'mid' : 'low');
  const p = state.frames[state.contact];
  const lowVis = p && [23, 24, 25, 26, 27, 28].some((i) => p[i].v < 0.5);
  el.innerHTML = `
    <h2>${mode === 'shot' ? 'Şut' : 'Pas'} raporu</h2>
    <div class="score"><span class="big">${res.total}</span><span>/ 100</span></div>
    <div class="coach">${res.verdict}${res.focus.length ? '<br><br><b>Odaklan:</b> ' + res.focus.map((f) => f.tip).join(' ') : ''}</div>
    ${lowVis ? '<p class="warn">Temas karesinde bacak noktalarının bazıları net görünmüyor. Sonuç yanıltıcı olabilir.</p>' : ''}
    ${res.items.map((i) => `
      <div class="metric">
        <span class="name">${i.name} <small>(${i.ref})</small></span>
        <span class="val">${i.shown} · ${i.score}</span>
        <div class="bar"><i class="${band(i.score)}" style="width:${i.score}%"></i></div>
        ${i.tip ? `<span class="tip">${i.tip}</span>` : ''}
      </div>`).join('')}
    <p class="hint">Eşikler ilk sürüm, gerçek videolarla ayarlanacak. 2D tek kamera: derinlik ölçülemez.</p>`;
  el.hidden = false;
  el.scrollIntoView({ behavior: 'smooth' });
}
