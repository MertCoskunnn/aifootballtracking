// Görme katmanı ("göz"): videodaki her kareden iskeletleri ve topu çıkarır.
// Tarayıcıya ve MediaPipe'a bağlıdır (DOM kullanır). Çıktısı detect.js ve metrics.js'in
// beklediği saf veri biçimidir: { t, people: [[{x,y,v} x33]], balls: [{x,y,w,s}] }
//
// Top neden üç yerde aranıyor? (Mert'in 5 dk'lık videosu, 2026-09-23)
// Uzaktaki gri top tam karede neredeyse hiç bulunamadı (361 karenin 15'i). Aynı kareler
// oyuncunun ayak çevresi kırpılıp büyütülünce top 0.57 güvenle bulundu. Nesne modeli küçük
// nesnelerde zayıf, kırpıp büyütmek topu modelin gözünde büyütüyor.
// Artifact barındırmasında (claude.ai) CSP sadece <script> ile cdn.jsdelivr.net'e izin verir;
// fetch/XHR (bu paketin wasm yükleyicisi dahil) jsdelivr'a bile kapalı. Bu yüzden paket ve
// wasm/ altındaki ikili dosyalar vendor/mediapipe/ içine indirilip buradan yerel import edildi
// (bkz. BASE aşağıda). CDN'den YALNIZCA <script> etiketiyle çekilen TF.js (movenet.js) etkilenmez.
import { PoseLandmarker, ObjectDetector, FilesetResolver } from './vendor/mediapipe/vision_bundle.mjs';
// cp-12-movenet: "ikinci göz". BlazePose kişiyi bulurken yüze dayanıyor; sırtı kameraya dönük
// oyuncuda (arkadan çekilmiş frikik) hiç iskelet çıkmıyor. MoveNet yüze bağımlı değil, aynı kişi
// kutusunda BlazePose başarısız olunca devreye girer (aşağıdaki personBoxes döngüsü). Ağır
// (TF.js/model) iş movenet.js'te, saf 17→33 nokta dönüşümü keypoints.js'te (Node testli) —
// bu dosya sadece ikisini birbirine bağlar.
import * as movenet from './movenet.js?v=40';
import { mapCocoToMediapipe, acceptMoveNetPose } from './keypoints.js?v=40';
// cp-15-kalite-kapisi: "sabit kameralı, net idman videosu" ürün kararı (PRODUCT-PLAN.md). Saf
// hesaplama quality.js'te (Node testli); burada sadece her karenin küçük gri kopyasını üretip
// frame.gray'e koyuyoruz (kamera-sabitliği için) — kimin vuruş olduğunu bilmeyiz, karar
// analysis.js'te (collectKicks).
// cp-16-netlik: ayrıca her karede vuran adayın (top varsa top, yoksa en yakın oyuncu) çevresinde
// GERÇEK çözünürlükte (ölçeksiz) bir kırpıntıdan Laplacian varyansı hesaplayıp frame.sharp'a
// yazıyoruz — 64x36'da oyuncu birkaç piksele indiği için o kapı anlamsızdı (bkz. quality.js başı).
import { rgbaToGray, laplacianVariance, round2, SHRINK_W, SHRINK_H, SHARP_MIN, SHARP_MAX } from './quality.js?v=40';
// cp-17-top-birlesimi: aynı topun birden fazla kırpıntıda bulunup iki kez sayılmasını önleyen
// birleştirme (IoU + merkez-mesafesi, saf fonksiyon, Node testli). Detay: balls.js başı.
import { mergeBallDetections } from './balls.js?v=40';
// Artifact paketi .tflite/.task'ı da (application/octet-stream reddediliyor) base64 '.b64.txt'ye
// çevirip yayınlıyor (bkz. scripts/artifact-paketle.mjs) — modelAssetPath yerine baytları kendimiz
// okuyup modelAssetBuffer ile veriyoruz, hem yerelde hem Artifact'te aynı yol çalışsın diye.
import { loadModelBytes } from './modelLoader.js?v=40';

// import.meta.url tabanlı: sayfa index.html'den de tests/*.html gibi alt dizinden de doğru çözülür.
const BASE = new URL('./vendor/mediapipe/wasm', import.meta.url).href;
const POSE_MODEL = new URL('./models/mediapipe/pose_landmarker_full.task', import.meta.url).href;
const BALL_MODEL = new URL('./models/mediapipe/efficientdet_lite0.tflite', import.meta.url).href;
const CROP = 320; // kırpıntının modele verildiği boyut (piksel)

