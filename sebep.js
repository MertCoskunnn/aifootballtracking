// sebep.js — Neden-sonuç motoru (2026-09-24 gece, Mert'in ürün tanımının 4. adımı).
// "Top havalandı, ÇÜNKÜ temas anında gövden 12° fazla geride kaldı."
// Saf modül, DOM yok, Node testli (tests/sebep.test.mjs). Tablo ve kaynakları: SEBEP-SONUC.md.
//
// Nasıl çalışır:
//   1. coach.js#evaluate her kuralı puanlar. Puanı 80'in altında olan kural bir postür hatasıdır;
//      değer aralığın altında mı (low) üstünde mi (high) olduğuna göre yönü bellidir.
//   2. Aşağıdaki tablo her (ölçüm, yön) için o hatanın topa ne yaptığını söyler (sonuç etiketleri).
//   3. outcome.js topun GERÇEKTE ne yaptığını okur (sorun etiketleri). Hatanın etkisi gözlenen
//      sonuçla eşleşiyorsa bu "doğrulanmış" nedendir ve en üste çıkar: "Top havalandı, çünkü...".
//      Eşleşmiyorsa ya da top okunamadıysa hata yine söylenir ama tahmin diliyle: "... Bu genelde
//      topu havalandırır."
// Etiketler: 'yüksek' (top havalanır), 'zayıf' (vuruş güçsüz), 'falsosuz' (top falso almaz).

export const EFFECTS = {
  // --- Yandan görülenler (measure) ---
  trunk: {
    low: { neden: 'temas anında gövden fazla geride kaldı', sonuc: ['yüksek'], kaynak: '[K] Lees 2010: yüksek şutta gövde alçak şuta göre daha geride (17° vs 13°)' },
    high: { neden: 'temas anında gövden topun üstüne fazla kapandı', sonuc: ['zayıf'], kaynak: '[T] aşırı öne eğilme bacak salınımını kısaltır' },
  },
  supportOffset: {
    low: { neden: 'destek ayağın topun fazla gerisine bastı', sonuc: ['yüksek', 'zayıf'], kaynak: '[L] koçluk bilgisi; Lees 2010 bu bağı araştırılmamış sayıyor' },
    high: { neden: 'destek ayağın topun önüne geçti', sonuc: ['zayıf'], kaynak: '[L] top ayağın altında sıkışır, salınım kısalır' },
  },
  supportKnee: {
    low: { neden: 'destek dizin kilitli, düz bastın', sonuc: ['zayıf'], kaynak: '[K] Lees 2010: destek dizi basışta ~26° bükük, şoku emer ve dengeyi tutar' },
    high: { neden: 'destek dizin fazla büküldü, çöktün', sonuc: ['zayıf'], kaynak: '[T] çöken destek bacağı gövdeyi alçaltır, güç kaçar' },
  },
  backswing: {
    low: { neden: 'bacağını yeterince kurmadın', sonuc: ['zayıf', 'falsosuz'], kaynak: '[K] Petrolo 2024: elitlerde kurmada diz ~93° bükük, kamçının menzili buradan gelir' },
    high: { neden: 'kurma abartılı, zamanlama kaydı', sonuc: [], kaynak: '[T]' },
  },
  followHip: {
    low: { neden: 'vuruştan sonra bacağın öne devam etmedi, takip kesik', sonuc: ['zayıf'], kaynak: '[K] Petrolo 2024: takip sonunda kalça fleksiyonu ~97°' },
    high: { neden: 'takipte bacağını yukarı savurdun', sonuc: ['yüksek'], kaynak: '[L] yukarı savrulan takip topu altından alıp kaldırır' },
  },
  armOpen: {
    low: { neden: 'karşı kolun açılmadı, gövde dönüşü eksik kaldı', sonuc: ['zayıf'], kaynak: '[K] Lees 2010, Shan & Westerhoff 2005: kol açılıp kapanarak gövde rotasyonunu besler' },
    high: { neden: 'karşı kolun fazla açıldı, denge dağıldı', sonuc: [], kaynak: '[T]' },
  },
  followRise: {
    low: { neden: 'pas sonrası ayağın hedefe devam etmedi', sonuc: ['zayıf'], kaynak: '[K] RESEARCH.md P4: kısa, kontrollü, hedefe doğru takip' },
    high: { neden: 'pas sonrası ayağını yüksek kaldırdın', sonuc: ['yüksek'], kaynak: '[K] RESEARCH.md P3/P4: yüksek takip pası havalandırır' },
  },
  // --- Arkadan görülenler (measureFreeKick) ---
  supportLateral: {
    low: { neden: 'destek ayağın topa fazla yakın bastı, vuruş bacağı sıkıştı', sonuc: ['zayıf', 'falsosuz'], kaynak: '[K] Bessenouci 2019/2020: destek-top mesafesi denge ve isabeti etkiler' },
    high: { neden: 'destek ayağın topun fazla uzağına bastı', sonuc: ['zayıf'], kaynak: '[K] Bessenouci 2019/2020: ~10 cm\'den uzak destek ayağı dengeyi ve isabeti bozar' },
  },
  trunkLateral: {
    low: { neden: 'gövden destek tarafına yatmadı, dik kaldı', sonuc: ['falsosuz'], kaynak: '[K] Lees 2010: profesyonellerde temasta destek tarafına 10-16° yatış' },
    high: { neden: 'gövden destek tarafına fazla yattı', sonuc: ['yüksek'], kaynak: '[T] aşırı yatış ayağı topun altına sokar' },
  },
  approachAngle: {
    low: { neden: 'topa dümdüz koştun, açı almadın', sonuc: ['zayıf', 'falsosuz'], kaynak: '[L] Isokawa & Lees 1988: 30-45° açılı yaklaşma en hızlı vuruşu verir; düz koşu ayağı topun merkezine kilitler' },
    high: { neden: 'topa fazla yandan geldin', sonuc: [], kaynak: '[T]' },
  },
  crossing: {
    low: { neden: 'vuruştan sonra ayağın gövdenin önünden karşıya geçmedi, sarma yok', sonuc: ['falsosuz'], kaynak: '[L] Asai 2002: falso topa dışmerkezli temastan ve sarma takipten gelir' },
    high: { neden: 'vuruştan sonra ayağın gövdenin önünden fazla çaprazladı, frikik gibi sardın', sonuc: ['kıvrıldı'], kaynak: '[L] Asai 2002: sarma takip topa yan dönüş verir; düz vuruşta bu top yana kıvrılır' },
  },
};

