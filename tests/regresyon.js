// Regresyon kontrol sayfası (cp-10-regresyon): app.js'in kullandığı AYNI pipeline.js'i çalıştırır,
// böylece "Messi hâlâ 100 mü, Mert hâlâ 82/88 mi" kontrolü elle tıklamaya değil tek bir koda dayanır.
// tests/beklenen.json'daki her video için ya sadece beklenen zamanın etrafını (mod=pencere, hızlı)
// ya da videonun tamamını (mod=tam) tarar, bulunan vuruşu analiz eder ve beklenenle karşılaştırır.
import * as pipeline from '../pipeline.js?v=36';
import { matchByDuration, withinTolerance } from '../analysis.js?v=36';

const params = new URLSearchParams(location.search);
const MODE = params.get('mod') === 'tam' ? 'tam' : 'pencere';
const AUTO = params.get('auto') === '1';
// cp-12-movenet: A/B için MoveNet yedek yolunu kapatabilme (?movenet=0). Varsayılan açık.
const MOVENET = params.get('movenet') !== '0';
pipeline.setMoveNetEnabled(MOVENET);

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const tbody = document.querySelector('#results tbody');
const summaryEl = document.getElementById('summary');
const runBtn = document.getElementById('runBtn');

document.getElementById('modLabel').textContent = MODE;

// Frodo (ya da başka bir otomasyon) sonucu tarayıcıdan okuyabilsin diye: makine okunur çıktı.
window.__regresyon = { done: false, results: [], summary: null };

function setStatus(t) { statusEl.textContent = t; }