let models = null;
async function load() {
  if (models) return models;
  // Artifact paketi 64 MB sınırı için vision_wasm_nosimd_* dosyalarını içermiyor (bkz.
  // scripts/artifact-paketle.mjs) — modern telefonlar SIMD destekler. Desteklemeyen bir
  // tarayıcıda MediaPipe'ın kendisi nosimd dosyasını sessizce 404'e düşürüp anlaşılmaz bir hata
  // verirdi; burada önceden kontrol edip anlaşılır bir mesajla durduruyoruz.
  if (!(await FilesetResolver.isSimdSupported())) {
    throw new Error('Bu tarayıcı/cihaz WebAssembly SIMD desteklemiyor. Artifact paketi boyut sınırı '
      + '(64 MB) yüzünden nosimd yedek dosyasını içermiyor — güncel bir tarayıcı/cihaz gerekli.');
  }
  const [fs, poseBytes, ballBytes] = await Promise.all([
    FilesetResolver.forVisionTasks(BASE),
    loadModelBytes(POSE_MODEL),
    loadModelBytes(BALL_MODEL),
  ]);
  // IMAGE modu: kareleri sırayla ama bağımsız işleriz. VIDEO modu kesin artan zaman damgası ister,
  // bu da aynı videoyu ikinci kez işlerken ya da ileri-geri atlarken hata verir.
  // poseOne: kırpılmış tek kişilik görüntüler için. Uzak/kalabalık çekimde (Messi–Liverpool yayını,
  // oyuncular ~120 px) tam kare iskelet modeli hiç kimse bulamadı. Nesne modeli ise insanları kutu
  // olarak buldu. Kutuyu kırpıp büyütünce iskelet çıktı (0 → 3-5 kişi/kare).
  // Aynı nesne modeli hem topu hem insanı arar (tek çağrı). poseBytes iki modelde de (pose/poseOne)
  // aynı Uint8Array — MediaPipe her createFromOptions çağrısında kendi wasm belleğine kopyalıyor.
  const [pose, poseOne, ball] = await Promise.all([
    PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetBuffer: poseBytes, delegate: 'GPU' }, runningMode: 'IMAGE', numPoses: 3 }),
    PoseLandmarker.createFromOptions(fs, { baseOptions: { modelAssetBuffer: poseBytes, delegate: 'GPU' }, runningMode: 'IMAGE', numPoses: 1 }),
    ObjectDetector.createFromOptions(fs, { baseOptions: { modelAssetBuffer: ballBytes, delegate: 'GPU' }, runningMode: 'IMAGE', categoryAllowlist: ['sports ball', 'person'], scoreThreshold: 0.12, maxResults: 25 }),
  ]);
  return (models = { pose, poseOne, ball });
}

const isBall = (d) => d.categories[0].categoryName === 'sports ball';
const PERSON_MIN_SCORE = 0.3;

// İskelet dizisine MediaPipe'ın 3D noktalarını `world` özelliği olarak ekler ({x,y,z} metre, kalça
// merkezli; y aşağı, z kameraya doğru). MoveNet yedeğinde 3D yok, o iskeletlerde `world` olmaz.
function withWorld(p, world) {
  if (world && world.length === 33) p.world = world.map((q) => ({ x: q.x, y: q.y, z: q.z }));
  return p;
}
const MAX_PERSON_CROPS = 8;
const MOVENET_INPUT = 256; // MoveNet Thunder'ın beklediği girdi boyutu (piksel), CROP'tan (320) farklı

// --- MoveNet yedek yolu: durum, açma/kapama, istatistikler (cp-12-movenet) ---
let moveNetEnabled = true; // varsayılan açık (GECE-PLANI)
let moveNetModel = null;
let moveNetLoadPromise = null;
let moveNetFailed = false; // TF.js/model bir kez yüklenemezse kalıcı kapanır, tarama çökmesin
const visionStats = { moveNetCalls: 0, moveNetAccepted: 0, loadMs: 0 };

/** Regresyon sayfası (?movenet=0) ve ileride app.js için A/B anahtarı. */
export function setMoveNetEnabled(v) { moveNetEnabled = !!v; }

/** { moveNetCalls, moveNetAccepted, loadMs } — regresyon sayfası gösterebilsin diye. */
export function getVisionStats() { return { ...visionStats }; }

