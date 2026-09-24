// Referans klip toplu analiz (cp-19-referans-liste): regresyon.js'in kalıbını izler (aynı
// pipeline.js'i, blob URL ile video yükleme yöntemini kullanır) ama PASS/FAIL kontrolü DEĞİL,
// ham ölçüm + ayrışma toplama aracıdır. Menü artık seçmeli (cp-15-secmeli-menu, otomatik mod
// yok): her videonun (tür, ayak, açı) seçimi klasör yolundan gelir (scripts/referans-liste.mjs'in
// ürettiği tests/referans-liste.json), pipeline'ın kendi suggestion.mode/kick.foot tahmini burada
// KULLANILMAZ — regresyon.js'in cp-15 notuyla aynı gerekçe.
import * as pipeline from '../pipeline.js?v=26';
import { getRuleSet } from '../rules.js?v=26';
import { encodeRelPathForFetch, toPipelineParams } from '../scripts/referans-liste.mjs';
import { groupRows } from '../scripts/referans-ozet.mjs';

const params = new URLSearchParams(location.search);
const AUTO = params.get('auto') === '1';
// ?grup=frikik ya da ?grup=frikik/sag ya da ?grup=frikik/sag/arkadan: tur[/ayak[/aci]] filtresi.
const GRUP = params.get('grup') ? params.get('grup').split('/').filter(Boolean) : null;

// Klip başına zaman aşımı: bir klip takılırsa (ör. çok uzun replay içeren video) sayfa sonsuza
// kadar beklemesin, o klibi "zaman aşımı" diye işaretleyip sıradakine geçsin (regresyon.js'teki
// tests/referans.html cp-14 notuyla aynı gerekçe).
const CLIP_TIMEOUT_MS = 25 * 60 * 1000;

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const durumEl = document.getElementById('durum');
const tbody = document.querySelector('#results tbody');
const ozetBolum = document.getElementById('ozetBolum');
const ozetTbody = document.querySelector('#ozet-tablo tbody');
const kuralTbody = document.querySelector('#kural-tablo tbody');
const runBtn = document.getElementById('runBtn');
const indirBtn = document.getElementById('indirBtn');

// Frodo (ya da başka bir otomasyon) sonucu tarayıcıdan okuyabilsin diye: makine okunur çıktı.
// Kasıtlı olarak iskelet kareleri (kick.frames) İÇİNDE DEĞİL — sadece sayılar/özetler.
window.__referansSonuc = { done: false, videos: [], gruplar: [], startedAt: null, finishedAt: null };

function setDurum(t) { durumEl.textContent = t; }

function fmtNum(n, d = 2) { return typeof n === 'number' && Number.isFinite(n) ? n.toFixed(d) : '—'; }

