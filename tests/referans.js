// Referans klip toplu analiz (cp-14-referans-toplu): regresyon.js'in kalıbını izler (aynı
// pipeline.js'i, blob URL ile video yükleme yöntemini kullanır) ama PASS/FAIL kontrolü DEĞİL,
// ham ölçüm toplama aracıdır. 18 gece indirilen referans klipte (KAYNAKLAR.md) uygulamanın
// GERÇEK akışını (pipeline.scanVideo: kısa video tek geçiş, uzun video kaba+yoğun) çalıştırır,
// her bulunan vuruşu üç modda (shot/placement/freekick) ayrı ayrı analiz eder. Frodo bu ham
// verilerle coach.js'teki eşikleri kalibre edecek (hedef kullanıcı: sahada tek başına idman
// yapan oyuncu) — bu yüzden burada hiçbir "beklenen" değerle karşılaştırma yapılmaz.
import * as pipeline from '../pipeline.js?v=23';

const params = new URLSearchParams(location.search);
const AUTO = params.get('auto') === '1';
// Tek klip üstünde denemek/hata ayıklamak için: dosya adının bir parçasıyla filtrele.
const ONLY = params.get('only') || null;
// İlk N klip: uzun sürebilecek tam taramayı kısaltıp hızlı bir duman testi yapmak için.
const MAX = params.get('max') ? parseInt(params.get('max'), 10) : null;

// Klip başına zaman aşımı: bir klip takılırsa (ör. çok uzun replay içeren video) sayfa sonsuza
// kadar beklemesin, o klibi "zaman aşımı" diye işaretleyip sıradakine geçsin.
const CLIP_TIMEOUT_MS = 25 * 60 * 1000; // kalabalık yayın kliplerinde kare ~1.3 sn; 73 sn klip 8 dk'ya sığmadı

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const tbody = document.querySelector('#results tbody');
const summaryEl = document.getElementById('summary');
const runBtn = document.getElementById('runBtn');

// Frodo (ya da başka bir otomasyon) sonucu tarayıcıdan okuyabilsin diye: makine okunur çıktı.
// Kasıtlı olarak iskelet kareleri (kick.frames) İÇİNDE DEĞİL — sadece sayılar/özetler, sonuç
// çok büyük olmasın diye.
window.__referans = { done: false, results: [], startedAt: null, finishedAt: null };

function setStatus(t) { statusEl.textContent = t; }

function fmtNum(n, d = 2) { return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—'; }

// Video sunucusu (python http.server) Range desteklemiyor: doğrudan URL'de ileri sarma çalışmıyor,
// bu yüzden dosyayı önce blob olarak indirip URL.createObjectURL ile veriyoruz (regresyon.js'teki
// GECE-PLANI notuyla aynı gerekçe).
function fetchVideoBlob(filename) {
  return fetch('../test-videolar/referans/' + encodeURIComponent(filename)).then((r) => {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.blob();
  });
}

function loadIntoVideo(blob) {
  return new Promise((resolve, reject) => {
    const onLoaded = () => { video.removeEventListener('error', onErr); resolve(); };
    const onErr = () => { video.removeEventListener('loadeddata', onLoaded); reject(new Error('video açılamadı')); };
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onErr, { once: true });
    video.src = URL.createObjectURL(blob);
  });
}

