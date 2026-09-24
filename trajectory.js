// Saf modül: temastan sonra topun izlediği yol (oyunlardaki "şut çizgisi" için).
// DOM'a bağlı değil, Node ile test edilir (bkz. tests/trajectory.test.mjs).
//
// Her karede birden çok top adayı olabilir (kalabalık antrenmanda yerde duran başka toplar,
// bulut/kafa gibi yanlış tespitler). Topu temas noktasından başlayıp kare kare en yakın adayla
// takip ederiz; aday son bilinen yerden çok uzaktaysa (sıçrama) başka bir toptur, alınmaz.
// Ard arda MAX_MISS kare top bulunamazsa top kadrajdan çıkmış sayılır, yol biter.

export const MAX_MISS = 6;

/**
 * frames: [{ balls: [{x,y}] }], contact: temas karesi indeksi, start: temas anındaki top {x,y}.
 * maxStep: bir karede topun gidebileceği en uzun yol (piksel); kaçırılan kare sayısıyla büyür.
 * Dönen: [{ i, x, y }] — temas karesinden başlayan, zaman sıralı noktalar.
 */
export function ballFlight(frames, contact, start, maxStep) {
  const path = [{ i: contact, x: start.x, y: start.y }];
  let last = path[0], vx = 0, vy = 0, miss = 0;
  for (let i = contact + 1; i < frames.length && miss < MAX_MISS; i++) {
    const gap = i - last.i;
    // Beklenen yer: son hız ile ileri tahmin (düz giden topu diğer toplardan ayırır)
    const px = last.x + vx * gap, py = last.y + vy * gap;
    let best = null, bestD = maxStep * gap;
    for (const b of frames[i]?.balls || []) {
      const d = Math.hypot(b.x - px, b.y - py);
      if (d < bestD) { bestD = d; best = b; }
    }
    if (!best) { miss++; continue; }
    miss = 0;
    vx = (best.x - last.x) / gap; vy = (best.y - last.y) / gap;
    last = { i, x: best.x, y: best.y };
    path.push(last);
  }
  return path;
}