// TF.js + modeli bir kez yükler (sonraki çağrılar aynı sözü paylaşır). Hata olursa MoveNet'i
// kalıcı kapatır ve bir kez uyarır — tarama bu yüzden asla çökmemeli.
async function ensureMoveNetModel() {
  if (moveNetModel) return moveNetModel;
  if (moveNetFailed) return null;
  if (!moveNetLoadPromise) {
    const started = performance.now();
    moveNetLoadPromise = movenet.loadMoveNetModel()
      .then((m) => { visionStats.loadMs = performance.now() - started; return m; })
      .catch((err) => {
        console.warn('MoveNet yüklenemedi, bu oturumda kalıcı olarak kapatıldı:', err);
        moveNetFailed = true;
        return null;
      });
  }
  moveNetModel = await moveNetLoadPromise;
  return moveNetModel;
}

// BlazePose'un (poseOne) iskelet bulamadığı kişi kutusunu MoveNet'e verir. canvas256: aynı
// kırpıntı bölgesinin 256x256'ya çizilmiş hali. x0,y0,s: kırpıntının tam karedeki yeri/boyu
// (mapCocoToMediapipe için). Dönen: MediaPipe-33 iskeleti (p.src='movenet' işaretli) ya da null.
async function tryMoveNet(canvas256, x0, y0, s) {
  const model = await ensureMoveNetModel();
  if (!model) return null;
  visionStats.moveNetCalls++;
  let coco;
  try {
    coco = movenet.detect(model, canvas256);
  } catch (err) {
    console.warn('MoveNet çalıştırılırken hata, bu oturumda kalıcı olarak kapatıldı:', err);
    moveNetFailed = true;
    return null;
  }
  if (!acceptMoveNetPose(coco)) return null; // bacak güveni düşük: muhtemelen insan değil
  visionStats.moveNetAccepted++;
  const p = mapCocoToMediapipe(coco, x0, y0, s);
  p.src = 'movenet'; // dizi özelliği: app.js drawPose'da farklı renk için (BlazePose'ta yok)
  return p;
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
  const { pose, poseOne, ball } = await load();
  const W = video.videoWidth, H = video.videoHeight;
  // Kareyi önce bir tuvale çizeriz: hem iskelet hem top aynı kareden okunur,
  // hem de kırpıntılar bu tuvalden kesilir.
  const frameCv = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const fctx = frameCv.getContext('2d');
  const cropCv = Object.assign(document.createElement('canvas'), { width: CROP, height: CROP });
  const cctx = cropCv.getContext('2d');
  // MoveNet'in kendi girdi boyutu (256) CROP'tan (320) farklı olduğu için ayrı bir tuval: cropCv'yi
  // burada yeniden boyutlandırmak onu temizleyip ball-tarama döngüsündeki kullanımını bozardı.
  const mnCv = Object.assign(document.createElement('canvas'), { width: MOVENET_INPUT, height: MOVENET_INPUT });
  const mnCtx = mnCv.getContext('2d');
  // cp-15-kalite-kapisi: kalite kapıları (kamera sabitliği/netlik) için küçük gri kopya. Tuval
  // döngü DIŞINDA tek kez oluşturulur (frameCv/cropCv/mnCv ile aynı desen). clearRect gerekmez:
  // her karede drawImage tuvalin TAMAMINI (0,0→SHRINK_W,SHRINK_H) baştan yazıyor. Sadece bir
  // drawImage+getImageData eklendi, tarama hızını modellerin yanında belirgin etkilemez.
  const qualityCv = Object.assign(document.createElement('canvas'), { width: SHRINK_W, height: SHRINK_H });
  const qctx = qualityCv.getContext('2d', { willReadFrequently: true });
  const total = Math.max(1, Math.floor((t1 - t0) * fps));
  const frames = [];
  let lastBall = null;
  for (let i = 0; i < total; i++) {
    if (shouldStop?.()) break;
    const t = t0 + i / fps;
    await seek(video, Math.min(video.duration - 0.001, t));
    fctx.drawImage(video, 0, 0, W, H);
    // 2026-09-24 gece: MediaPipe'ın 3D (world) noktaları da saklanıyor: kalça merkezli, metre
    // cinsinden tahmin. Eklem açısı 3D'den hesaplanınca kamera açısından (yandan/arkadan) büyük
    // ölçüde bağımsız olur (metrics3d.js). 2D veri sözleşmesi değişmez: 3D, dizinin `world` özelliği.
    const res = pose.detect(frameCv);
    const people = res.landmarks.map((p, k) => withWorld(p.map((q) => ({ x: q.x * W, y: q.y * H, v: q.visibility ?? 1 })), res.worldLandmarks?.[k]));
    const dets = ball.detect(frameCv).detections;
    const balls = dets.filter(isBall).map((d) => box(d, 0, 0, 1));
    // İki aşamalı iskelet: nesne modelinin bulduğu ama iskeleti henüz çıkmamış her kişi kutusunu
    // kırpıp büyüt, tek kişilik iskelet modeline ver, noktaları tam kareye geri çevir.
    // Güvene göre sırala, boya göre değil: Liverpool yayınında Messi baraja yakın ve arkada kaldığı
    // için boyca 9.-10. sıradaydı ve hiç işlenmiyordu. Oysa en yüksek güvenli kutulardan biriydi (0.67).
    const personBoxes = dets
      .filter((d) => !isBall(d) && d.categories[0].score >= PERSON_MIN_SCORE && d.boundingBox.height >= 40)
      .sort((a, b) => b.categories[0].score - a.categories[0].score)
      .map((d) => d.boundingBox)
      .slice(0, MAX_PERSON_CROPS);
    // MoveNet sadece topa yakın kutularda çalışır. İlk denemede (2026-09-24) yandan çekilmiş Messi
    // videosunda bile 31 kez devreye girdi (arkadaki insanlar) ve taramayı %57 yavaşlattı, puan
    // değişmediği halde. Vuruşu yapan kişi her zaman topun yanındadır; uzaktakinin iskeleti analize
    // girmez. Karede hiç top bilinmiyorsa (top henüz bulunamadı) en güvenli tek kutuya izin verilir.
    const ballRefs = lastBall ? [...balls, lastBall] : balls;
    let mnBudget = ballRefs.length ? MAX_PERSON_CROPS : 1;
    for (const b of personBoxes) {
      const covered = people.some((p) => inBox(hipMid(p), b));
      if (covered) continue;
      const s = Math.max(b.width, b.height) * 1.3, x0 = b.originX + b.width / 2 - s / 2, y0 = b.originY + b.height / 2 - s / 2;
      cctx.clearRect(0, 0, CROP, CROP);
      cctx.drawImage(frameCv, x0, y0, s, s, 0, 0, CROP, CROP);
      const one = poseOne.detect(cropCv);
      const found = one.landmarks[0];
      if (found) {
        // 3D (world) noktalar kırpıntıdan bağımsız: kalça merkezli metre, ölçek/konum dönüşümü gerekmez.
        people.push(withWorld(found.map((q) => ({ x: x0 + q.x * s, y: y0 + q.y * s, v: q.visibility ?? 1 })), one.worldLandmarks?.[0]));
      } else if (moveNetEnabled && !moveNetFailed && mnBudget > 0 && nearBall(b, ballRefs)) {
        mnBudget--;
        // Yedek yol: BlazePose bu kutuda kimseyi bulamadı (sırtı kameraya dönük olabilir).
        // AYNI kırpıntı bölgesini (x0,y0,s) MoveNet'e veriyoruz, başka hiçbir yerde çalışmıyor.
        mnCtx.clearRect(0, 0, MOVENET_INPUT, MOVENET_INPUT);
        mnCtx.drawImage(frameCv, x0, y0, s, s, 0, 0, MOVENET_INPUT, MOVENET_INPUT);
        const mnPerson = await tryMoveNet(mnCv, x0, y0, s);
        if (mnPerson) people.push(mnPerson);
      }
    }
    // Top kırpıntıları: her kişinin ayak çevresi + topun son bilinen yeri
    const regions = people.map(feetRegion);
    if (lastBall) regions.push({ x: lastBall.x, y: lastBall.y, s: Math.max(160, lastBall.w * 8) });
    for (const r of regions) {
      cctx.clearRect(0, 0, CROP, CROP);
      cctx.drawImage(frameCv, r.x - r.s / 2, r.y - r.s / 2, r.s, r.s, 0, 0, CROP, CROP);
      for (const d of ball.detect(cropCv).detections.filter(isBall)) balls.push(box(d, r.x - r.s / 2, r.y - r.s / 2, r.s / CROP));
    }
    const merged = dedupe(balls);
    const bestNear = merged.sort((a, b) => b.s - a.s)[0];
    if (bestNear) lastBall = bestNear;
    // cp-15-kalite-kapisi: küçük gri kopya + orijinal karadan bu kopyaya ölçek oranı (sx,sy) —
    // quality.js kutuları (oyuncu/top) bu oranla küçültülmüş uzaya çevirir (bkz. assessKickQuality).
    // SADECE kamera-sabitliği için (cp-16'dan itibaren netlik başka yoldan, bkz. aşağı).
    qctx.drawImage(frameCv, 0, 0, W, H, 0, 0, SHRINK_W, SHRINK_H);
    const gray = rgbaToGray(qctx.getImageData(0, 0, SHRINK_W, SHRINK_H).data, SHRINK_W, SHRINK_H);
    // cp-16-netlik: vuran adayın (top biliniyorsa top, yoksa ilk oyuncunun ayak çevresi) etrafında
    // SHARP_MIN..SHARP_MAX px'lik kaynak bölgeyi cropCv'ye (pose/top taramasında zaten var, 320x320)
    // ÖLÇEKSİZ (1:1, kaynak boyutu = hedef boyutu) çiziyoruz ki Laplacian gerçek pikselden gelsin —
    // yeniden boyutlandırma (scale) kendi bulanıklığını katmasın. Ne top ne oyuncu varsa null:
    // context.js'teki "ölçülemedi" deseniyle aynı, tarama çökmez, quality.js kapıyı engellemez.
    const sharpFocus = bestNear
      ? { x: bestNear.x, y: bestNear.y, s: clamp(bestNear.w * 8, SHARP_MIN, SHARP_MAX) }
      : lastBall
        ? { x: lastBall.x, y: lastBall.y, s: clamp(lastBall.w * 8, SHARP_MIN, SHARP_MAX) }
        : people[0]
          ? { ...feetRegion(people[0]), s: clamp(feetRegion(people[0]).s, SHARP_MIN, SHARP_MAX) }
          : null;
    let sharp = null;
    if (sharpFocus) {
      const sz = Math.round(sharpFocus.s);
      cctx.clearRect(0, 0, CROP, CROP);
      cctx.drawImage(frameCv, sharpFocus.x - sz / 2, sharpFocus.y - sz / 2, sz, sz, 0, 0, sz, sz);
      const sharpGray = rgbaToGray(cctx.getImageData(0, 0, sz, sz).data, sz, sz);
      sharp = round2(laplacianVariance(sharpGray, sz, sz));
    }
    const frame = {
      t, people, balls: merged, sharp,
      gray: { data: gray, w: SHRINK_W, h: SHRINK_H, sx: SHRINK_W / W, sy: SHRINK_H / H },
    };
    frames.push(frame);
    onFrame?.(frame, i, total);
  }
  return frames;
}