// Video sunucusu (python http.server) Range desteklemiyor: doğrudan URL'de ileri sarma çalışmıyor,
// bu yüzden dosyayı önce blob olarak indirip URL.createObjectURL ile veriyoruz (regresyon.js'teki
// GECE-PLANI notuyla aynı gerekçe). '/' ayraçlı yolları segment segment kodluyoruz (Türkçe/boşluklu/
// özel karakterli dosya adları ve alt klasörler için) — scripts/referans-liste.mjs#encodeRelPathForFetch.
function fetchVideoBlob(relFile) {
  return fetch('../test-videolar/' + encodeRelPathForFetch(relFile)).then((r) => {
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

// Bir vuruşu klasörden gelen (mode, foot, angle) ile analiz eder. Önce rules.getRuleSet: bu
// (tür, ayak, açı) hiç ölçülebiliyor mu (ör. frikik yandan çekilmişse hayır) — ölçülemezse
// pipeline.analyzeKick hiç çağrılmaz, app.js runAnalysis ile aynı akış (cp-16-kural-matrisi).
// Hata fırlatırsa (ör. temas karesinde iskelet yok) {hata} olarak döner, diğer vuruşları etkilemez.
function analyzeOneKick(kick, mode, foot, angle, ruleSet) {
  if (ruleSet.olculemez) {
    return { t: kick.t, total: null, olculemez: true, mesaj: ruleSet.mesaj, referans: null, items: [], quality: kick.quality ?? null };
  }
  try {
    const a = pipeline.analyzeKick(kick, { mode, foot });
    return {
      t: kick.t,
      total: a.result.total, // insufficient ise coach.js zaten null döner ("ölçüm yetersiz")
      insufficient: !!a.result.insufficient,
      olculemez: false,
      referans: ruleSet.referans,
      items: a.result.items.map((i) => ({ key: i.ref, value: Number.isFinite(i.value) ? i.value : null, score: i.score })),
      quality: kick.quality ?? null,
    };
  } catch (err) {
    return { t: kick.t, total: null, hata: err.message, olculemez: false, referans: ruleSet.referans, items: [], quality: kick.quality ?? null };
  }
}

async function processClip(entry) {
  const { mode, foot, angle } = toPipelineParams(entry);
  const base = { file: entry.file, tur: entry.tur, ayak: entry.ayak, aci: entry.aci, etiket: entry.etiket };
  const ruleSet = getRuleSet(mode, foot, angle);

  let blob;
  try { blob = await fetchVideoBlob(entry.file); }
  catch (err) { return { ...base, durum: 'hata', hata: 'video indirilemedi: ' + err.message, vurushlar: [] }; }

  try { await loadIntoVideo(blob); }
  catch (err) { return { ...base, durum: 'hata', hata: 'video açılamadı: ' + err.message, vurushlar: [] }; }

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
      onProgress: (label, i, total) => setDurum(`${entry.file}: ${label} %${Math.round(((i + 1) / total) * 100)}`),
      shouldStop,
    });
    const kicks = res.kicks || [];
    const processingSec = (performance.now() - started) / 1000;
    const visionAfter = pipeline.getVisionStats();
    // TÜM vuruşlar (spec: "her video için tüm vuruşları bulur"), tek tek try/catch (analyzeOneKick
    // zaten hata döner çökmez, ama vuruş listesindeki başka bir hata kalanları etkilemesin diye yine sarılı).
    const vurushlar = kicks.map((k, idx) => {
      try { return analyzeOneKick(k, mode, foot, angle, ruleSet); }
      catch (err) { return { t: k.t, total: null, hata: `vuruş ${idx} analiz edilemedi: ${err.message}` }; }
    });
    return {
      ...base,
      durum: zamanAsimi ? 'zaman-asimi' : 'ok',
      hata: null,
      durationSec,
      processingSec,
      vurusSayisi: vurushlar.length,
      vurushlar,
      moveNetCalls: visionAfter.moveNetCalls - visionBefore.moveNetCalls,
      moveNetAccepted: visionAfter.moveNetAccepted - visionBefore.moveNetAccepted,
      sonucNot: vurushlar.length ? (zamanAsimi ? 'zaman aşımı (25 dk) — o ana kadar bulunan vuruşlarla kısmi sonuç' : null)
        : (zamanAsimi ? 'zaman aşımı (25 dk), vuruş bulunamadı' : 'vuruş bulunamadı'),
    };
  } catch (err) {
    return { ...base, durum: 'hata', hata: 'Hata: ' + err.message, vurushlar: [] };
  }
}

function grupUyuyorMu(entry) {
  if (!GRUP) return true;
  const kolonlar = [entry.tur, entry.ayak, entry.aci];
  return GRUP.every((seg, i) => kolonlar[i] === seg);
}

function puanHucresi(vurushlar) {
  if (!vurushlar || !vurushlar.length) return '—';
  return vurushlar.map((v) => {
    if (v.hata) return `${fmtNum(v.t)}s: hata`;
    if (v.olculemez) return `${fmtNum(v.t)}s: ölçülemez`;
    return `${fmtNum(v.t)}s: ${v.total === null ? (v.insufficient ? 'yetersiz' : '—') : v.total}${v.referans ? ` (${v.referans})` : ''}`;
  }).join(' · ');
}

