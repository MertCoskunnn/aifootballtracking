// Ölçüm katmanı ("cetvel"): iskelet noktalarından açı ve mesafe hesaplar.
// Saf fonksiyonlar, tarayıcıya ve MediaPipe'a bağımlı değil, test edilebilir.
// Koordinatlar piksel cinsinden, y aşağı doğru artar.
import { findPhases } from './phases.js?v=46';

// MediaPipe Pose nokta numaraları
export const LM = {
  shoulder: { left: 11, right: 12 },
  wrist: { left: 15, right: 16 },
  hip: { left: 23, right: 24 },
  knee: { left: 25, right: 26 },
  ankle: { left: 27, right: 28 },
  heel: { left: 29, right: 30 },
  toe: { left: 31, right: 32 },
};

const other = (side) => (side === 'right' ? 'left' : 'right');
const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// cp-07-otomatik: gerçek videoda kamera açısına göre bir uzuv gizlenebilir (yandan çekimde
// uzak kol gibi). MediaPipe böyle noktalarda düşük 'visibility' verir ama yine de bir x,y üretir
// (uydurma), bu da örn. armOpen=5° gibi anlamsız sayılara yol açar. Temas karesinde görünürlüğü
// düşük noktalara bağlı ölçümü hesaplamak yerine NaN döneriz; coach.js bunu "ölçülemedi" gösterir.
const VIS_MIN = 0.5;
const visOk = (p, idxs) => idxs.every((i) => (p[i].v ?? 1) >= VIS_MIN);

// cp-14c-makul-aralik: visOk düşük görünürlüğü yakalar ama iskelet YANLIŞ okununca (kamera açısı,
// düşük çözünürlük, yanlış kişiye kilitlenme) MediaPipe yine de yüksek 'visibility' ile fizyolojik
// olarak İMKANSIZ bir nokta üretebiliyor. Gerçek veride görülenler (test-videolar/referans/SONUCLAR.md):
// destek dizi büküşü 117°, gövde açısı -85°, frikikte gövde yana yatışı 94°, destek ayağı topa 1.96
// bacak boyu uzak. Bunlara göre hoca düzeltme önerince, sahada tek başına çalışan biri için anlamsız
// bir talimat oluyor. Aralıklar BİLEREK gevşek: amaç sadece imkansızı elemek, kötü tekniği değil —
// kötü teknik zaten coach.js RULES ideal/tol ile puana yansıyor. [T]: gerçek veri arttıkça kalibre edilir.
export const PLAUSIBLE = {
  // Ş2/P1/PL2: destek dizi büküşü. Düz bacaktan (-10°, hafif hiperekstansiyon toleranslı) neredeyse
  // tam çömelmeye (90°) kadar. Gerçek veride 117° görüldü (anatomik olarak anlamsız) → filtrelenir.
  supportKnee: [-10, 90],
  // Ş5: temas anındaki vuran diz büküşü. Aynı fiziksel sınır, kickKnee şuttan sonra Ş4/backswing'den
  // daha fazla açılabildiği için üst sınır biraz daha geniş (160°, topuk-kalçaya değecek kadar bükülme dahil).
  kickKnee: [-10, 160],
  // Ş4/F4: kurma zirvesindeki vuran diz büküşü (backswing), aynı tanım (kneeFlexion) — 0 (düz) ile
  // 170 (neredeyse topuk-kalçaya değecek) arası, tüm pratik anatomik aralık.
  backswing: [0, 170],
  // Ş3/P3: gövdenin dikeyle açısı (öne/arkaya). Gerçek veride -85° ve -39° gibi imkansız/şüpheli
  // değerler görüldü (yanlış kamera açısı). -60..45: aşırı geriye yaslanmadan aşırı öne kapanmaya
  // kadar geniş bir pay bırakır ama -85° gibi anatomik olarak imkansız değerleri dışarıda tutar.
  trunk: [-60, 45],
  // Ş7: karşı kolun gövdeyle açısı. 0 (bitişik) – 180 (tam yukarı kaldırılmış), tüm anatomik aralık.
  armOpen: [0, 180],
  // Ş8: takipte kalça fleksiyonu. Düz bacaktan (-30°, hafif hiperekstansiyon toleranslı) neredeyse
  // uyluğun göğse değeceği kalkışa (170°) kadar.
  followHip: [-30, 170],
  // P4: takipte ayak bileğinin yükselişi, bacak boyuna oranlı. -1: ölçüm gürültüsüyle hafif negatif
  // çıkabilir, 2: iki bacak boyu yükseliş (uzun takipli bir şutta olağanüstü ama imkansız değil).
  followRise: [-1, 2],
  // Ş1/P1/PL2: destek ayağının topa ön-arka mesafesi, bacak boyuna oranlı. Gerçek veride en kötü
  // örnek -1.32 bacaktı (yanlış açı, ama anatomik olarak imkansız değil); 1.5 pay bırakır.
  supportOffset: [-1.5, 1.5],
  // F2: destek ayağının topa yanal mesafesi (frikik). Gerçek veride -1.96 bacak görüldü ve notlarda
  // "anlamsız" diye işaretlendi → filtrelenir. 1.2 zaten çok geniş bir yanal mesafe.
  supportLateral: [-1.2, 1.2],
  // F3: gövdenin yana yatışı (frikik). Gerçek veride 94° görüldü ve "anlamsız" diye işaretlendi;
  // ±45° zaten aşırı bir yatışı kapsıyor.
  trunkLateral: [-45, 45],
  // F5: takibin çaprazlaması, bacak boyuna oranlı. supportOffset ile aynı gerekçe/genişlik.
  crossing: [-1, 2],
  // F1: yaklaşma açısı. Matematiksel sınır ±90° (atan2, ikinci bileşen her zaman pozitif); ±80°
  // neredeyse kameraya paralel bir yaklaşımı zaten kapsıyor, ±90'a yakın uçlar ölçüm gürültüsü.
  approachAngle: [-80, 80],
};

