# Neden-Sonuç Tablosu

> Uygulamanın kalbi (2026-09-24 gece). Soru: **top neden böyle gitti?** Cevap postürden gelir.
> Kod: `sebep.js` (tablo + teşhis), `outcome.js` (top ne yaptı). Kaynak etiketleri RESEARCH.md ile aynı:
> **[K]** makalede geçiyor · **[L]** literatürde/koçlukta yaygın · **[T]** bizim tahminimiz, videolarla kalibre edilecek.

## Akış
1. **Top ne yaptı?** Temastan sonraki uçuş eğrisinden okunur.
   - Yandan çekim: kalkış açısı (< 8° yerden, > 25° havalandı) ve hız (bacak boyu/sn, < 12 yavaş). [T]
   - Arkadan çekim: sağa-sola sapma (> 10°) ve falso (yana kıvrılma). [T]
   - Arkadan yükseklik, yandan sağ-sol okunmaz (2D kameranın sınırı).
2. **Postürde ne yanlış?** Puanı 80'in altındaki her ölçüm bir hata; aralığın altında mı üstünde mi olduğu yönünü verir.
3. **Bağla.** Hatanın bilinen etkisi gözlenen sonuçla eşleşiyorsa: *"Top havalandı, çünkü temas anında gövden fazla geride kaldı."* Eşleşmiyorsa ya da top okunamadıysa: *"Destek ayağın topa fazla yakın bastı. Bu genelde vuruşu güçsüzleştirir."*
4. **Nasıl düzelir?** İlk nedenin düzeltme cümlesi + tek başına yapılabilecek alıştırma.

Hangi sonuç "sorun": şut/plase/pasta havalanma sorun, frikikte değil. Frikikte falso almamak sorun. Şutta yavaşlık sorun. Sağa/sola gitmek sorun sayılmaz (hedef bilinmiyor).

## Tablo

| Açı | Ölçüm | Hata | Topa etkisi | Kaynak |
|---|---|---|---|---|
| Yandan | Gövde açısı | fazla geride | **havalanır** | [K] Lees 2010: yüksek şutta gövde 17°, alçakta 13° geride |
| Yandan | Gövde açısı | fazla öne kapanık | güçsüz | [T] |
| Yandan | Destek ayağı ön-arka | topun fazla gerisinde | havalanır, güçsüz | [L] koçluk; Lees 2010 bu bağı "az araştırılmış" sayıyor |
| Yandan | Destek ayağı ön-arka | topun önünde | güçsüz | [L] |
| Yandan | Destek dizi | kilitli (düz) | güçsüz | [K] Lees 2010: basışta ~26° bükük olmalı |
| Yandan | Destek dizi | çöken | güçsüz | [T] |
| İkisi | Kurma | yetersiz | güçsüz, falsosuz | [K] Petrolo 2024: elitlerde ~93° |
| Yandan | Takip (kalça) | kesik | güçsüz | [K] Petrolo 2024: ~97° |
| Yandan | Takip (kalça) | yukarı savrulan | havalanır | [L] |
| Yandan | Karşı kol | açılmıyor | güçsüz | [K] Lees 2010, Shan & Westerhoff 2005 |
| Yandan | Pas takibi | yüksek | havalanır | [K] RESEARCH.md P3/P4 |
| Arkadan | Destek ayağı yanal | topa fazla yakın | güçsüz, falsosuz | [K] Bessenouci 2019/2020 |
| Arkadan | Destek ayağı yanal | topa fazla uzak | güçsüz | [K] Bessenouci 2019/2020 (~10 cm) |
| Arkadan | Gövde yana yatış | dik kalmış | falsosuz | [K] Lees 2010: temasta destek tarafına 10-16° |
| Arkadan | Gövde yana yatış | fazla | havalanır | [T] |
| Arkadan | Yaklaşma açısı | dümdüz | güçsüz, falsosuz | [L] Isokawa & Lees 1988: 30-45° en hızlısı |
| Arkadan | Takip yönü | sarma yok | falsosuz | [L] Asai 2002 |

## Dürüstlük
- Etki yönleri kaynaklı ya da yaygın bilgi; **eşik sayıları çoğunlukla [T]**. Mert'in etiketli videolarıyla ("top havalandı", "iyiydi") kalibre edilecek.
- Top bir karede yanlış okunursa teşhis tahmin diline düşer, "çünkü" demez.
- Postürde açıklanamayan bir sonuç varsa uygulama bunu açıkça söyler ve diğer açıdan çekim önerir.
