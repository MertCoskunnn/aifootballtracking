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
   - Serbest lisanslı Messi videosu Wikimedia'da bulunamadı (tribün çekimi ya da çizgi film).
   - **MV1, MV2: Mert'in eklediği video**, "Lionel Messi Amazing Freekick Goal in Training _ HD.mp4" (`test-videolar/`, git'e gitmez). 720p, 25 fps, yandan sabit kamera, antrenmanda iki frikik, sol ayak. MV1 (6.10 sn) otomatik bulundu. MV2 (14.33 sn) hareket bulanıklığı yüzünden otomatik bulunamadı, temas karesi elle işaretlendi. Destek bacağı kameradan uzak tarafta kaldığı için görünmüyor (görünürlük < 0.5), destek ölçümleri "ölçülemedi".
3. **Mert'in saha videoları (gerçekçilik kontrolü).** `test-videolar/`, git'e gitmez. Otomatik tespitle bulunan iki şut:
   - **K1** (68 sn'lik video, 1.90 sn) ve **K2** (5 dk'lık video, 144.60 sn). İkisi de sağ ayak, yandan, 30 fps.

## Genel bir ölçüm dersi: 30 fps'de temas anı "bulanık"
[P24]'e göre vuran diz temas civarında **~1160°/s** açılıyor. 30 fps'de iki kare arası 33 ms, yani diz **iki kare arasında ~39° değişiyor**. Temas karesi bir kare kaysa "temas anında diz" ölçümü 39° oynar. Bu yüzden:
- Temas anı ölçümleri, temastan **önceki** son karede de ölçülür. Temas o iki kare arasında bir yerde.
- Bu ölçümlerin ağırlığı düşük tutulur ve kullanıcıya **60 fps** önerilir.

---

## Ham ölçümler: Messi videosu ve Mert (2026-09-23, eski ölçüm tanımlarıyla)
| Ölçüm | MV1 | MV2 | Mert K1 | Mert K2 |
|---|---|---|---|---|
| Kurma (diz büküşü, max) | 107° | 113° | 128° | 107° |
| Temas anında vuran diz | 32° | 32° | 54° | 5° (bir kare geç) |
| Gövde öne eğimi | +2° | −2° | −2° | +2° |
| Takip: ayak bileği yükselişi (bacak boyu) | 0.61 | 0.53 | 0.25 | 0.12 |
| Destek dizi / destek konumu | görünmüyor | görünmüyor | görünmüyor / −0.62 | 13° / −0.57 |

Okuma: Messi'nin temas dizi iki vuruşta da 32°, yani çok tutarlı. P24'ün 35–55° aralığının hemen altında, frikikte (yerleştirme vuruşu) beklenebilir. En büyük fark takipte: Messi'nin ayağı Mert'inkinden 2–4 kat yükseğe devam ediyor.

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

## Son doğrulama (cp-08, 2026-09-23): yeni kurallarla puanlar
Uygulamanın kendi kodu (vision → detect → metrics → coach) gerçek videolarda çalıştırıldı:

| Vuruş | Toplam | Ş1 destek | Ş3 gövde | Ş4 kurma | Ş5 diz* | Ş7 kol | Ş8 takip | Odak |
|---|---|---|---|---|---|---|---|---|
| **Messi MV1** (otomatik) | **100** | görünmüyor | 2° ✓ | 107° ✓ | 32° | 44° ✓ | 104° ✓ | - |
| **Messi MV2** (elle) | **100** | görünmüyor | −2° ✓ | 113° ✓ | 32° | görünmüyor | 92° ✓ | - |
| Mert K1 (otomatik) | 82 | −0.64 ✗ | −2° ✓ | 128° ✓ | 54° | 54° ✓ | 89° ✓ | Ş1 |
| Mert K2 (otomatik) | 88 | −0.55 ~ | 2° ✓ | 107° ✓ | 5° | 81° ✓ | 58° ~ | Ş8, Ş1 |

\* **Ş5 kararı:** 30 fps'de puana katılmıyor. Gerçek veride art arda üç karede vuran diz 128° → 54° → 7° değişti. Komşu karelere bakan iki kural denendi ("öncekinin büyüğü" ve "ayak ucu topa en yakın"), ikisi de yanıldı. Ölçüm raporda "bilgi" olarak gösteriliyor, 50+ fps'de puana giriyor. Messi iki vuruşta da tutarlı olarak 32° veriyor. Bu değer bilgi olarak değerli ama tek karelik zamanlamaya bağlı.