// Ölçüm nesnesindeki her PLAUSIBLE anahtarını kontrol eder, aralık dışındaysa NaN'a çevirir
// (coach.js'in "ölçülemedi" mekanizması zaten NaN'ı ele alıyor) ve `filtered` listesine ekler.
// info amaçlı alanlara (kneeAngVelRatio, supportKneeAtPlant, backswingAtPeak, phases, ...) DOKUNULMAZ:
// bunlar puanlamaya girmiyor, filtreleme onlar için gereksiz (kneeAngVelRatio zaten kalibrasyon bekliyor).
function applyPlausible(result, keys) {
  const filtered = [];
  for (const key of keys) {
    const range = PLAUSIBLE[key];
    const v = result[key];
    // EPS: sınırda tam oturan bir açı (ör. kneeFlexion=170°) trig yuvarlamasıyla 170.00000000000006
    // gibi çıkabiliyor; küçük bir tolerans olmadan bu, sınırın TAM ÜSTÜNDE meşru bir değeri yanlışlıkla filtreler.
    const EPS = 1e-6;
    if (range && Number.isFinite(v) && (v < range[0] - EPS || v > range[1] + EPS)) {
      result[key] = NaN;
      filtered.push(key);
    }
  }
  result.filtered = filtered;
  return result;
}

// b noktasındaki iç açı (derece): a-b-c
export function angleAt(a, b, c) {
  const v1 = { x: a.x - b.x, y: a.y - b.y };
  const v2 = { x: c.x - b.x, y: c.y - b.y };
  const cos = (v1.x * v2.x + v1.y * v2.y) / (Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y));
  return (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
}

// Diz bükülmesi: düz bacak = 0°, dik açı = 90°
const kneeFlexion = (p, side) =>
  180 - angleAt(p[LM.hip[side]], p[LM.knee[side]], p[LM.ankle[side]]);

