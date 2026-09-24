// MoveNet Thunder yükleyici + çalıştırıcı (cp-12-movenet). vision.js'in "ikinci göz"ü: BlazePose
// bir kişi kutusunda iskelet bulamazsa (ör. sırtı kameraya dönük oyuncu — BlazePose yüze bağımlı),
// AYNI kırpıntı bu dosyaya verilir. Sadece burada, sadece bu yedek yolda çalışır (GECE-PLANI).
//
// Bu dosya saf DEĞİL: tarayıcıya (window, <script> enjeksiyonu) ve TF.js'e bağlı, Node'da
// çalışmaz/test edilmez. COCO→MediaPipe dönüşümü gibi saf kısımlar keypoints.js'te (Node testli).
//
// Tembel yükleme: TF.js (~1.3 MB) ve model (~12.5 MB) sadece MoveNet gerçekten gerekince iner.
// Yandan çekimlerde BlazePose zaten herkesi buluyor, bu yol hiç tetiklenmez.
// Artifact paketi .bin shard'larını da (application/octet-stream reddediliyor) base64 '.b64.txt'ye
// çevirip yayınlıyor (bkz. scripts/artifact-paketle.mjs). tf.loadGraphModel bunu bilmiyor (doğrudan
// .bin fetch eder), o yüzden model.json + shard'ları kendimiz loadModelBytes ile okuyup
// tf.io.fromMemory'e veriyoruz — yerelde de (ham .bin dosyaları duruyor) aynı yol çalışır.
import { loadModelBytes, concatBytes } from './modelLoader.js?v=41';

const TFJS_URL = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.22.0/dist/tf.min.js';
const MODEL_URL = new URL('./models/movenet-thunder/model.json', import.meta.url);

let tfLoadingPromise = null;

// TF.js UMD paketini bir <script> etiketiyle enjekte eder (global `tf` oluşur). ES modülü olarak
// import ETMİYORUZ: CDN'deki paket UMD, ve global tf'yi böyle projede zaten kullanılan CDN
// enjeksiyon deseniyle (bkz. vision.js'teki MediaPipe importu) tutarlı tutmak yerine burada
// doğrudan script enjeksiyonu en basit yol (GECE-PLANI'nda böyle belirtildi).
function loadTfjsScript() {
  if (window.tf) return Promise.resolve(window.tf);
  if (tfLoadingPromise) return tfLoadingPromise;
  tfLoadingPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TFJS_URL;
    script.onload = () => resolve(window.tf);
    script.onerror = () => reject(new Error('TF.js yüklenemedi (CDN erişilemedi?)'));
    document.head.appendChild(script);
  });
  return tfLoadingPromise;
}

/**
 * TF.js'i ve MoveNet Thunder modelini yükler. İlk çağrıda TF.js script'ini enjekte eder,
 * backend'i webgl yapmayı dener (olmazsa tf'nin kendi varsayılanında kalır), sonra yerel
 * model.json'u yükler. Hata olursa fırlatır — çağıran taraf (vision.js) yakalayıp MoveNet'i
 * kalıcı kapatmalı (tarama bu yüzden çökmemeli).
 */
export async function loadMoveNetModel() {
  const tf = await loadTfjsScript();
  // TF.js, WebGL'i varsayılan olarak "yazılımla çalışan GPU'da açma" şartıyla ister
  // (failIfMajorPerformanceCaveat). GPU'su yazılımla taklit edilen tarayıcılarda (test paneli,
  // bazı dizüstüler) bu şart WebGL'i reddettirip TF.js'i çok yavaş CPU'ya düşürüyordu.
  // MediaPipe aynı sayfada WebGL'i sorunsuz kullanıyor; yazılım WebGL yine de CPU'dan hızlı.
  tf.env().set('SOFTWARE_WEBGL_ENABLED', true);
  try { await tf.setBackend('webgl'); } catch { /* webgl yoksa tf'nin varsayılan backend'inde devam */ }
  await tf.ready();
  return loadGraphModelFromShards(tf);
}

// tf.loadGraphModel(url) kendi içinde .bin shard'larını DOĞRUDAN fetch eder — Artifact paketinde
// bunlar yok (yalnızca '<ad>.bin.b64.txt' var, bkz. dosya başı). Onun yerine model.json'u ve
// shard'ları loadModelBytes ile (ham .bin yerelde, .b64.txt Artifact'te) kendimiz okuyup
// tf.io.fromMemory'e tek parça weightData olarak veriyoruz — ağırlık baytları shard sınırlarından
// bağımsız sıralı bir akış olduğu için (shard'lara bölünme sadece dosya boyutu sınırı), tüm
// shard'ları sırayla birleştirmek orijinal tf.loadGraphModel ile aynı sonucu üretir.
async function loadGraphModelFromShards(tf) {
  const modelJsonBytes = await loadModelBytes(MODEL_URL.href);
  const { modelTopology, weightsManifest } = JSON.parse(new TextDecoder().decode(modelJsonBytes));

  const weightSpecs = [];
  const chunks = [];
  for (const group of weightsManifest) {
    weightSpecs.push(...group.weights);
    for (const shardPath of group.paths) {
      const shardUrl = new URL(shardPath, MODEL_URL).href;
      chunks.push(await loadModelBytes(shardUrl));
    }
  }
  const weightData = concatBytes(chunks).buffer;
  return tf.loadGraphModel(tf.io.fromMemory({ modelTopology, weightSpecs, weightData }));
}

/**
 * 256x256'lık bir tuval (zaten kişi kutusundan kırpılmış) üzerinde MoveNet Thunder çalıştırır.
 * Girdi: int32 [1,256,256,3] (0-255 piksel). Çıktı: [1,1,17,3] = (y, x, skor), hepsi 0-1
 * normalize (kırpıntıya göre). Tensörler tf.tidy ile temizlenir, çıktı da dispose edilir —
 * her karede yeni kutu(lar) için çağrıldığından bellek sızarsa tarayıcı uzun videoda çöker.
 * Dönen: 17 elemanlı [{x,y,score}] dizisi, COCO-17 sırasıyla (keypoints.js bu sırayı bekler).
 */
export function detect(model, canvas256) {
  const tf = window.tf;
  const output = tf.tidy(() => {
    const img = tf.browser.fromPixels(canvas256).toInt().expandDims(0);
    return model.execute(img);
  });
  const data = output.dataSync(); // düz dizi: y0,x0,skor0, y1,x1,skor1, ... (17 nokta)
  output.dispose();
  const points = new Array(17);
  for (let i = 0; i < 17; i++) {
    points[i] = { y: data[i * 3], x: data[i * 3 + 1], score: data[i * 3 + 2] };
  }
  return points;
}