**Okuma:** Kurallar Messi'yi elit sayıyor (100), Mert'te de somut ve literatüre dayalı iki fark buluyor: destek ayağı topun fazla gerisinde ve takip kısa. Eski kurallar Messi'ye 63 vermişti.

## Açık kalanlar
- **Gerçek Messi videosu:** Serbest lisanslı ve yakın çekim bir Messi vuruş videosu bulunamadı. Mert kendi indirdiği bir klibi `test-videolar/messi/` klasörüne koyarsa, aynı otomatik akış Messi'nin tam hareketini ölçer ve bu tablodaki "Messi" sütunu dolar.
- **Ş1 ekseni:** P24'teki x ve y eksenlerinin anlamı asıl çalışmada (Alcock 2012) doğrulanmalı.
- **60 fps:** Ş5 ve temas anı hassasiyeti için gerekli.

---

## Referans taraması (cp-14, 2026-09-24 gecesi)
18 YouTube klibi (Ronaldo, Messi, Neymar, amatör bireysel idman, arkadan frikik) uygulamanın kendi hattıyla (`tests/referans.html`) tarandı. Ham sonuçlar yerelde `test-videolar/referans/SONUCLAR.md` (git dışı, klipler telifli).

**Karar: hiçbir eşik değiştirilmedi.** Gerekçe: veri az ve dağınık, kural gereği eşik değişikliği veriye dayanmalı.