// Kalça fleksiyonu (takip/Ş8): uyluğun gövde eksenine göre öne kalkışı. Düz = 0°, uyluk yatay = 90°
const hipFlexion = (p, side) =>
  180 - angleAt(p[LM.shoulder[side]], p[LM.hip[side]], p[LM.knee[side]]);

// Bacak boyu (kalça → diz → ayak bileği), mesafeleri kişiden bağımsız yapmak için
const legLength = (p, side) =>
  dist(p[LM.hip[side]], p[LM.knee[side]]) + dist(p[LM.knee[side]], p[LM.ankle[side]]);

/** İki bacaktan uzun olanın boyu (piksel). Topun hızını "bacak boyu/sn" ile ölçmek için (outcome.js). */
export const bodyLeg = (p) => Math.max(legLength(p, 'left'), legLength(p, 'right'));

// Gövdenin dikeyle açısı. Pozitif = hareket yönüne (öne) eğik, negatif = geriye yaslanmış.
function trunkLean(p, dir) {
  const hip = mid(p[LM.hip.left], p[LM.hip.right]);
  const sh = mid(p[LM.shoulder.left], p[LM.shoulder.right]);
  const dx = (sh.x - hip.x) * dir;
  const up = hip.y - sh.y;
  return (Math.atan2(dx, up) * 180) / Math.PI;
}

// Hareket yönü: sağa +1, sola -1. Kalçanın temastan önceki kaymasına bakar.
// Kalça yeterince kaymadıysa topun oyuncuya göre konumuna bakar.
// cp-11-evreler: pencere kare sayısı yerine saniyeyle tanımlı (10 kare @ 30fps = 0.33 sn),
// 60 fps'te de aynı fiziksel süreyi kapsasın diye. 30 fps'te Math.round(10/30*30)=10, değişmez.
function direction(frames, contact, ball, fps) {
  const back = Math.max(0, contact - Math.round((10 / 30) * fps));
  const hipNow = mid(frames[contact][LM.hip.left], frames[contact][LM.hip.right]);
  const hipThen = frames[back] ? mid(frames[back][LM.hip.left], frames[back][LM.hip.right]) : hipNow;
  const dx = hipNow.x - hipThen.x;
  if (Math.abs(dx) > 2) return Math.sign(dx);
  return Math.sign(ball.x - hipThen.x) || 1;
}

const hipOf = (p) => mid(p[LM.hip.left], p[LM.hip.right]);
const d2 = (a, b) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

// contact çevresindeki kareleri (iskeleti olanları) dilimler. measure() ve measureFreeKick() ortak kullanır.
const sliceFrames = (frames, from, to) =>
  frames.slice(Math.max(0, from), Math.min(frames.length, to + 1)).filter(Boolean);

/**
 * Vuran oyuncu = kameraya en yakın kişi (ekranda en büyük görünen). Mert'in kuralı (2026-09-24):
 * tripodla çekilen idman videosunda vuran hep ön plandadır; kaleci ve arkadakiler uzakta, küçük.
 * "Ayağı topa en yakın" kuralı yerde birden çok top olunca ya da top başka birinin yanında
 * kalınca yanlış kişiyi seçiyordu. Mert'in kararı: topa hiç bakılmaz, doğrudan en büyük görünen
 * kişi seçilir. Boy = iskeletin dikey uzunluğu (piksel). Bu kuralın bozulduğu çekimler (kalecinin
 * arkasından maç görüntüsü, kameranın dibinden geçen biri) için "Vuran oyuncuyu seç" dokunuşu var.
 */
export function personHeight(p) {
  const ys = p.map((q) => q.y);
  return Math.max(...ys) - Math.min(...ys);
}

export function pickKicker(people) {
  if (!people.length) return null;
  return people.reduce((a, b) => (personHeight(b) > personHeight(a) ? b : a));
}