// Taranırken o anki karedeki iskeletleri küçük noktalarla gösterir (canlı geri bildirim,
// regresyon.js'teki drawFrame ile aynı — burada doğruluk değil "bir şey oluyor" göstermek yeterli).
function drawFrame(frame) {
  canvas.width = video.videoWidth || canvas.width;
  canvas.height = video.videoHeight || canvas.height;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#3ddc84';
  for (const p of frame.people || []) {
    for (const i of [23, 24, 25, 26, 27, 28, 31, 32]) {
      if (!p[i]) continue;
      ctx.beginPath(); ctx.arc(p[i].x, p[i].y, 3, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// Bir vuruşu tek modda analiz eder, hata fırlatırsa (ör. temas karesinde iskelet yok, "Hiçbir
// ölçüm yapılamadı" — coach.js#evaluate) o modu {error} olarak döner, diğer modları etkilemez.
function tryAnalyze(kick, mode) {
  try {
    const a = pipeline.analyzeKick(kick, { mode, foot: 'auto' });
    const m = a.measurements;
    return {
      total: a.result.total,
      items: a.result.items.map((i) => ({ ref: i.ref, value: Number.isFinite(i.value) ? i.value : null, score: i.score })),
      phasesTimes: m.phases ? m.phases.times : null,
      supportKneeAtPlant: Number.isFinite(m.supportKneeAtPlant) ? m.supportKneeAtPlant : null,
      // sadece placement (measure()) çıktısında var; freekick'te (measureFreeKick()) yok → null.
      kneeAngVelRatio: Number.isFinite(m.kneeAngVelRatio) ? m.kneeAngVelRatio : null,
    };
  } catch (err) {
    return { error: err.message };
  }
}

// collectKicks'in ürettiği bir vuruşu (kick.frames dahil, ağır) sonuç için hafif bir özete
// çevirir: kick.frames'i (iskelet kareleri) SONUCA KOYMAZ, sadece t/foot/view/context/analiz sayıları.
function summarizeKick(kick) {
  return {
    t: kick.t,
    foot: kick.foot,
    view: kick.view ? { view: kick.view.view, confidence: kick.view.confidence, reason: kick.view.reason } : null,
    suggestionMode: kick.suggestion ? kick.suggestion.mode : null,
    context: { movingBall: !!(kick.context && kick.context.movingBall), ballSpeed: kick.context ? kick.context.ballSpeed : null },
    fps: kick.fps,
    analizler: {
      shot: tryAnalyze(kick, 'shot'),
      placement: tryAnalyze(kick, 'placement'),
      freekick: tryAnalyze(kick, 'freekick'),
    },
  };
}

async function processClip(entry) {
  const filename = entry.file;
  const base = { file: filename, kategori: entry.kategori, oyuncu: entry.oyuncu, beklenenTur: entry.beklenenTur, kaynakNot: entry.not };

  let blob;
  try { blob = await fetchVideoBlob(filename); }
  catch (err) { return { ...base, durum: 'hata', hata: 'video indirilemedi: ' + err.message, kicks: [] }; }

  try { await loadIntoVideo(blob); }
  catch (err) { return { ...base, durum: 'hata', hata: 'video açılamadı: ' + err.message, kicks: [] }; }

  const visionBefore = pipeline.getVisionStats();
  const started = performance.now();
  let zamanAsimi = false;
  const shouldStop = () => {
    if (performance.now() - started > CLIP_TIMEOUT_MS) { zamanAsimi = true; return true; }
    return false;
  };

  try {
    const durationSec = await pipeline.realDuration(video);
    const res = await pipeline.scanVideo(video, {
      onFrame: drawFrame,
      onProgress: (label, i, total) => setStatus(`${filename}: ${label} %${Math.round(((i + 1) / total) * 100)}`),
      shouldStop,
    });
    const kicks = res.kicks || [];
    const processingSec = (performance.now() - started) / 1000;
    const visionAfter = pipeline.getVisionStats();
    // kick başına özetleme de tek tek try/catch'te: bir vuruşun özeti çökerse diğerleri kaybolmasın.
    const kickSummaries = kicks.map((k, idx) => {
      try { return summarizeKick(k); }
      catch (err) { return { t: k.t, hata: `vuruş ${idx} özetlenemedi: ${err.message}` }; }
    });
    return {
      ...base,
      durum: zamanAsimi ? 'zaman-asimi' : 'ok',
      hata: null,
      durationSec,
      processingSec,
      kickCount: kicks.length,
      kicks: kickSummaries,
      moveNetCalls: visionAfter.moveNetCalls - visionBefore.moveNetCalls,
      moveNetAccepted: visionAfter.moveNetAccepted - visionBefore.moveNetAccepted,
      sonucNot: kicks.length ? (zamanAsimi ? 'zaman aşımı (25 dk) — o ana kadar bulunan vuruşlarla kısmi sonuç' : null)
        : (zamanAsimi ? 'zaman aşımı (25 dk), vuruş bulunamadı' : 'vuruş bulunamadı'),
    };
  } catch (err) {
    return { ...base, durum: 'hata', hata: 'Hata: ' + err.message, kicks: [] };
  }
}

function renderRow(row) {
  const tr = document.createElement('tr');
  if (row.durum === 'hata') {
    tr.className = 'hata';
    tr.innerHTML = `<td>${row.file}</td><td>${row.kategori || ''}</td><td colspan="6" class="skip">hata: ${row.hata}</td><td>HATA</td>`;
    tbody.appendChild(tr);
    return;
  }
  const ilk = row.kicks && row.kicks[0];
  const ilkHucre = ilk
    ? `${fmtNum(ilk.t)}s / ${ilk.foot ?? '—'} / ${ilk.view ? ilk.view.view : '—'} / ${ilk.context && ilk.context.movingBall ? 'evet' : 'hayır'}`
    : (row.sonucNot || '—');
  const puan = (mode) => {
    const a = ilk && ilk.analizler ? ilk.analizler[mode] : null;
    if (!a) return '—';
    return a.error ? `hata` : String(a.total);
  };
  tr.className = row.durum === 'zaman-asimi' ? 'hata' : 'ok';
  tr.innerHTML = `
    <td>${row.file}</td>
    <td>${row.kategori || ''}</td>
    <td>${row.kickCount}</td>
    <td>${ilkHucre}</td>
    <td>${puan('shot')}</td>
    <td>${puan('placement')}</td>
    <td>${puan('freekick')}</td>
    <td>${fmtNum(row.durationSec, 1)} / ${fmtNum(row.processingSec, 1)}</td>
    <td>${row.durum === 'zaman-asimi' ? 'ZAMAN AŞIMI' : 'OK'}</td>`;
  tbody.appendChild(tr);
}

function summarize(results) {
  const ok = results.filter((r) => r.durum === 'ok').length;
  const hata = results.filter((r) => r.durum === 'hata').length;
  const zamanAsimi = results.filter((r) => r.durum === 'zaman-asimi').length;
  const toplamVurus = results.reduce((s, r) => s + (r.kickCount || 0), 0);
  return `Toplam: ${results.length} klip · OK: ${ok} · Hata: ${hata} · Zaman aşımı: ${zamanAsimi} · Toplam bulunan vuruş: ${toplamVurus}`;
}

async function run() {
  runBtn.disabled = true;
  tbody.innerHTML = '';
  const startedAt = new Date().toISOString();
  window.__referans = { done: false, results: [], startedAt, finishedAt: null };
  setStatus('referans-liste.json okunuyor…');
  const data = await fetch('./referans-liste.json').then((r) => r.json());

  let list = data.klipler;
  if (ONLY) list = list.filter((e) => e.file.toLowerCase().includes(ONLY.toLowerCase()));
  if (MAX && Number.isFinite(MAX) && MAX > 0) list = list.slice(0, MAX);

  const results = [];
  for (const entry of list) {
    setStatus(`${entry.file} işleniyor…`);
    const row = await processClip(entry);
    results.push(row);
    renderRow(row);
    window.__referans.results = results; // her klip bitince kısmi ilerleme de okunabilsin
  }

  const finishedAt = new Date().toISOString();
  window.__referans = { done: true, results, startedAt, finishedAt };
  summaryEl.textContent = summarize(results);
  setStatus('Bitti.');
  runBtn.disabled = false;
}

runBtn.addEventListener('click', () => run().catch((err) => setStatus('Hata: ' + err.message)));
if (AUTO) run().catch((err) => setStatus('Hata: ' + err.message));