function fmtNum(n, d = 2) { return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—'; }

// Video sunucusu (python http.server) Range desteklemiyor: doğrudan URL'de ileri sarma çalışmıyor.
// Bu yüzden dosyayı önce blob olarak indirip URL.createObjectURL ile veriyoruz (GECE-PLANI notu).
function fetchVideoBlob(filename) {
  return fetch('../test-videolar/' + encodeURIComponent(filename)).then((r) => {
    if (!r.ok) throw new Error('404');
    return r.blob();
  });
}

// blob'u ana <video> elemanına yükler, 'loadeddata' (ya da 'error') bekler.
function loadIntoVideo(blob) {
  return new Promise((resolve, reject) => {
    const onLoaded = () => { video.removeEventListener('error', onErr); resolve(); };
    const onErr = () => { video.removeEventListener('loadeddata', onLoaded); reject(new Error('video açılamadı')); };
    video.addEventListener('loadeddata', onLoaded, { once: true });
    video.addEventListener('error', onErr, { once: true });
    video.src = URL.createObjectURL(blob);
  });
}

// K1/K2 gibi hangi dosyanın hangi klip olduğunu bilmediğimiz videoların gerçek süresini ölçer
// (candidates + durationApprox eşleştirmesi için, bkz. analysis.js#matchByDuration).
async function measureDuration(filename, cache) {
  if (cache.has(filename)) return cache.get(filename);
  const blob = await fetchVideoBlob(filename);
  const tmp = document.createElement('video');
  tmp.muted = true; tmp.playsInline = true;
  tmp.src = URL.createObjectURL(blob);
  await new Promise((res, rej) => {
    tmp.addEventListener('loadedmetadata', res, { once: true });
    tmp.addEventListener('error', () => rej(new Error('video açılamadı')), { once: true });
  });
  let duration = tmp.duration;
  if (!Number.isFinite(duration)) duration = await pipeline.realDuration(tmp); // bazı videolar süresini baştan söylemez
  const entry = { duration, blob };
  cache.set(filename, entry);
  return entry;
}

// Taranırken o anki karedeki iskeletleri küçük noktalarla gösterir (canlı geri bildirim,
// app.js'teki drawLive'ın sade bir hali — burada doğruluk değil "bir şey oluyor" göstermek yeterli).
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

// "Sadece bilgi" videosu (Messi-Liverpool, arkadan çekim): vuruş beklentisi yok, sadece BlazePose'un
// bu klipte ne kadar iskelet bulabildiğini raporluyoruz (vision.js'teki nota bakınca beklenen: az).
async function processInfoOnly(entry, filename, started) {
  const dur = await pipeline.realDuration(video);
  // Bilgi satırı: tüm klip taranır ama kaba hızda (5 fps). 30 fps kalabalık yayında 10 dk+ sürüyordu.
  const frames = await pipeline.runPass(video, 0, dur, pipeline.COARSE_FPS, { onFrame: drawFrame, shouldStop: () => false });
  const total = frames.length;
  const withPerson = frames.filter((f) => (f.people || []).length > 0).length;
  const totalSkeletons = frames.reduce((s, f) => s + (f.people || []).length, 0);
  const avgPeoplePerFrame = totalSkeletons / (total || 1);
  // cp-12-movenet: bu klip tam olarak MoveNet'in kurtarması gereken durum (arkadan çekim,
  // BlazePose yüze bağımlı olduğu için bulamıyor). p.src==='movenet' işaretli iskeletleri sayıp
  // vision.js'in kendi sayaçlarını (çağrı/kabul) da ekliyoruz — Frodo tarayıcıda bunu görmeli.
  const moveNetSkeletons = frames.reduce((s, f) => s + (f.people || []).filter((p) => p.src === 'movenet').length, 0);
  const stats = pipeline.getVisionStats();
  return {
    id: entry.id, label: entry.label, file: filename, infoOnly: true,
    frameCount: total, avgPeoplePerFrame, fractionWithPerson: total ? withPerson / total : 0,
    moveNetSkeletons, moveNetFraction: totalSkeletons ? moveNetSkeletons / totalSkeletons : 0,
    moveNetCalls: stats.moveNetCalls, moveNetAccepted: stats.moveNetAccepted,
    durationSec: (performance.now() - started) / 1000,
  };
}

async function processEntry(entry, cache, tol) {
  const filename = entry.file || entry._resolvedFile;
  if (!filename) return { id: entry.id, label: entry.label, skipped: true, reason: 'dosya bulunamadı/eşleşmedi' };

  let blob;
  try { blob = cache.has(filename) ? cache.get(filename).blob : await fetchVideoBlob(filename); }
  catch { return { id: entry.id, label: entry.label, skipped: true, reason: '404' }; }

  try { await loadIntoVideo(blob); }
  catch (err) { return { id: entry.id, label: entry.label, skipped: true, reason: err.message }; }

  const started = performance.now();
  try {
    if (entry.infoOnly) return await processInfoOnly(entry, filename, started);

    let kicks;
    if (MODE === 'pencere') {
      const t0 = Math.max(0, entry.expected.tSec - 1.2);
      const t1 = entry.expected.tSec + 0.8;
      kicks = await pipeline.scanWindow(video, t0, t1, { onFrame: drawFrame, shouldStop: () => false });
    } else {
      const res = await pipeline.scanVideo(video, {
        onFrame: drawFrame,
        onProgress: (label, i, total) => setStatus(`${entry.label}: ${label} %${Math.round(((i + 1) / total) * 100)}`),
        shouldStop: () => false,
      });
      kicks = res.kicks;
    }
    const durationSec = (performance.now() - started) / 1000;

    if (!kicks.length) {
      return { id: entry.id, label: entry.label, file: filename, skipped: false, foundNothing: true, durationSec, pass: false };
    }
    // Pencerede tek vuruş olmalı, tam taramada birden fazla olabilir: beklenen zamana en yakınını al.
    let best = kicks[0], bestDiff = Math.abs(best.t - entry.expected.tSec);
    for (const k of kicks.slice(1)) {
      const d = Math.abs(k.t - entry.expected.tSec);
      if (d < bestDiff) { best = k; bestDiff = d; }
    }
    // cp-15-secmeli-menu: uygulamada artık "Otomatik" mod/ayak yok, kullanıcı üçünü de (açı, tür,
    // ayak) kendi seçiyor. Regresyon sayfası da aynı akışı yansıtsın diye beklenen.json'daki
    // mod/ayak değerlerini DOĞRUDAN veriyor — pipeline.analyzeKick'in kendi 'auto' tahmini
    // (suggestion.mode / kick.foot) burada artık kullanılmıyor.
    const a = pipeline.analyzeKick(best, { mode: entry.expected.mode, foot: entry.expected.foot });
    const cmp = withinTolerance({ tSec: best.t, score: a.result.total }, entry.expected, tol);
    return {
      id: entry.id, label: entry.label, file: filename,
      expectedTSec: entry.expected.tSec, foundTSec: best.t,
      expectedFoot: entry.expected.foot, foundFoot: best.foot,
      expectedView: entry.expected.view, foundView: best.view.view,
      expectedMode: entry.expected.mode, foundMode: a.mode,
      expectedScore: entry.expected.score, foundScore: a.result.total,
      items: a.result.items, durationSec, pass: cmp.pass, timeDiff: cmp.timeDiff, scoreDiff: cmp.scoreDiff,
    };
  } catch (err) {
    return { id: entry.id, label: entry.label, file: filename, skipped: true, reason: 'Hata: ' + err.message };
  }
}

function renderRow(row) {
  const tr = document.createElement('tr');
  if (row.skipped) {
    tr.innerHTML = `<td>${row.label}</td><td colspan="8" class="skip">atlandı (${row.reason})</td>`;
    tbody.appendChild(tr);
    return;
  }
  if (row.infoOnly) {
    tr.innerHTML = `<td>${row.label}</td><td colspan="8" class="info">bilgi: ${row.frameCount} kare, kişi/kare ort. ${fmtNum(row.avgPeoplePerFrame)}, en az 1 iskelet oranı %${fmtNum(row.fractionWithPerson * 100, 1)}, MoveNet iskelet ${row.moveNetSkeletons} (%${fmtNum(row.moveNetFraction * 100, 1)}), MoveNet çağrı/kabul ${row.moveNetCalls}/${row.moveNetAccepted}, süre ${fmtNum(row.durationSec, 1)} sn</td>`;
    tbody.appendChild(tr);
    return;
  }
  if (row.foundNothing) {
    tr.className = 'fail';
    tr.innerHTML = `<td>${row.label}</td><td colspan="7">vuruş bulunamadı</td><td>FAIL</td>`;
    tbody.appendChild(tr);
    return;
  }
  const items = (row.items || []).map((i) => `${i.ref}:${i.score ?? '—'}`).join(' ');
  tr.className = row.pass ? 'pass' : 'fail';
  tr.innerHTML = `
    <td>${row.label}</td>
    <td>${fmtNum(row.expectedTSec)} / ${fmtNum(row.foundTSec)}</td>
    <td>${row.expectedFoot} / ${row.foundFoot}</td>
    <td>${row.expectedView} / ${row.foundView}</td>
    <td>${row.expectedMode} / ${row.foundMode}</td>
    <td>${row.expectedScore} / ${row.foundScore}</td>
    <td>${items}</td>
    <td>${fmtNum(row.durationSec, 1)}</td>
    <td>${row.pass ? 'PASS' : 'FAIL'}</td>`;
  tbody.appendChild(tr);
}

function summarize(results) {
  const graded = results.filter((r) => !r.skipped && !r.infoOnly);
  const pass = graded.filter((r) => r.pass).length;
  return { total: graded.length, pass, fail: graded.length - pass };
}

async function run() {
  runBtn.disabled = true;
  tbody.innerHTML = '';
  window.__regresyon = { done: false, results: [], summary: null };
  setStatus('beklenen.json okunuyor…');
  const data = await fetch('./beklenen.json').then((r) => r.json());
  const tol = data.toleranceSec ?? 0.15;

  // 1) candidates + durationApprox olan girişler için gerçek süreleri ölç, en yakın eşleşmeyi bul.
  //    Sırayla işleniyor ki (K1 önce) bir dosya iki beklentiye birden atanmasın (excludeFiles).
  const cache = new Map();
  const assigned = [];
  for (const entry of data.videos) {
    if (entry.file || !entry.candidates) continue;
    for (const f of entry.candidates) {
      try { await measureDuration(f, cache); } catch { /* 404: aşağıda "atlandı" olur */ }
    }
    const durations = entry.candidates.filter((f) => cache.has(f)).map((f) => ({ file: f, duration: cache.get(f).duration }));
    entry._resolvedFile = matchByDuration(durations, entry.durationApprox, assigned);
    if (entry._resolvedFile) assigned.push(entry._resolvedFile);
  }

  // 2) her videoyu sırayla tara (aynı <video> elemanı tekrar kullanılır)
  const results = [];
  for (const entry of data.videos) {
    setStatus(`${entry.label} işleniyor (${MODE})…`);
    const row = await processEntry(entry, cache, tol);
    results.push(row);
    renderRow(row);
  }

  const summary = summarize(results);
  window.__regresyon = { done: true, results, summary };
  summaryEl.textContent = `Toplam: ${summary.total} · PASS: ${summary.pass} · FAIL: ${summary.fail}`;
  setStatus('Bitti.');
  runBtn.disabled = false;
}

runBtn.addEventListener('click', () => run().catch((err) => setStatus('Hata: ' + err.message)));
if (AUTO) run().catch((err) => setStatus('Hata: ' + err.message));