/**
 * Oyuncuyu seç ve takip et. Kadrajda birden fazla kişi olabilir.
 * Temas karesinde kameraya en yakın kişi oyuncudur (pickKicker). Sonra ileri ve geri
 * her karede, bir önceki karedeki kalçasına en yakın kişiyi seçeriz.
 * frames: her kare için kişi listesi (her kişi 33 nokta). Dönen: kare başına tek iskelet ya da null.
 * ball: artık oyuncu seçiminde kullanılmıyor, imza geriye uyumluluk için duruyor.
 * seed (isteğe bağlı): kullanıcının temas karesinde dokunarak seçtiği iskelet. Verilirse
 * otomatik seçim atlanır, takip doğrudan bu kişiden başlar.
 */
export function buildTrack(frames, contact, ball, seed = null) {
  const track = new Array(frames.length).fill(null);
  const start = seed || pickKicker(frames[contact] || []);
  if (!start) return track;
  track[contact] = start;
  // Kalabalık/arkadan çekimde (Messi–Liverpool yayını) sadece "kalçaya en yakın" seçimi, oyuncu
  // arkadaki biriyle çakışınca iskeleti ona kaydırıyordu. Artık üç şart var:
  //   1) Konum: kalça, geçen kare sayısıyla orantılı bir yarıçap içinde (kare başına ≤ 0.6 bacak boyu)
  //   2) Boyut sürekliliği: aynı kişi bir karede %25'ten fazla büyüyüp küçülmez
  //   3) Kısa kayıplar: kişi birkaç kare bulunamazsa takip kopmaz, son görüldüğü yerden devam eder
  // Aday = konum farkı + boyut farkı cezası en küçük olan.
  const size = (p) => Math.max(legLength(p, 'left'), legLength(p, 'right')) || 1;
  const MAX_GAP = 8;
  for (const step of [-1, 1]) {
    let last = start, lastI = contact;
    for (let i = contact + step; i >= 0 && i < frames.length; i += step) {
      const gap = Math.abs(i - lastI);
      if (gap > MAX_GAP) break;
      const leg = size(last);
      let best = null, bestCost = Infinity;
      for (const p of frames[i] || []) {
        const move = Math.sqrt(d2(hipOf(p), hipOf(last))) / leg;
        const scale = size(p) / leg;
        if (move > 0.6 * gap || scale < 0.75 || scale > 1.33) continue;
        const cost = move + 2 * Math.abs(Math.log(scale));
        if (cost < bestCost) { bestCost = cost; best = p; }
      }
      if (best) { track[i] = best; last = best; lastI = i; }
    }
  }
  return track;
}

/**
 * frames: her kare için 33 noktalık dizi (piksel) ya da null (iskelet bulunamadı)
 * contact: temas karesinin indeksi
 * ball: temas karesinde topun merkezi {x, y}
 * side: vuran ayak 'right' | 'left'
 * fps: kare/sn, temas civarındaki pencereleri (Ş5, Ş7, Ş8) saniyeye çevirmek için (varsayılan 30)
 */
