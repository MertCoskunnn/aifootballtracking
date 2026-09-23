# Ölçüm Kararları: Eşikler Nereden Geliyor?

> Karar verici: Frodo, 2026-09-23. Bu belge her ölçümün **ideal aralığını** ve gerekçesini tek yerde toplar.
> `coach.js`'teki sayılar buradan gelir. Bir eşik değişirse önce bu belge değişir, gerekçesiyle birlikte.

## Üç veri kaynağı
1. **Bilimsel literatür (birincil).** Asıl metinden okunup doğrulanan değerler:
   - **[L10]** Lees, Asai, Andersen, Nunome, Sterzing (2010). *The biomechanics of kicking in soccer: A review.* J Sports Sci 28(8):805-817. [PDF](https://numerik.mi.fu-berlin.de/wiki/WS_2020/CoMaI_Dokumente/FTVS-2332-version1-the_biomechanics_of_kicking_in_soccer_a_review.pdf)
   - **[P24]** Petrolo, Howarth, Mastragostino, Corso (2024). *Kinematic determinants of the instep soccer kick in elite adult soccer players: A systematic review.* [PDF](https://drantoniopetrolo.ca/wp-content/uploads/2024/01/KINEMATIC-DETERMINANTS-OF-THE-INSTEP-SOCCER-KICK-IN-ELITE-ADULT-SOCCER-PLAYERS_A-SYSTEMATIC-REVIEW.pdf). 18 yaş üstü elit oyuncular, derledikleri çalışmalar içinde Alcock 2012 dahil.
2. **Messi (referans kontrol).** Wikimedia Commons'taki serbest lisanslı fotoğraflardan, MediaPipe Pose (heavy) ile ölçüldü:
   - **M1** "Lionel Messi vs Valladolid 3.jpg" (CC BY-SA 4.0): yandan, sol ayak, **temastan hemen önce** (bacak kurulu, destek ayağı basmış).
   - **M0** "Lionel Messi of FC Barcelona, April 11, 2009.jpg" (CC BY 2.0): arkadan, sol ayak, **kurma anı**.
   - Serbest lisanslı Messi **videosu** arandı. Bulunanlar tribünden çekilmiş (oyuncular ~40 px) ya da çizgi film. Kinematik ölçüme uygun değil. Messi verisi bu yüzden 2 kareyle sınırlı. Fotoğraflar temas anının kendisini göstermiyor, sadece yakınını.
3. **Mert'in saha videoları (gerçekçilik kontrolü).** `test-videolar/`, git'e gitmez. Otomatik tespitle bulunan iki şut:
   - **K1** (68 sn'lik video, 1.90 sn) ve **K2** (5 dk'lık video, 144.60 sn). İkisi de sağ ayak, yandan, 30 fps.

## Genel bir ölçüm dersi: 30 fps'de temas anı "bulanık"
[P24]'e göre vuran diz temas civarında **~1160°/s** açılıyor. 30 fps'de iki kare arası 33 ms, yani diz **iki kare arasında ~39° değişiyor**. Temas karesi bir kare kaysa "temas anında diz" ölçümü 39° oynar. Bu yüzden:
- Temas anı ölçümleri, temastan **önceki** son karede de ölçülür. Temas o iki kare arasında bir yerde.
- Bu ölçümlerin ağırlığı düşük tutulur ve kullanıcıya **60 fps** önerilir.

---

## Şut (ayak üstü, yandan çekim)

| # | Ölçüm (tanım) | Literatür | Messi | Mert K1 / K2 | **Seçilen ideal** | Güven |
|---|---|---|---|---|---|---|
| Ş1 | **Destek ayağı ön-arka konumu**: destek **topuğunun** top merkezine yatay uzaklığı / bacak boyu. + = topun önünde | [P24] topuk-top merkezi: bir eksende 0.33 ± 0.07 m, diğerinde 0.10 ± 0.07 m (eksen tanımı belirsiz). Erkekte "destek ayağı mesafesi" 0.27 m. [L10]: "destek ayağının yerleşimi literatürde az ilgi görmüş" | M1: -0.16 (bilek, temastan hemen önce) | -0.50 / -0.57 (bilek) | **[-0.45, -0.05]** bacak, tol 0.30 | Orta. Aralık P24'ün iki olası eksen yorumunu kapsıyor (≈0.1-0.4 m ÷ ~0.85 m bacak) |
| Ş2 | **Destek dizi büküşü** (temas) | [L10] basışta 26°, temasta 42°. [P24] elit erkek temasta 21.4 ± 7.4° | M1: 22° (temastan hemen önce) | 26° / 13° | **[15, 45]°**, tol 20 | Yüksek |
| Ş3 | **Gövde öne eğimi** (temas). + = öne, − = geriye | [L10] yetenekli oyuncular **13° (alçak şut), 17° (yüksek şut) geriye**. Profesyoneller 12° ve 0° geriye. [P24] elit 5.8 ± 8.3° geriye | M1: 6° geriye | 1° geriye / 2° öne | **[-18, 3]°**, tol 15 | Yüksek. **Eski kural [0, 20] yanlıştı**, doğru tekniğe ceza veriyordu |
| Ş4 | **Kurma**: temastan önceki ~0.7 sn'de vuran dizin en büyük büküşü | [P24] maksimum diz büküşü 93.3 ± 5.2°. Kurma evresinde diz açısı 67 ± 19° (kadın) | M1: 113° | 128° / 107° | **[85, 130]°**, tol 35 | Yüksek (2D izdüşümde ±10° sapma beklenir) |
| Ş5 | **Temas anında vuran diz büküşü**: temas karesi ve bir önceki karenin büyüğü | [P24] elit erkek **35.3 ± 10.0 – 55.0 ± 7.5°**. En yüksek diz hızı 56.9°'de | (fotoğrafta yok) | 7° / 5° (temas karesi, muhtemelen temas sonrası) | **[30, 60]°**, tol 25, **ağırlık 1** | Orta. 30 fps bulanıklığı (yukarıya bak) |
| Ş7 | **Karşı kol açıklığı**: temastan önceki ~0.3 sn'de kolun gövdeyle en büyük açısı | [P24] temasta karşı omuz 48.2 ± 11.7° abdüksiyon. [L10] kol destek ayağı basmadan önce açılıyor, temasa doğru kapanıyor (Shan & Westerhoff 2005) | M1: 38° (temastan hemen önce) | 5° / 21° (**kol görünmüyordu**) | **[35, 110]°**, tol 30. Kol noktası görünmüyorsa "ölçülemedi" | Orta |
| Ş8 | **Takip: kalça fleksiyonu**: temastan sonraki 0.5 sn'de uyluğun gövde eksenine göre en büyük öne kalkışı | [P24] takip sonunda kalça fleksiyonu **97 ± 16° (erkek)**, 86 ± 17° (kadın), diz 27 ± 20° | (fotoğrafta yok) | yeni ölçüm | **[65, 125]°**, tol 30 | Yüksek. Eski ölçüm (ayak bileği yükselişi) kamera yüksekliğine çok bağlıydı |

**Yaklaşma açısı (bilgi amaçlı, puana girmez):** [L10] oyuncuların seçtiği ~43°, en yüksek top hızı ~45°'de. [P24] elit erkekte 13°, kadında 18 ± 7°. Tek bir yan kameradan güvenilir ölçülemez.

## Frikik / falso (arkadan çekim)

| # | Ölçüm | Literatür | Messi | **Seçilen ideal** | Güven |
|---|---|---|---|---|---|
| F1 | Yaklaşma açısı (koşunun görüntü dikeyinden sapması) | [L10] eğri ve açılı koşu, ~43-45°. Eğri koşu vücudu yana yatırır ve ayağın topun altına girmesini sağlar | M0: tek kare, ölçülemez | [20, 50]°, tol 30 | Orta |
| F2 | Destek ayağının topa yanal mesafesi / bacak boyu | [P24] topuk-top merkezi 0.10-0.33 m (eksen belirsiz). [L10] az araştırılmış | M0: ~0.0 (kurma anı, ayak henüz inmemiş olabilir) | [0.05, 0.40], tol 0.25 | Düşük-orta |
| F3 | **Gövdenin yana yatışı**. **+ = vuruş yapmayan (destek) tarafa** | [L10] profesyonellerde temasta **vuruş yapmayan tarafa 10° ve 16°** | M0: destek tarafına 9° | **[5, 22]°**, tol 15 | Yüksek (yön). **Eski kural yönü ters alıyordu** |
| F4 | Kurma | Ş4 ile aynı | M0: arkadan açı büküşü küçük gösteriyor (38°) | [85, 130]°, tol 40 | Orta (arkadan açı büküşü küçük gösterir) |
| F5 | Takibin gövde önünden çaprazlaması | [L10] falsoda ayak topa **~46° hücum açısıyla** gelir (açılı falsoda 36°). Spin ~55°'ye kadar artar, sonra ayak kayar (Ozaki & Aoki 2008). Top merkezden ~8 cm kaçık vurulur (Asai 2002) | - | [0.3, 1.0] bacak, tol 0.4 | Düşük-orta |

## Pas (iç taraf, yandan çekim)
Literatürdeki sayısal veri şuttan çok daha az. [L10] ve pas isabeti çalışmaları: isabet hızla ters orantılı, destek ayağı mesafesi ve gövde açısı isabeti etkiliyor. Eşikler şutunkinden türetildi. Gövde: pas yerden gitmeli, bu yüzden **[-10, 8]°**. Aşırı geriye yaslanma pası kaldırır. Diğerleri RESEARCH.md P1-P5'teki gibi, **[T] tahmin**.

## Açık kalanlar
- **Gerçek Messi videosu:** Serbest lisanslı ve yakın çekim bir Messi vuruş videosu bulunamadı. Mert kendi indirdiği bir klibi `test-videolar/messi/` klasörüne koyarsa, aynı otomatik akış Messi'nin tam hareketini ölçer ve bu tablodaki "Messi" sütunu dolar.
- **Ş1 ekseni:** P24'teki x ve y eksenlerinin anlamı asıl çalışmada (Alcock 2012) doğrulanmalı.
- **60 fps:** Ş5 ve temas anı hassasiyeti için gerekli.
