// Görme katmanı ("göz"): videodaki her kareden iskeletleri ve topu çıkarır.
// Tarayıcıya ve MediaPipe'a bağlıdır (DOM kullanır). Çıktısı detect.js ve metrics.js'in
// beklediği saf veri biçimidir: { t, people: [[{x,y,v} x33]], balls: [{x,y,w,s}] }
//
// Top neden üç yerde aranıyor? (Mert'in 5 dk'lık videosu, 2026-09-23)
// Uzaktaki gri top tam karede neredeyse hiç bulunamadı (361 karenin 15'i). Aynı kareler
// oyuncunun ayak çevresi kırpılıp büyütülünce top 0.57 güvenle bulundu. Nesne modeli küçük
// nesnelerde zayıf, kırpıp büyütmek topu modelin gözünde büyütüyor.
import { PoseLandmarker, ObjectDetector, FilesetResolver } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs';

const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const POSE_MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task';
const BALL_MODEL = 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite';
const CROP = 320; // kırpıntının modele verildiği boyut (piksel)

let models = null;
async function load() {
  if (models) return models;
  const fs = await FilesetResolver.forVisionTasks(BASE);
  // IMAGE modu: kareleri sırayla ama bağımsız işleriz. VIDEO modu kesin artan zaman damgası ister,
  // bu da aynı videoyu ikinci kez işlerken ya da ileri-geri atlarken hata verir.
  const [pose, ball] = await Promise.all([
    PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetPath: POSE_MODEL, delegate: 'GPU' }, runningMode: 'IMAGE', numPoses: 3 }),
    ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetPath: BALL_MODEL, delegate: 'GPU' }, runningMode: 'IMAGE', categoryAllowlist: ['sports ball'], scoreThreshold: 0.12, maxResults: 3 }),
  ]);
  return (models = { pose, ball });
}

function seek(video, t) {
  return new Promise((res) => {
    if (Math.abs(video.currentTime - t) < 1e-4 && video.readyState >= 2) return res();
    const done = () => { clearTimeout(timer); res(); };
    const timer = setTimeout(() => { video.removeEventListener('seeked', done); res(); }, 2000);
    video.addEventListener('seeked', done, { once: true });
    video.currentTime = t;
  });
}

/**
 * Videonun [t0, t1) aralığını fps hızında işler.
 * onFrame(frame, i, total): her kare sonrası çağrılır (ilerleme ve canlı çizim için).
 * shouldStop(): true dönerse işlem durur (kullanıcı iptal etti).
 * Dönen: kare listesi.
 */
export async function processRange(video, { t0 = 0, t1 = video.duration, fps = 30, onFrame, shouldStop } = {}) {
  const { pose, ball } = await load();
  const W = video.videoWidth, H = video.videoHeight;
  // Kareyi önce bir tuvale çizeriz: hem iskelet hem top aynı kareden okunur,
  // hem de kırpıntılar bu tuvalden kesilir.
  const frameCv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const fctx = frameCv.getContext('2d');
  const cropCv = Object.assign(document.createElement('canvas'), { width: CROP, height: CROP });
  const cctx = cropCv.getContext('2d');
  const total = Math.max(1, Math.floor((t1 - t0) * fps));
  const frames = [];
  let lastBall = null;
  for (let i = 0; i < total; i++) {
    if (shouldStop?.()) break;
    const t = t0 + i / fps;
    await seek(video, Math.min(video.duration - 0.001, t));
    fctx.drawImage(video, 0, 0, W, H);
    const people = pose.detect(frameCv).landmarks.map((p) => p.map((q) => ({ x: q.x * W, y: q.y * H, v: q.visibility ?? 1 })));
    const balls = ball.detect(frameCv).detections.map((d) => box(d, 0, 0, 1));
    // Kırpıntılar: her kişinin ayak çevresi + topun son bilinen yeri
    const regions = people.map(feetRegion);
    if (lastBall) regions.push({ x: lastBall.x, y: lastBall.y, s: Math.max(160, lastBall.w * 8) });
    for (const r of regions) {
      cctx.clearRect(0, 0, CROP, CROP);
      cctx.drawImage(frameCv, r.x - r.s / 2, r.y - r.s / 2, r.s, r.s, 0, 0, CROP, CROP);
      for (const d of ball.detect(cropCv).detections) balls.push(box(d, r.x - r.s / 2, r.y - r.s / 2, r.s / CROP));
    }
    const merged = dedupe(balls);
    const bestNear = merged.sort((a, b) => b.s - a.s)[0];
    if (bestNear) lastBall = bestNear;
    const frame = { t, people, balls: merged };
    frames.push(frame);
    onFrame?.(frame, i, total);
  }
  return frames;
}

// Kişinin ayak çevresi: iki ayak bileğinin ortası, kenar = 2.5 bacak boyu (en az 160 px)
function feetRegion(p) {
  const leg = Math.hypot(p[23].x - p[27].x, p[23].y - p[27].y) || 100;
  return { x: (p[27].x + p[28].x) / 2, y: (p[27].y + p[28].y) / 2, s: Math.max(160, 2.5 * leg) };
}

// Model çıktısını (kırpıntı koordinatı) tam kare koordinatına çevirir
function box(d, ox, oy, k) {
  const b = d.boundingBox;
  return { x: ox + (b.originX + b.width / 2) * k, y: oy + (b.originY + b.height / 2) * k, w: b.width * k, s: d.categories[0].score };
}

// Aynı top birden fazla kırpıntıda bulunabilir: merkezleri yarım çaptan yakın olanları tek sayar
function dedupe(balls) {
  const out = [];
  for (const b of balls.sort((a, c) => c.s - a.s)) {
    if (!out.some((o) => Math.hypot(o.x - b.x, o.y - b.y) < 0.5 * Math.max(o.w, b.w))) out.push(b);
  }
  return out;
}