export function measure(frames, contact, ball, side, fps = 30) {
  const p = frames[contact];
  if (!p) throw new Error('Temas karesinde iskelet bulunamadı. Başka bir kare seç.');
  const sup = other(side);
  const dir = direction(frames, contact, ball, fps);
  const leg = legLength(p, sup);

  // Temastan önceki ve sonraki pencereler (iskeleti olan kareler). cp-11-evreler: eskiden sabit
  // kare sayısıydı (20/15 kare @ 30fps = 0.67/0.5 sn); artık saniyeyle tanımlı, 60 fps'te de aynı
  // fiziksel süreyi kapsar. 30 fps'te Math.round(20/30*30)=20, Math.round(15/30*30)=15 — değişmez.
  const before = sliceFrames(frames, contact - Math.round((20 / 30) * fps), contact);
  const after = sliceFrames(frames, contact, contact + Math.round((15 / 30) * fps));

  // Ş7: karşı kolun, temastan önceki ~0.3 sn içindeki en açık hali (30 fps'de bulanıklığa karşı pencere)
  const armWindow = sliceFrames(frames, contact - Math.round(0.3 * fps), contact)
    .filter((f) => visOk(f, [LM.wrist[sup], LM.shoulder[sup]]));
  const armOpen = armWindow.length
    ? Math.max(...armWindow.map((f) => angleAt(f[LM.wrist[sup]], f[LM.shoulder[sup]], f[LM.hip[sup]])))
    : NaN;

  // Takip: temastan sonra vuran ayak bileği ne kadar yükseldi (bacak boyuna oranla)
  const ankleY0 = p[LM.ankle[side]].y;
  const minY = Math.min(...after.map((f) => f[LM.ankle[side]].y));
  const followRiseRaw = (ankleY0 - minY) / leg;
  const followRise = visOk(p, [LM.ankle[side]]) ? followRiseRaw : NaN;

  // Ş8: temastan sonraki ~0.5 sn'de vuran kalçanın en büyük öne fleksiyonu (takip)
  const followHipWindow = sliceFrames(frames, contact, contact + Math.round(0.5 * fps))
    .filter((f) => visOk(f, [LM.shoulder[side], LM.hip[side], LM.knee[side]]));
  const followHip = followHipWindow.length ? Math.max(...followHipWindow.map((f) => hipFlexion(f, side))) : NaN;

  // Ş1: destek TOPUĞUNUN (ayak bileği değil) topa göre ön-arka konumu, bacak boyuna oranlı.
  // + = topun önünde, - = gerisinde (yön kuralı aynı, RESEARCH.md Ş1)
  const supportOffsetRaw = ((p[LM.heel[sup]].x - ball.x) * dir) / leg;
  const supportOffset = visOk(p, [LM.heel[sup]]) ? supportOffsetRaw : NaN;

  const supportKneeRaw = kneeFlexion(p, sup);
  const supportKnee = visOk(p, [LM.hip[sup], LM.knee[sup], LM.ankle[sup]]) ? supportKneeRaw : NaN;

  const trunkRaw = trunkLean(p, dir);
  const trunk = visOk(p, [LM.hip.left, LM.hip.right, LM.shoulder.left, LM.shoulder.right]) ? trunkRaw : NaN;

  const backswingRaw = Math.max(...before.map((f) => kneeFlexion(f, side)));
  const backswing = visOk(p, [LM.hip[side], LM.knee[side], LM.ankle[side]]) ? backswingRaw : NaN;

  // Ş5: temas karesindeki diz. 30 fps'de diz iki kare arasında ~39° açılıyor. Gerçek veride
  // art arda üç karede 128° → 54° → 7° görüldü (Mert K1). Hangi kare seçilirse seçilsin sonuç
  // tesadüfe kalıyor ("öncekinin büyüğü" ve "ayak ucu topa en yakın" kuralları denendi, ikisi de
  // yanıldı). Bu yüzden ölçülür ve gösterilir, ama puanlamaya sadece fps ≥ 50 ise girer (coach.js).
  const kneeVis = [LM.hip[side], LM.knee[side], LM.ankle[side]];
  const kickKnee = visOk(p, kneeVis) ? kneeFlexion(p, side) : NaN;

  // cp-13-vurus-turleri, PL4 (bilgi, coach.js placement'ta info:true — puana girmez, kalibrasyon
  // bekliyor): vuran dizin açısal hızının (derece/sn) kalça-orta noktasının yatay hızına (bacak
  // boyu/sn) oranı. RESEARCH-VURUS-TURLERI.md "Frodo için özet" madde 1: Alcock 2012'de plase/curl
  // ile şutu (instep) ayıran en net kinematik imza bu — şutta yaklaşma/kalça DOĞRUSAL hızı, plasede
  // dizin AÇISAL hızı baskın. Açısal hız: temastan önceki 0.3 sn'deki ardışık karelerde diz
  // büküşünün mutlak değişiminin en büyüğü (derece/sn'e çevrilmiş). Kalça hızı: aynı pencerede
  // kalça-orta noktasının yatay kayma hızının ortalaması. Her iki uçta da veri eksikse (görünmüyor,
  // ya da kalça hızı ~0) oran NaN döner ("ölçülemedi").
  const kavFrom = Math.max(0, contact - Math.round(0.3 * fps));
  let kneeAngVel = -Infinity;
  let hipSpeedSum = 0, hipSpeedN = 0;
  for (let i = kavFrom + 1; i <= contact; i++) {
    const f0 = frames[i - 1], f1 = frames[i];
    if (!f0 || !f1) continue;
    if (visOk(f0, kneeVis) && visOk(f1, kneeVis)) {
      const delta = Math.abs(kneeFlexion(f1, side) - kneeFlexion(f0, side)) * fps;
      if (delta > kneeAngVel) kneeAngVel = delta;
    }
    if (visOk(f0, [LM.hip.left, LM.hip.right]) && visOk(f1, [LM.hip.left, LM.hip.right])) {
      const h0 = mid(f0[LM.hip.left], f0[LM.hip.right]);
      const h1 = mid(f1[LM.hip.left], f1[LM.hip.right]);
      hipSpeedSum += (Math.abs(h1.x - h0.x) / leg) * fps;
      hipSpeedN++;
    }
  }
  const kneeAngVelFinal = kneeAngVel > -Infinity ? kneeAngVel : NaN;
  const hipSpeedAvg = hipSpeedN ? hipSpeedSum / hipSpeedN : NaN;
  const kneeAngVelRatio = Number.isFinite(kneeAngVelFinal) && Number.isFinite(hipSpeedAvg) && hipSpeedAvg > 1e-6
    ? kneeAngVelFinal / hipSpeedAvg
    : NaN;

  // cp-11-evreler: basış/kurma/takip anlarını gerçek harekete bakarak bulur (phases.js, saf).
  // Bu evreler PUANA GİRMEZ (coach.js'e dokunulmadı) — bilgi amaçlı, raporda "kurman kısaydı" gibi
  // somut geri bildirim vermek için.
  const phases = findPhases(frames, contact, side, fps);
  const times = phaseTimes(phases, contact, fps);

  // Bilgi amaçlı (puana girmez): basış karesinde destek dizi büküşü (literatür: basışta ~26°,
  // temasta ~42°, bkz. METRICS.md Ş2/L10). Basış bulunamadıysa ya da destek dizi görünmüyorsa NaN.
  const supportKneeAtPlant = phases.plant !== null && frames[phases.plant]
    && visOk(frames[phases.plant], [LM.hip[sup], LM.knee[sup], LM.ankle[sup]])
    ? kneeFlexion(frames[phases.plant], sup)
    : NaN;
  // Bilgi amaçlı: kurma zirvesindeki vuran diz büküşü. `backswing` ile aynı tanım (kneeFlexion),
  // farklı pencereden geldiği için (plant'a göre vs. sabit 0.67sn) hafif farklı çıkabilir — ikisi
  // de doğru, hangi anın "kurma zirvesi" sayıldığı farklı (tests/phases.test.mjs bunu doğrular).
  const backswingAtPeak = phases.backswingPeak !== null && frames[phases.backswingPeak]
    && visOk(frames[phases.backswingPeak], kneeVis)
    ? kneeFlexion(frames[phases.backswingPeak], side)
    : NaN;

  return applyPlausible({
    dir,
    // Destek ayağının topa göre ön-arka konumu. + = topun önünde, - = gerisinde
    supportOffset,
    supportKnee,
    trunk,
    backswing,
    kickKnee,
    armOpen,
    followRise,
    followHip,
    kneeAngVelRatio, // PL4 (bilgi): coach.js'te placement'ta info:true, puana girmez
    fps, // coach.js bazı ölçümleri düşük fps'de puana katmaz (Ş5)
    phases: { ...phases, times },
    supportKneeAtPlant,
    backswingAtPeak,
  }, ['supportOffset', 'supportKnee', 'trunk', 'backswing', 'kickKnee', 'armOpen', 'followRise', 'followHip']);
}