const PROBLEM_LABEL = { 'yüksek': 'havalandı', 'zayıf': 'güçsüz gitti', 'falsosuz': 'falso almadı', 'kıvrıldı': 'yana kıvrıldı' };
const EFFECT_PHRASE = { 'yüksek': 'topu havalandırır', 'zayıf': 'vuruşu güçsüzleştirir', 'falsosuz': 'topun falso almasını engeller', 'kıvrıldı': 'topu yana kıvırır' };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// Hangi etki hangi vuruşta önemli: şutta "falso almaz" bir kusur değil, frikikte havalanmak
// kusur değil. Alakasız etki cümleye girmez (yoksa "top falso aldı" deyip "bu falsoyu engeller"
// gibi kendi kendiyle çelişen rapor çıkıyordu — gerçek videoda görüldü).
export const RELEVANT = {
  shot: ['yüksek', 'zayıf', 'kıvrıldı'],
  pass: ['yüksek', 'zayıf', 'kıvrıldı'],
  placement: ['yüksek', 'zayıf', 'falsosuz'],
  freekick: ['zayıf', 'falsosuz'],
};

/**
 * items: coach.js#evaluate(...).items. problems: outcome.js#outcomeProblems(...) Set'i.
 * mode: vuruş türü (hangi etkilerin önemli olduğu, RELEVANT). Verilmezse hepsi önemli.
 * Dönen: { bulgular: [{ ref, name, neden, sonuc, kaynak, dogrulandi, cumle, tip, drill }] (en fazla 2),
 *          aciklanamayan: [etiket] (top X yaptı ama postürde bunu açıklayan hata yok) }
 */
export function diagnose(items, problems = new Set(), mode = null) {
  const relevant = mode && RELEVANT[mode] ? new Set(RELEVANT[mode]) : null;
  const faults = [];
  for (const i of items || []) {
    if (i.score === null || i.score === undefined || i.score >= 80 || !Number.isFinite(i.value) || !i.ideal) continue;
    const dir = i.value < i.ideal[0] ? 'low' : 'high';
    const eff = EFFECTS[i.key]?.[dir];
    if (!eff) continue;
    const sonuc = relevant ? eff.sonuc.filter((s) => relevant.has(s)) : eff.sonuc;
    const acikladigi = sonuc.filter((s) => problems.has(s));
    faults.push({
      ref: i.ref, name: i.name, neden: eff.neden, sonuc, kaynak: eff.kaynak,
      dogrulandi: acikladigi.length > 0, acikladigi,
      agirlik: (100 - i.score) * (i.weight || 1),
      tip: i.tip, drill: i.drill,
    });
  }
  // Sıra: gözlenen sonucu açıklayanlar → bu vuruşta önemli bir etkisi olanlar → puan kaybı büyük olanlar.
  const hasEffect = (f) => (f.sonuc.length > 0 ? 1 : 0);
  faults.sort((a, b) => (b.dogrulandi - a.dogrulandi) || (hasEffect(b) - hasEffect(a)) || (b.agirlik - a.agirlik));
  const bulgular = faults.slice(0, 2).map((f) => ({ ...f, cumle: sentence(f) }));
  const aciklanan = new Set(faults.flatMap((f) => f.acikladigi));
  const aciklanamayan = [...problems].filter((p) => !aciklanan.has(p));
  return { bulgular, aciklanamayan };
}

function sentence(f) {
  if (f.dogrulandi) return `Top ${PROBLEM_LABEL[f.acikladigi[0]]}, çünkü ${f.neden}.`;
  const etki = f.sonuc.map((s) => EFFECT_PHRASE[s]).filter(Boolean);
  return etki.length ? `${cap(f.neden)}. Bu genelde ${etki.join(' ve ')}.` : `${cap(f.neden)}.`;
}

/** Kaynak etiketini kullanıcı diline çevirir: [K] → "Kaynak:", [L] → "Yaygın bilgi:", [T] → "Tahmin:". */
export function kaynakMetni(k) {
  return String(k ?? '')
    .replace(/\[K\]\s*/g, 'Kaynak: ')
    .replace(/\[L\]\s*/g, 'Yaygın bilgi: ')
    .replace(/\[T\]\s*/g, 'Tahmin (videolarla ayarlanacak)')
    .replace(/Tahmin \(videolarla ayarlanacak\)(?=\S)/g, 'Tahmin (videolarla ayarlanacak): ');
}

/** Açıklanamayan sonuç için dürüst not (ör. arkadan çekimde gövde öne-arka görünmez). */
export function unexplainedNote(label, angle) {
  const what = PROBLEM_LABEL[label] ?? label;
  const hint = angle === 'behind' ? ' Yandan da çekersen gövde ve destek ayağının öne-arka konumunu ölçebilirim.' : ' Arkadan da çekersen destek ayağının yanal mesafesini ve takibin yönünü ölçebilirim.';
  return `Top ${what}, ama bu açıdan görülen postürde bunu açıklayan net bir hata yok.${hint}`;
}