| Bulgu | Sayı | Sonuç |
|---|---|---|
| Profesyonel yayın klipleri (Ronaldo, Messi) | açı arkadan/önden, ayak yanlış (Messi solak → "sağ"), kamera hareketli | Yandan kural kalibrasyonuna **uygun değil** |
| Tek madde ölçülüp 100 puan (Ronaldo arkadan) | 1/7 ölçüm | → **cp-14a**: kapsam < %50 ise puan yok |
| İmkânsız değerler (destek dizi 117°, gövde -85°) | birkaç vuruş | → **cp-14c**: makul aralık filtresi |
| Amatör klipte vuruş bulunamaması | 3/10 klip | Açık: vuruş bulma, düşük çözünürlük/uzak çekimde zayıf |
| Açı "bilinmiyor" | 5/8 amatör vuruş | Açık: **en zayıf halka**. Omuz genişliği denemesi başarısız (`deneme/aci-tespiti-omuz`) |
| Amatörlerde destek ayağı (Ş1) | -0.26 … -1.25 bacak | Mert K1/K2 ile aynı desen: hedef kullanıcının en yaygın hatası. Ş1 ağırlığı (3) yerinde |
| Hareketli top eşiği (5 çap/sn) | amator-sut-1: 10 → hareketli; Mert K2: 3.2 → duran | Tutarlı |
| PL4 diz açısal hızı oranı | 28 … 1257 | Tanım kararsız (yaklaşma hızı ~0'da oran patlıyor), bilgi olarak kalmalı, yeniden tanımlanmalı |

**Kalibrasyon için gereken veri:** yandan, sabit telefonla çekilmiş, tek oyunculu, tam vücut kadrajda videolar. En iyi kaynak Mert'in kendisi (hedef kullanıcı): 5 ayak üstü, 5 plase, 5 sürerek vuruş; arkadan 2-3 frikik.

## 3D referans: doksana plase (v1, 2026-09-25)

**Karar (Mert):** İlk tam sürüm tek teknik: sol ayak sağ doksana, sağ ayak sol doksana. Referans
Messi'nin idman frikiği, sağ ayak için aynalanır. Puan sadece **temas anındaki postürün** Messi'ye
yakınlığı. Koşu ve topun gidişi puana girmez.

**Neden 3D:** 2D açı, bükülme kameraya doğru olduğunda kısalır. MediaPipe'ın 3D (world) noktalarından
hesaplanan eklem açısı kameradan bağımsızdır (test: iskelet 90° döndürülünce fark < 0.5°). Tek
kameradan 3D bir tahmindir, kusursuz değildir; aşağıdaki gürültü bandı bu yüzden var.

**Aynalama:** Ölçüler sağ/sol değil vuran/destek tarafına göre tanımlı. Sağ ayaklının destek dizi
Messi'nin destek diziyle kıyaslanır (test: aynalanmış iskelet birebir aynı ölçülür).

**Ölçüm (tests/postur.html, temas ±2 kare medyanı, tekrar eden kareler atıldı):**

| Açı (°) | MV1 (6.10 sn, otomatik) | MV2 (14.40 sn, elle) | Referans (ortalama) | Gürültü bandı |
|---|---|---|---|---|
| Destek dizi | 40.4 | 24.9 | 32.7 | ±10 |
| Vuran diz | 37.7 | 38.7 | 38.2 | ±8 |
| Vuran uyluk (+ önde) | 52.4 | 52.6 | 52.5 | ±8 |
| Gövdenin öne eğimi (+ öne) | 2.0 | −0.1 | 0.9 | ±5 |
| Gövdenin yana yatışı (+ destek tarafına) | −5.9 | −1.3 | −3.6 | ±5 |
| Karşı kol | 18.6 | 3.8 | 11.2 | ±15 |

- Vuran diz ve uyluk iki vuruşta neredeyse aynı: tekniğin en tutarlı imzası.
- İnceleme (ikinci Opus, 2026-09-25) sonrası: gövde eğimi ve uyluk artık işaretli ve vücut
  eksenlerine göre (ön eksen = burun + destek ayağının ucu). Eskiden gövde eğimi dikeyden toplam
  sapmaydı: yana yatışı da sayıyordu, geriye yaslanan biri öne eğik Messi'yle aynı puanı alıyordu.
  Messi'nin temas anında gövdesi neredeyse dik; eski 6-9° "eğim" yana yatıştı.
- Bilinen sınır: dikey eksen kameranın dikeyi. Telefon θ derece eğik tutulursa gövde açıları ~θ kayar.
  v1 kuralı: telefon düz ve sabit.
- Destek dizi ve kol iki vuruş arasında 14-15° oynuyor. Bu Messi'nin değişkenliği mi, 3D tahminin
  gürültüsü mü, ayrılamıyor: 25 fps bulanık görüntü, destek bacağı kısmen kapalı. Tek karede
  destek dizi arka arkaya 23°, 50°, 14° okunabiliyor.
- Gürültü bandının içindeki fark ceza almaz, dışında bandın ötesindeki fark doğrusal düşer
  (POSTURE_TOL). Messi iki vuruşunda da 100 alıyor.
- MV2'de eski elle işaretlenen temas (14.33) yanlıştı: o karede top hâlâ yerinde. Kare kare
  bakınca temas 14.40.
- **Hedef (Mert):** Messi'nin vuruşu sağ doksan, **yakın köşe**. Aynı ayakla karşı köşe (sol doksan)
  ya da uzak köşe ayrı tekniktir (koşu açısı, kalçanın hedefe dönüşü, temas yüzeyi farklı), ayrı
  referans ister. Aynalama sadece ayak değişiminde geçerli, hedef değişiminde değil.
- **Bilinen sınır:** 6 açı hedef yönünü içermiyor, uygulama sağ doksana nişan alındığını doğrulayamaz,
  varsayar. v2 fikri: kullanıcı ilk karede kaleyi bir kez gösterir, kalça/omuz dönüşü hedefe göre ölçülür.
- **Açık:** Bant ve toleranslar [T]. Mert'in 60 fps videoları (aynı vuruş yandan+arkadan) ile
  açıdan bağımsızlık ve gerçek ayrışma ölçülecek.

**İlk deneme: 2026-09-24 akşamı gelen 8 kısa klip** (test-videolar kökü, 1080p WhatsApp; Mert'in
kendisi değil, farklı oyuncular, çoğu arkadan/önden). Tek ayak seçilerek aynalanmış Messi'ye göre:

| Klip | Temas | Algılanan ayak | Sağ ayak puanı | Sol ayak puanı |
|---|---|---|---|---|
| mert.mp4 | 0.53 | sol | 71 | 73 |
| 19.11.mp4 | 2.80 | sağ | 87 | 87 |
| 19.11.21 (2) | 1.93 | sol | 83 | 79 |
| (2)_1 | 1.10 | sol | 84 | 86 |
| (2)_2 | 0.40 | sol | 59 | 68 |
| (2)_3 | vuruş bulunamadı | | | |
| (2)_4 | 0.30 | sağ | 50 | 55 |
| (2)_5 | 1.07 | sağ | 90 | 86 |

- Puanlar 50-90, Messi 100: ölçü ayrıştırıyor. **Doğru ayrıştırıp ayrıştırmadığı bilinmiyor:** hangi
  vuruşun iyi olduğu, hangi ayakla hangi doksana gittiği Mert'ten öğrenilecek.
- Algılanan ayak iki klipte görüntüyle uyuşmuyor gibi (arkadan çekimde sol/sağ karışması). v1'de ayak
  kullanıcı seçimi olduğu için puanı etkilemiyor.