// cp-11-evreler: findPhases()'in kare indekslerini temasa göre saniyeye çevirir (temas = 0,
// öncesi negatif, sonrası pozitif). Kare zamanı (video t) burada bilinmediği için sabit fps
// varsayılır: (index - contact) / fps. Değişken fps'li videoda bu yaklaşık olur.
function phaseTimes(phases, contact, fps) {
  const rel = (i) => (i === null ? null : (i - contact) / fps);
  return {
    approachStart: rel(phases.approachStart),
    plant: rel(phases.plant),
    backswingPeak: rel(phases.backswingPeak),
    contact: 0,
    followEnd: rel(phases.followEnd),
  };
}

/**
 * Frikik / falsolu vuruş ölçümü. RESEARCH.md bölüm 3, kurallar F1..F5.
 *
 * Kamera arkadan ya da çapraz arkadan varsayılır (oyuncu kameradan uzaklaşır/yaklaşır).
 * Bu açıda görüntünün x ekseni oyuncunun kendi sağ-sol ekseniyle örtüşür: yandan çekimdeki
 * gibi bir aynalanma YOK (arkadan bakınca sağ-sol, oyuncunun kendi sağ-solu ile aynı taraftadır).
 * Bu yüzden yön normalizasyonu `direction()` ile değil, doğrudan `side` parametresinden gelen
 * `mirror` ile yapılır: sağ ayaklı için +1, sol ayaklı için -1. Her ölçümün "+" işareti, ayak
 * hangisi olursa olsun aynı fiziksel anlama gelecek şekilde tasarlandı (bkz. her satırın yorumu).
 *
 * frames/contact/ball: measure() ile aynı biçim. side: vuran ayak 'right' | 'left'.
 * fps: kare/sn, yaklaşma/takip pencerelerini (F1, F4, F5) saniyeye çevirmek için (varsayılan 30,
 * geriye uyumlu — cp-11-evreler öncesi çağrılar hâlâ çalışır).
 */
