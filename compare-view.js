// compare-view.js — Messi ile yan yana iskelet (2026-09-25, v1.5). Temas anındaki iki 3D iskelet
// vücut eksenlerine çevrilmiş olarak gelir (metrics3d.js#bodyFrame): kamera nerede olursa olsun ikisi
// de tam yandan ve tam önden çizilir. Renkler role göre (vuran bacak turuncu, destek bacağı mavi),
// sağ ayaklıda Messi böylece kendiliğinden aynalanmış görünür. Sadece çizim, hesap yok.

const ROLE = (kick) => {
  const sup = kick === 'right' ? 'left' : 'right';
  const ix = { left: { sh: 11, el: 13, wr: 15, hip: 23, kn: 25, an: 27, he: 29, to: 31 }, right: { sh: 12, el: 14, wr: 16, hip: 24, kn: 26, an: 28, he: 30, to: 32 } };
  return { k: ix[kick], s: ix[sup] };
};
const KICK = '#ff9f43', SUP = '#4fa3ff', BODY = '#e8efe9';

function edges(kick) {
  const { k, s } = ROLE(kick);
  const leg = (r) => [[r.hip, r.kn], [r.kn, r.an], [r.an, r.he], [r.he, r.to], [r.an, r.to]];
  const arm = (r) => [[r.sh, r.el], [r.el, r.wr]];
  return [
    ...leg(k).map((e) => [e, KICK]), ...leg(s).map((e) => [e, SUP]),
    ...arm(k).map((e) => [e, KICK]), ...arm(s).map((e) => [e, SUP]),
    [[k.sh, s.sh], BODY], [[k.hip, s.hip], BODY], [[k.sh, k.hip], BODY], [[s.sh, s.hip], BODY],
  ];
}

// Bir iskeleti bir panele çizer. view: 'side' (x = ön) | 'front' (x = destek tarafı).
function drawFigure(g, pts, kick, view, box, pxPerM, groundU) {
  const cx = box.x + box.w / 2, base = box.y + box.h - 14;
  const P = (q) => [cx + (view === 'side' ? q.f : q.l) * pxPerM, base - (q.u - groundU) * pxPerM];
  g.lineCap = 'round';
  for (const [[a, b], col] of edges(kick)) {
    g.strokeStyle = col; g.lineWidth = 4;
    g.beginPath(); g.moveTo(...P(pts[a])); g.lineTo(...P(pts[b])); g.stroke();
  }
  const sh = pts[11], sh2 = pts[12], nose = pts[0];
  const neck = { f: (sh.f + sh2.f) / 2, u: (sh.u + sh2.u) / 2, l: (sh.l + sh2.l) / 2 };
  g.strokeStyle = BODY; g.lineWidth = 4;
  g.beginPath(); g.moveTo(...P(neck)); g.lineTo(...P(nose)); g.stroke();
  g.fillStyle = BODY; g.beginPath(); g.arc(...P(nose), 7, 0, Math.PI * 2); g.fill();
  // zemin çizgisi
  g.strokeStyle = 'rgba(232,239,233,.18)'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(box.x + 8, base); g.lineTo(box.x + box.w - 8, base); g.stroke();
}

/**
 * canvas: çizilecek tuval. me/messi: bodyFrame çıktıları (33 {f,u,l}). foot: kullanıcının vuran ayağı.
 * Messi hep sol ayaklı; rol tabanlı çizim aynalamayı kendiliğinden yapar.
 */
export function drawComparison(canvas, me, foot, messi) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  const colW = W / 2, rowH = (H - 40) / 2;
  // Ortak ölçek: iki iskeletin de sığdığı en büyük ölçek (aynı metre = aynı piksel, boylar kıyaslanabilir)
  const span = (pts) => {
    const us = pts.map((q) => q.u), hs = pts.flatMap((q) => [q.f, q.l]);
    return { h: Math.max(...us) - Math.min(...us), w: 2 * Math.max(...hs.map(Math.abs)), g: Math.min(...us) };
  };
  // Tahminde tek bir bozuk (NaN) nokta ölçeği bozup iki çizimi de boşaltmasın: öyle iskelet çizilmez.
  const ok = (pts) => pts?.length === 33 && pts.every((q) => Number.isFinite(q.f) && Number.isFinite(q.u) && Number.isFinite(q.l));
  if (!ok(me) || !ok(messi)) {
    g.fillStyle = '#e8efe9'; g.font = '14px system-ui, sans-serif'; g.textAlign = 'center';
    g.fillText('Bu vuruşta iskelet çizilemedi.', W / 2, H / 2);
    return;
  }
  const a = span(me), b = span(messi);
  const pxPerM = Math.min((rowH - 30) / Math.max(a.h, b.h), (colW - 20) / Math.max(a.w, b.w, 0.5));
  g.fillStyle = '#e8efe9'; g.font = '600 14px system-ui, sans-serif'; g.textAlign = 'center';
  g.fillText('Sen', colW / 2, 18); g.fillText(foot === 'right' ? 'Messi (aynalandı)' : 'Messi', colW + colW / 2, 18);
  const views = [['side', 'Yandan'], ['front', 'Önden']];
  views.forEach(([view, label], r) => {
    const y = 28 + r * rowH;
    g.fillStyle = 'rgba(232,239,233,.55)'; g.font = '12px system-ui, sans-serif'; g.textAlign = 'left';
    g.fillText(label, 8, y + 14);
    drawFigure(g, me, foot, view, { x: 0, y, w: colW, h: rowH }, pxPerM, a.g);
    drawFigure(g, messi, 'left', view, { x: colW, y, w: colW, h: rowH }, pxPerM, b.g);
  });
  g.strokeStyle = 'rgba(232,239,233,.12)'; g.beginPath(); g.moveTo(colW, 24); g.lineTo(colW, H - 8); g.stroke();
}