function renderRow(row) {
  const tr = document.createElement('tr');
  if (row.durum === 'hata') {
    tr.className = 'hata';
    tr.innerHTML = `<td>${row.file}</td><td>${row.tur}/${row.ayak}/${row.aci}</td><td>${row.etiket}</td>
      <td colspan="3" class="skip">hata: ${row.hata}</td><td>HATA</td>`;
    tbody.appendChild(tr);
    return;
  }
  tr.className = row.durum === 'zaman-asimi' ? 'hata' : 'ok';
  tr.innerHTML = `
    <td>${row.file}</td>
    <td>${row.tur}/${row.ayak}/${row.aci}</td>
    <td>${row.etiket}</td>
    <td>${row.vurusSayisi}</td>
    <td>${row.vurusSayisi ? puanHucresi(row.vurushlar) : (row.sonucNot || '—')}</td>
    <td>${fmtNum(row.durationSec, 1)} / ${fmtNum(row.processingSec, 1)}</td>
    <td>${row.durum === 'zaman-asimi' ? 'ZAMAN AŞIMI' : 'OK'}</td>`;
  tbody.appendChild(tr);
}

function renderOzet(gruplar) {
  ozetTbody.innerHTML = '';
  kuralTbody.innerHTML = '';
  for (const g of gruplar) {
    const etiket = `${g.tur}/${g.ayak}/${g.aci}`;
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${etiket}</td>
      <td>${g.vurusSayisi}</td>
      <td>${fmtNum(g.iyiOrtPuan, 1)}</td>
      <td>${fmtNum(g.kotuOrtPuan, 1)}</td>
      <td>${g.ayrisma === null ? '<span class="ayrisma-yok">iyi/kötü örneği eksik</span>' : fmtNum(g.ayrisma, 1)}</td>
      <td>${g.olculemezSayisi}</td>`;
    ozetTbody.appendChild(tr);

    for (const [key, s] of Object.entries(g.kurallar)) {
      const ktr = document.createElement('tr');
      ktr.innerHTML = `<td>${etiket}</td><td>${key}</td><td>${fmtNum(s.medyan)}</td><td>${fmtNum(s.min)}</td><td>${fmtNum(s.max)}</td><td>${s.n}</td>`;
      kuralTbody.appendChild(ktr);
    }
  }
  ozetBolum.hidden = gruplar.length === 0;
}

function indirJSON() {
  const blob = new Blob([JSON.stringify(window.__referansSonuc, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `referans-sonuc-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

async function run() {
  runBtn.disabled = true;
  tbody.innerHTML = '';
  ozetBolum.hidden = true;
  const startedAt = new Date().toISOString();
  window.__referansSonuc = { done: false, videos: [], gruplar: [], startedAt, finishedAt: null };
  setDurum('referans-liste.json okunuyor…');
  const data = await fetch('./referans-liste.json').then((r) => r.json());

  const list = data.klipler.filter(grupUyuyorMu);
  setDurum(`0/${list.length} video, ~kalan hesaplanıyor…`);

  const videos = [];
  const t0 = performance.now();
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    setDurum(`${i}/${list.length} video, ${entry.file} işleniyor…`);
    const row = await processClip(entry);
    videos.push(row);
    renderRow(row);
    const ortalamaSure = (performance.now() - t0) / (i + 1);
    const kalanDk = ((list.length - i - 1) * ortalamaSure) / 60000;
    setDurum(`${i + 1}/${list.length} video, ~${fmtNum(kalanDk, 1)} dk kalan`);
    window.__referansSonuc.videos = videos; // her klip bitince kısmi ilerleme de okunabilsin
  }

  // Grup özeti: her videonun her vuruşunu tek satırlık akışa (tur/ayak/aci/etiket/total/items) düzleştirip
  // groupRows'a veriyoruz (scripts/referans-ozet.mjs — saf, Node testli).
  const satirlar = videos.flatMap((v) => (v.vurushlar || []).map((k) => ({
    tur: v.tur, ayak: v.ayak, aci: v.aci, etiket: v.etiket, total: k.total, items: k.items || [],
  })));
  const gruplar = groupRows(satirlar);
  renderOzet(gruplar);

  const finishedAt = new Date().toISOString();
  window.__referansSonuc = { done: true, videos, gruplar, startedAt, finishedAt };
  setDurum(`Bitti. ${list.length} video, ${satirlar.length} vuruş.`);
  runBtn.disabled = false;
}

runBtn.addEventListener('click', () => run().catch((err) => setDurum('Hata: ' + err.message)));
indirBtn.addEventListener('click', indirJSON);
if (AUTO) run().catch((err) => setDurum('Hata: ' + err.message));