export function measureFreeKick(frames, contact, ball, side, fps = 30) {
  const p = frames[contact];
  if (!p) throw new Error('Temas karesinde iskelet bulunamadı. Başka bir kare seç.');
  const sup = other(side);
  const mirror = side === 'right' ? 1 : -1;
  const leg = legLength(p, sup);

  // cp-11-evreler: eskiden sabit kare sayısıydı (10/15 kare @ 30fps = 0.33/0.5 sn), artık
  // saniyeyle tanımlı. 30 fps'te Math.round(10/30*30)=10, Math.round(15/30*30)=15 — değişmez.
  const before = sliceFrames(frames, contact - Math.round((10 / 30) * fps), contact); // yaklaşma penceresi (F1, F4)
  const after = sliceFrames(frames, contact, contact + Math.round((15 / 30) * fps)); // takip penceresi (F5)

  // F1 Yaklaşma açısı (proxy): kalça-orta noktasının ~10 kare önceki konumundan temasa kadarki
  // yer değiştirme yönü, görüntü dikeyinden kaç derece saptığı. Düz koşu (kameraya dik) ~0°,
  // diyagonal yaklaşım daha büyük |açı|. + = vuruş bacağı tarafından gelen diyagonal yaklaşım.
  const hipNow = hipOf(p);
  const hipThen = hipOf(before[0] || p);
  const approachDx = (hipNow.x - hipThen.x) * mirror;
  const approachDy = Math.abs(hipNow.y - hipThen.y) || 1; // 0'a bölmeyi önler
  const approachAngleRaw = (Math.atan2(approachDx, approachDy) * 180) / Math.PI;
  const approachAngle = visOk(p, [LM.hip.left, LM.hip.right]) ? approachAngleRaw : NaN;

  // F2 Destek ayağının topa yanal mesafesi (bacak boyuna oranlı). Yandan çekimde ölçülemeyen bu
  // mesafe arkadan görünür. + = destek ayak, vuruş bacağının tersi (beklenen) tarafta ve topa göre dışta
  const supportLateralRaw = ((ball.x - p[LM.ankle[sup]].x) * mirror) / leg;
  const supportLateral = visOk(p, [LM.ankle[sup]]) ? supportLateralRaw : NaN;

  // F3 Gövdenin yana yatışı: omuz-orta / kalça-orta hattının dikeyle yatay sapması (derece).
  // trunkLean() ile aynı üçgen mantığı, ama koşu yönü yerine `mirror` ile (ters çevrilmiş) işaretlenir.
  // + = gövde DESTEK (vuruş yapmayan) ayak tarafına yatık. [L10]: profesyoneller temasta vuruş
  // yapmayan tarafa 10-16° yatıyor. Eski sürümde yön tersti (+ = vuruş bacağı tarafı), düzeltildi.
  const hip = hipOf(p);
  const sh = mid(p[LM.shoulder.left], p[LM.shoulder.right]);
  const trunkDx = (sh.x - hip.x) * -mirror;
  const trunkUp = hip.y - sh.y;
  const trunkLateralRaw = (Math.atan2(trunkDx, trunkUp) * 180) / Math.PI;
  const trunkLateral = visOk(p, [LM.hip.left, LM.hip.right, LM.shoulder.left, LM.shoulder.right]) ? trunkLateralRaw : NaN;

  // F4 Kurma: geri salınımda vuruş bacağının diz bükülme zirvesi (Ş4 ile aynı tanım)
  const backswingRaw = Math.max(...before.map((f) => kneeFlexion(f, side)));
  const backswing = visOk(p, [LM.hip[side], LM.knee[side], LM.ankle[side]]) ? backswingRaw : NaN;

  // F5 Takibin çaprazlaması: temastan sonra vuruş ayak bileği, temas anındaki destek ayak
  // bileğini bacak boyuna oranla ne kadar geçti. + = beklenen yönde çapraz geçiş (sarma takip)
  const supAnkleX = p[LM.ankle[sup]].x;
  const crossingRaw = Math.max(...after.map((f) => (mirror * (supAnkleX - f[LM.ankle[side]].x)) / leg));
  const crossing = visOk(p, [LM.ankle[sup]]) ? crossingRaw : NaN;

  // cp-11-evreler: basış/kurma/takip anları burada da bilgi amaçlı hesaplanır (puana girmez,
  // coach.js'e dokunulmadı). findPhases() kamera açısından bağımsız (sadece hız/açı geometrisi).
  const phases = findPhases(frames, contact, side, fps);
  const times = phaseTimes(phases, contact, fps);
  const supportKneeAtPlant = phases.plant !== null && frames[phases.plant]
    && visOk(frames[phases.plant], [LM.hip[sup], LM.knee[sup], LM.ankle[sup]])
    ? kneeFlexion(frames[phases.plant], sup)
    : NaN;
  const backswingAtPeak = phases.backswingPeak !== null && frames[phases.backswingPeak]
    && visOk(frames[phases.backswingPeak], [LM.hip[side], LM.knee[side], LM.ankle[side]])
    ? kneeFlexion(frames[phases.backswingPeak], side)
    : NaN;

  return applyPlausible({
    dir: mirror,
    approachAngle,
    supportLateral,
    trunkLateral,
    backswing,
    crossing,
    fps,
    phases: { ...phases, times },
    supportKneeAtPlant,
    backswingAtPeak,
  }, ['approachAngle', 'supportLateral', 'trunkLateral', 'backswing', 'crossing']);
}