// Kişi kutusu topa yakın mı? Kutu yatayda 1.5 boy, dikeyde yarım boy genişletilir: koşu sırasında
// oyuncu topa birkaç adım uzakta olabilir. Bilinen top yoksa true (karar bütçeye kalır).
function nearBall(b, refs) {
  if (!refs.length) return true;
  const padX = 1.5 * b.height, padY = 0.5 * b.height;
  return refs.some((r) => r.x >= b.originX - padX && r.x <= b.originX + b.width + padX
    && r.y >= b.originY - padY && r.y <= b.originY + b.height + padY);
}

// cp-16-netlik: kaynak bölge boyutunu [min,max] aralığına sıkıştırır (bkz. sharpFocus yukarıda).
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

const hipMid = (p) => ({ x: (p[23].x + p[24].x) / 2, y: (p[23].y + p[24].y) / 2 });
const inBox = (pt, b) => pt.x >= b.originX && pt.x <= b.originX + b.width && pt.y >= b.originY && pt.y <= b.originY + b.height;

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

// cp-17-top-birlesimi: aynı top birden fazla kırpıntıda bulunabilir (tam kare + her oyuncunun
// ayak çevresi + son bilinen top konumu, bkz. yukarıdaki döngü) — merkez-mesafesi TEK BAŞINA
// kırpıntı kenarında küçülmüş/kaymış tespitleri kaçırabiliyordu (Mert'in raporu: aynı topa 2
// çember). IoU + merkez-mesafesi birlikte bakan saf mantık artık balls.js'te (Node testli,
// tests/balls.test.mjs) — burada sadece çağrılıyor.
const dedupe = mergeBallDetections;
