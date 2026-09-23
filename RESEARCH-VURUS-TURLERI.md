# Araştırma: Plase ve Hareketli Topa Vuruş

> Araştırmacı: Sonnet (gece planı, checkpoint "araştırma"). Planlayıcı ve karar verici: Frodo.
> Amaç: Ş1–Ş8 (şut) ve P1–P5 (pas) gibi, **plase** ve **hareketli topa vuruş** için de kaynağa dayalı
> parametre setleri önermek. Hedef kullanıcı sahada tek başına idman yapan oyuncu; her parametre
> "yarın sahada ne değiştirirsen bu sayı düzelir" sorusuna cevap vermeli.
> Durum: v0.1 (2026-09-23 gece). Bu belge bir **öneri**dir, coach.js'e hiçbir şey otomatik girmedi.

## Güven seviyesi etiketleri
- **[K]** Kaynaklı: aşağıdaki bir kaynakta doğrudan geçiyor (tam metinden veya güvenilir özetten teyitli).
- **[özet]** Sadece makale özetinden/üçüncü taraf özetinden alındı, tam metin görülemedi (ödeme duvarı).
- **[L]** Literatürde yaygın/tekrar eden bulgu, kesin sayı yok.
- **[T]** Teknik tahmin: bizim mühendislik kararımız, sahada kalibre edilecek.

---

## Frodo için özet

1. **Plase, zayıflatılmış bir pas değil, zayıflatılmış bir frikiktir.** Alcock (2012) elit kadın
   oyuncularda maksimal frikik (curve) ile maksimal şutu (instep) karşılaştırmış: **temas anındaki ayak
   hızı ikisinde de aynı**, ama hıza ulaşma yolu farklı — şutta yaklaşma hızı ve kalça/diz **doğrusal**
   hızı yüksek, frikikte temas anındaki diz **açısal** hızı yüksek. Plase de aynı aileden: güç değil,
   dizin açılma hızı ve destek ayağının açısı işi görüyor.
2. **En kolay eklenecek 3 parametre:** (a) **PL4 – diz açısal hızı / yaklaşma hızı oranı** (Alcock 2012'nin
   doğrudan bulgusu, şut ile plaseyi ayıran en net kinematik imza), (b) **H1/H2 – hareketli topta destek
   ayağı topa daha uzak durur ve destek kalçası daha çok açılır**, bu ikisi birlikte topun hızını
   duran topla aynı tutmayı sağlıyor (Palucci Vieira ve ark. 2019), (c) **H3 – hareketli topa vuruşta
   kurma (diz büküş genliği) küçülür**, tam kurma için zaman yoktur (Egan ve ark. 2007).
3. **Otomatik ayrımda en güvenilir tek sinyal top hızı:** temastan önce top zaten hareket ediyorsa
   (oyuncunun kendi sürdüğü top ya da bir arkadaşından gelen top) → hareketli topa vuruş modu. Şut ile
   plaseyi ayırmak daha zor: ayak hızı benzer çıkabilir (Alcock 2012), bu yüzden **PL4 oranı + destek
   ayağı mesafesi + takip yönü** üçlüsüne bakmak gerekir.
4. **2D yandan kamerada plasenin can alıcı bilgisi kayıp.** Falsoyu üreten şey topa **dışmerkez ve
   yanal** temas ile ayağın **dışa dönüşü** — ikisi de kameranın derinlik ekseninde, tıpkı frikikte
   olduğu gibi yandan görünmüyor. Plase modu bu yüzden şut/pasla aynı kamerada asla "frikik kadar" tam
   ölçülemez; sadece dolaylı imzalar (diz açısal hızı, takip yönü, destek ayağı mesafesi) yakalanabilir.
5. **Hareketli topa vuruş literatürü ince ve neredeyse tamamen futsal/lab kaynaklı**, çoğu düşük hızlı
   (~2.2 m/s) yuvarlanan toplarla yapılmış. Sahada koşarak sürülen ya da uzun bir pastan gelen daha
   hızlı bir topla ilgili doğrudan veri yok — bu yüzden bu bölümdeki eşiklerin çoğu diğer bölümlerden
   daha fazla **[T]** taşıyor; yön (daha uzak destek ayağı, daha fazla kalça ekstansiyonu, daha kısa
   kurma) kaynaklı ama santimetre/derece cinsinden kesin eşik yok.

---

## 1. Plase (iç taraf / yerleştirme bitiriş, falsolu uzak köşe)

### 1.1 Pas modundan (P1–P5) farkı
Pas: top yerden gider, güç değil isabet hedefi, destek ayağı hedefe **dönük**, vuruş ayağı topun
**merkezine** yakın değer, takip kısa ve hedefe doğru düz. Plase ise bir **curl** üretir: hedef genelde
uzak köşedir, top havada hafif eğri çizer. Bunu sağlayan üç şey — (1) destek ayağı hedefin biraz
**dışına** bakar (Alcock 2012), (2) vuruş ayağı topu **dışmerkez** keser (RESEARCH.md F5, Asai 2002
ile aynı fizik), (3) takip gövdenin önünden **karşı tarafa doğru sarar**. P1 (destek konumu) ve P3
(gövde açısı) muhtemelen pas ile aynı kalıyor — ayrı bir çalışma bulunamadı, bu yüzden bu ikisi için
**yeni bir sayı önerilmiyor**, pastaki değerler kullanılabilir.

**Kamera notu:** Plase, şut ve pas gibi **yandan** çekiliyor (oyuncu kaleye doğru koşarken kamera
yan taraftan bakıyor). Bu, curl'ün fiziksel kaynağını (yanal temas noktası, ayağın dışa dönüşü) gizler
— bkz. §5. Aşağıdaki parametreler bu kısıtla **uyumlu**, yani yandan kamerada gerçekten ölçülebilir
sinyaller seçildi.

### Parametre tablosu

| # | Ölçüm | Tanım (2D yandan, nasıl ölçülür) | İdeal aralık | Kaynak | Güven |
|---|---|---|---|---|---|
| PL1 | **Yaklaşma açısı** | Temastan önceki ~10 karede kalça-orta noktasının izlediği yönün görüntü dikeyinden sapması | **[20, 40]°**, tol 20 | [K] Carlsson ve ark. 2018 (JSSM 17(1):74-81): iç taraf vuruşunda hareketli topa 30° yaklaşımda isabet hatası 0.76±0.29 m, 0°'de 1.09±0.46 m, 60°'de 0.99±0.32 m — 30° civarı en isabetli. **Not:** bu çalışma tam "plase" değil, hareketli topa isabet odaklı iç taraf vuruşu; yön ve büyüklük olarak en yakın kaynaklı sayı bu | Orta |
| PL2 | **Destek ayağı ön-arka mesafesi** | Ş1/P1 ile aynı yöntem: destek topuğu – top merkezi, bacak boyuna oranlı | **[-0.2, 0.1]** bacak (P1 ile aynı), tol 0.3 | [T] Ayrı bir plase çalışması yok. Hay 1993 (Kellis & Katis 2007'de aktarılan, doğrulanmamış): "topuk topun 5-10 cm gerisine, 5-28 cm yanına basmalı" — yön tutarlı ama plaseye özgü değil | Düşük |
| PL3 | **Destek ayağının yönü**: ayak ucunun (foot_index) topuğa göre açısı, hedef çizgisine göre | Destek ayağı ucu **hedefin biraz dışına** dönük (sağ ayaklı oyuncuda sağa) | **> 10°** dışa dönük [T], yön [K] | [K] Alcock 2012: "point the support foot to the right of the intended target (for right-footed players)" (curl elde etmek için). Sayısal eşik verilmemiş | Düşük (yön [K], eşik [T]; **2D yandan kamerada ölçümü de zor**, bkz §5) |
| PL4 | **Diz açısal hızı / yaklaşma hızı oranı**: temastan önceki ~0.3 sn'de vuran dizin açı değişim hızı (°/sn) ÷ kalça-orta noktasının yatay hızı (bacak boyu/sn) | Şuttan **belirgin yüksek** oran | **> 1.5× şutun tipik oranı** [T] | [K] Alcock 2012: curve kickte "foot velocity at ball impact did not differ" ama curl "greater knee angular velocity at impact" ile üretiliyor, instep ise "faster approach velocity and greater linear velocities of the hip and knee" ile. Yön net, sayısal eşik makalede yok (özet düzeyinde erişildi) | Orta (yön [K]/[özet], eşik [T]) |
| PL5 | **Takibin çaprazlaması**: temastan sonra vuran ayak bileğinin görüntüdeki yatay konumu, destek ayağına göre karşı tarafa geçiş miktarı (bacak boyuna oranlı) | Belirgin pozitif çaprazlama, ama F5 (frikik, arkadan) kadar net görünmez | **[0.15, 0.6]** bacak [T], F5'in yarısı kadar (yandan kamerada çapraz hareketin bir kısmı derinlik eksenine kaçar) | [K] yön: Alcock 2012 "swing the kicking limb across the face of the goal". Eşik [T] | Düşük-orta |
| PL6 | **Temas noktası yüksekliği**: vuran ayağın top merkezine göre dikey konumu, temas karesinde | Topun **alt yarısına** yakın (üstten kesme değil) | **[T]**, sayısal aralık yok | [T] Coaching kaynağı (lab değil): Messi/Neymar teknik analizleri "hit the bottom half of the ball, outer centre" diyor — **doğrulanmamış, düşük güven** | Düşük |

### Bireysel idman çevirisi
- **PL1 (yaklaşma açısı):** "Topa dümdüz koşma, hafif çapraz bir çizgiyle yaklaş — düz koşu topu merkeze kilitler, falso gitmez." *Drill:* Kaleye 30-35° açıyla 5 adımlık bir koşu çizgisi belirle (huni ya da çizgiyle işaretle), her seferinde aynı çizgiden yaklaş, 10 tekrar.
- **PL2 (destek ayağı):** "Destek ayağını topun tam yanına bas, çok geriden uzanma." *Drill:* Topun yanına bir çizgi çiz, destek ayağın her seferinde o çizgiye değecek şekilde 10 vuruş.
- **PL3 (destek ayağı yönü):** "Destek ayağının ucu tam hedefe değil, hedefin biraz dışına baksın — bu, vuruş bacağının topu sarmasına yer açar." *Drill:* Hedefin 1-2 adım dışına bakan bir koni koy, destek ayağı ucunu ona hizala.
- **PL4 (diz açısal hızı):** "Yaklaşırken yavaşla, gücü bacağını koşturmaktan değil dizini hızlı çözmekten al." *Drill:* Yürüyerek ya da yarı hızda yaklaş, sadece son adımda dizi hızlı boşalt, topu köşeye yerleştir — hız değil, dizin "çakma" hissi hedef.
- **PL5 (takip):** "Vurduktan sonra ayağını durdurma, karşı omzuna doğru sarmaya devam et." *Drill:* Vuruştan sonra ayak bileğinin karşı bacağını geçmesini bilinçli hedefle, aynadan ya da video ile kontrol et.
- **PL6 (temas yüksekliği):** "Topun tam ortasına değil, biraz altına ve dışına vur." *Drill:* Topun üstüne tebeşirle bir nokta koy (merkezin biraz altı-dışı), o noktayı vurmayı hedefle.

---

## 2. Hareketli Topa Vuruş (kendi sürdüğü topa koşarak vurma / ilk dokunuşta bitirme)

### 2.1 Duran topa göre ne değişir
Literatür üç ayrı bulguyu birleştiriyor:
- **Yaklaşma ve destek ayağı birlikte ayarlanıyor.** Palucci Vieira ve ark. (2019, futsal, duran top vs
  yuvarlanan top): hareketli topa vurulurken **destek ayağı-top mesafesi uzuyor** ve **yaklaşma koşu
  hızı düşüyor**; bunu telafi etmek için **destek bacağın kalçası daha fazla ekstansiyona** gidiyor —
  sonuçta top hızı duran topla **benzer** kalıyor. **[özet]**: tam metne erişilemedi (ödeme duvarı),
  sadece özet doğrulandı, santimetre/derece büyüklüğü yok, sadece yön var.
- **Kurma küçülüyor.** Egan, Verheul, Savelsbergh (2007, Journal of Motor Behavior 39(5):423-432):
  deneyimli oyuncular hareketli topu (dıştan zamanlanmış vuruş) vururken vuran dizin hareket genliğini
  **küçültüyor**, ama proksimalden-distale sıralamayı (kalça→diz→ayak bileği) koruyor. Deneyimsiz
  oyuncularda bu uyum yok, isabet de düşük.
- **Güç kaybolmuyor, ayarlanıyor.** Barbieri ve ark. (2010, futsal): duran top (top hızı 24.2±2.2 m/s)
  ile 2.2 m/s'ye kadar yuvarlanan top (23.8±2.7 m/s) arasında top hızında **anlamlı fark yok**
  (Kellis & Katis 2007'de aktarılan Tol ve ark. 2002 da aynı yönde: 2.2 m/s yuvarlanan topla anlamlı
  fark yok). **Önemli sınır:** bu sayılar futsal'da ve **düşük hızlı** bir yuvarlanan topla; sahada
  uzaktan gelen hızlı bir pasa ilk dokunuşta vurmakla aynı şey değil — o senaryo için doğrudan veri yok.

### Parametre tablosu

| # | Ölçüm | Tanım (2D yandan, nasıl ölçülür) | Duran topa göre değişim | Kaynak | Güven |
|---|---|---|---|---|---|
| H1 | **Destek ayağı-top mesafesi** (Ş1 ile aynı yöntem, ön-arka) | **Daha uzun** mesafe kabul edilebilir | Ş1'in üst sınırından biraz daha geniş tolerans: **[-0.55, -0.05]** bacak, tol 0.35 [T büyüklük] | [özet] Palucci Vieira ve ark. 2019: rolling ball → "longer support foot to ball distance" (yön [K], büyüklük yok) | Düşük-orta |
| H2 | **Destek bacağın kalça ekstansiyonu**: temas anında destek uyluğunun gövdeye göre arkaya açılma derecesi | **Daha fazla** ekstansiyon, düşük yaklaşma hızını telafi ediyor | **[T]**, sayısal aralık yok, sadece "duran topa göre daha büyük" yönü | [özet] Palucci Vieira ve ark. 2019: "hip adjustments (greater extension) in the support limb... compensating for the lower approach run velocity and longer support foot to ball distance" | Düşük-orta (yön [K]/[özet], eşik [T]) |
| H3 | **Kurma (vuran dizin geri salınım genliği)**, Ş4/PL ile aynı yöntem | **Daha küçük** genlik, tam kurmaya zaman yok | Ş4'ün alt ucundan **%20-30 daha dar** bir pencere: **[70, 115]°** [T], tol 30 | [K] Egan, Verheul, Savelsbergh 2007: hareketli topta "smaller range of movement at the knee of the kicking leg", proksimodistal sıralama korunuyor | Orta (yön [K], eşik [T]) |
| H4 | **Yaklaşma hızı** (son 2 adımda kalça-orta noktasının yatay hızı, bacak boyu/sn) | **Daha düşük** olabilir, H1/H2 telafi ediyor | **[T]**, sayısal aralık yok | [özet] Palucci Vieira ve ark. 2019: rolling ball → "lower approach run velocity" | Düşük (yön [özet], eşik [T]) |
| H5 | **Zamanlama penceresi**: temas karesinin, topun oyuncuya en yakın olduğu kareye göre kayması | Hareketli topta temas penceresi duran topa göre **daha dar** (top da hareket ettiği için oyuncunun hata payı azalır) | **[T]**, sayısal eşik yok, sadece uygulamanın temas-önerisi algoritmasına not | [L] Genel bulgu: hareketli/dıştan-zamanlanmış görevlerde motor kontrol daha ince ayarlı (Egan 2007'nin genel çerçevesi), kesin pencere sayısı verilmiyor | Düşük |

**H4 ve H5 not:** Bunlar "hoca kuralı" olarak puana girecek kadar sağlam değil — bilgi amaçlı gösterilip
kalibrasyon bekleyebilir (Ş5'in 30 fps'de aldığı yol gibi). H1, H2, H3 daha somut ve doğrudan bir
düzeltme cümlesine çevrilebilir.

### Bireysel idman çevirisi
- **H1 (destek ayağı mesafesi):** "Topu sürerken destek ayağını tam yanına değil, biraz daha geriye bas — topa yetişmeye çalışırken ayağın öne kaçmasın." *Drill:* Topu 3-4 adım sür, son adımda destek ayağını bilinçli olarak topun biraz gerisine bas, 10 tekrar.
- **H2 (kalça ekstansiyonu):** "Destek bacağını arkaya doğru daha fazla aç, bu sana koşarken kaybettiğin gücü geri verir." *Drill:* Yavaş tempoda topu sür, destek bacağının vuruş anında iyice arkaya açıldığını hisset (abartılı prova, sonra doğal hıza dön).
- **H3 (kurma):** "Koşarken topu kurmaya çalışma, tam kurma için zamanın yok — bacağını erken ve kısa boşalt." *Drill:* Topu sürüp vururken bilinçli olarak "kısa vuruş" hissiyle, geri salınımı abartmadan 10 tekrar.
- **H4/H5 (zamanlama):** "Son iki adımı topa göre ayarla, adımların kısalıp sıklaşsın, gözün topta kalsın." *Drill:* Topu değişen hızlarda sürüp aynı noktadan vurmayı dene, adımlarının kendiliğinden ayarlandığını hisset.

---

## 3. Frikik ile plase arasında karışan noktalar

| Nokta | Frikik (F, arkadan) | Plase (PL, yandan) | Karıştırma riski |
|---|---|---|---|
| Gövdenin yana yatışı | F3: arkadan net ölçülür, destek tarafına 5-22° | PL'de ayrı bir satır yok — yandan kamerada yana yatış görüntü düzlemine **dik** olduğu için düz gövde açısından (PL'nin pas'tan devraldığı P3) ayırt edilemez | Yüksek. Uygulama iki modu **karıştırmamalı**: gövde açısı ölçümü F3'te "yana yatış", PL'de (P3 mirası) "öne-arkaya eğim" — aynı isimle farklı fiziksel açı, kodda net ayrılmalı |
| Takibin çaprazlaması | F5: arkadan, bacak boyuna oranlı net bir yatay mesafe | PL5: yandan, aynı fiziksel olay ama daha zayıf sinyal (derinliğe kaçan kısmı kayıp) | Orta. PL5'in ideal aralığı F5'in **yarısı** olarak öneriliyor, bu tahmini bir düzeltme — kalibrasyonda test edilmeli |
| Kurma (backswing) | F4: [85,130]°, Ş4 ile aynı kaynak | PL'de ayrı satır yok, muhtemelen Ş4/F4 ile aynı | Düşük — muhtemelen aynı sayı kullanılabilir, ayrı çalışma yok |
| Yaklaşma açısı | F1: [20,50]°, [T] eşik, arkadan proxy | PL1: [20,40]°, Carlsson 2018'den kaynaklı | Orta. İkisi de "diyagonal yaklaşım" fikrini paylaşıyor ama farklı kaynaktan geliyor, kod içinde **ayrı sabitler** olarak tutulmalı, "aynı sayı" varsayılmamalı |
| Kamera | Arkadan/çapraz arkadan, oyuncu kameradan uzaklaşır/yaklaşır | Yandan, oyuncu kameranın önünden geçer | Düşük — kamera açısı zaten modları ayırıyor, otomatik tespitte görünürlük paterni (bkz §4) güvenilir bir ayraç |

---

## 4. Otomatik ayrım sinyalleri

Uygulama şu an modu kullanıcı seçiyor (`app.js`). Otomatik öneri için iskelet+top verisinden çıkarılabilecek sinyaller:

| Ayrım | Sinyal | Öneri eşik | Dayanak | Güven |
|---|---|---|---|---|
| **Duran top vs hareketli top** | Temastan önceki ~0.5 sn'de topun kendi merkezinin kare-kareye yer değiştirme hızı (bacak boyu/sn normalize) | Top hızı **> 0.15 bacak boyu/sn** → hareketli top kabul et | [T] Normalize eşik bizim tasarımımız. Yön tutarlılığı: Tol 2002 ve Barbieri 2010'un kullandığı "yuvarlanan top" tanımı ~2.2 m/s (mutlak, sahne kalibre edilmemiş bir uygulamada karşılığı yok) | Düşük-orta |
| **Güçlü şut vs plase** | PL4 (diz açısal hızı / kalça yatay hızı oranı) + destek ayağı mesafesi (uzak/geniş vs Ş1'in dar aralığı) + takip yönü (çapraz vs düz) | Üç sinyalin **en az ikisi** plase yönünde ise plase öner | [K] Alcock 2012 (oran), [T] (eşik ve üç-sinyal birleşimi) | Düşük-orta. Tek sinyale güvenilmemeli — Alcock 2012 ayak hızının **aynı** çıkabildiğini gösteriyor, yani "ayak hızı düşükse plase" gibi basit bir kural yanıltıcı olur |
| **Hareketli topa vuruş vs plase (ikisi de düşük güçle yapılabilir)** | H1/H2 (destek ayağı mesafesi + kalça ekstansiyonu) **birlikte** yüksekse hareketli topa vuruş sinyali güçlenir; PL3/PL4 (destek ayağı açısı, diz açısal hızı oranı) yüksekse plase sinyali güçlenir | İki sinyal grubunu **çapraz kontrol et**, tek başına ayırt edici değil | [T] | Düşük |
| **Frikik vs diğer üçü** | Zaten kamera açısı/görünürlük paternine dayanıyor (RESEARCH.md'deki mevcut mantık) | Değişmiyor | [K] mevcut tasarım | Yüksek |

**Dürüstlük notu:** Şut/plase ayrımı literatürde net bir eşikle desteklenmiyor; Alcock 2012'nin bulgusu
("ayak hızı aynı olabilir") aslında basit hız-tabanlı bir ayrımı **çürütüyor**. Otomatik ayrım bu yüzden
tek sinyale değil, birden fazla zayıf sinyalin birleşimine dayanmalı ve düşük güvenle sunulmalı
(örn. "muhtemelen plase, emin değilim" gibi), kullanıcı onayı olmadan sessizce mod değiştirmemeli.

---

## 5. 2D tek kamera sınırları

- **Topa temas noktasının merkeze göre yanal (dış-merkez) offseti** — falsonun/curl'ün asıl fiziksel
  kaynağı (Asai 2002, RESEARCH.md F5). Yandan kamerada bu offset kameranın **derinlik ekseninde**,
  hiç görünmez. PL modunda bu yüzden temas noktası sadece **dikey** eksende (PL6, üst/alt) tahmin
  edilebiliyor, yanal eksende hiç ölçülemiyor.
- **Ayağın dışa dönüş açısı** (destek ayağı PL3, vuruş ayağı topa değerken) — yatay düzlemdeki bir
  rotasyon, yandan kamerada foreshortening (kısalma) dışında iz bırakmaz. Üstten ya da 45° çapraz bir
  kamera gerekir.
- **Kalçanın iç/dış rotasyonu (pelvis twist)** — Levanon & Dapena 1998'in plase/pas ayrımında kilit
  bulduğu şey tam olarak bu (pelvis ve uyluk-kaval düzleminin dönüklüğü), yandan kamerada zayıf
  görünür, sadece görünen genişlik değişimiyle dolaylı tahmin edilebilir.
- **Hareketli topun gerçek hızı (m/s)** — tek kamera sahne derinliğini kalibre etmeden mutlak hız
  veremez. Uygulama sadece **bacak boyuna normalize edilmiş göreli hız** üretebilir (piksel/kare ÷
  bacak boyu piksel), bu H modunun eşik tasarımını doğrudan etkiliyor (§4'teki normalize eşik gibi).
- **Yaklaşma açısının gerçek derecesi** (PL1, F1 ortak sorun) — kamera tam yandan olduğunda, kalça
  merkezinin görüntü düzlemindeki hareketinden çıkarılan açı, gerçek 3D yaklaşma açısının **yaklaşık**
  bir izdüşümüdür, özellikle oyuncu kameraya doğru/kameradan uzağa çapraz geliyorsa hata büyür.
- **Destek bacağın kalça ekstansiyonu (H2)** yandan kamerada ölçülebilir (uyluk-gövde açısı görünür
  düzlemde), bu iyi bir haber — H2, bu bölümdeki en "2D-dostu" parametre.

---

## Açık kalanlar
- **PL parametrelerinin çoğu maksimal frikikten (Alcock 2012) uyarlandı**, sahada koşarak yapılan
  submaksimal bir "yerleştirme bitirişi" için doğrudan bir çalışma bulunamadı. Sayısal eşiklerin çoğu
  bu yüzden **[T]**; yön güvenilir, büyüklük değil.
- **Vieira ve ark. 2019'un tam metnine erişilemedi** (ödeme duvarı), H1/H2 sadece özet düzeyinde
  doğrulandı. Tam metin bulunursa (kurumsal erişim, sci-hub değil) santimetre/derece büyüklükleri
  eklenmeli.
- **Hareketli topa vuruş literatürü düşük hızlı (~2.2 m/s) yuvarlanan toplarla sınırlı** (futsal, lab).
  Sahada uzun bir paslaşmadan ya da kendi hızlı sürüşünden gelen bir topla ilgili doğrudan biyomekanik
  veri yok — GECE-PLANI.md checkpoint 2'deki referans klipler (Sonnet B) toplanınca en azından
  Mert'in kendi verisiyle gerçekçilik kontrolü yapılabilir (METRICS.md'deki Messi/Mert kıyası gibi).
- **PL6 (temas yüksekliği)** tamamen koçluk kaynaklı, laboratuvar doğrulaması yok — düşürülebilir ya
  da en düşük ağırlıkla eklenebilir.
- **Otomatik ayrım eşikleri (§4) test edilmedi.** Gerçek referans klipler (Ronaldo şut, Messi/Neymar
  plase, hareketli topa vuruş) toplanınca bu eşiklerin gerçek dağılımı görülüp kalibre edilmeli
  (cp-14-referans-dogrulama, PLAN'da Frodo'ya atanmış).
- **Kellis, Katis, Gissis (2004)** tam metnine erişilemedi (ödeme duvarı); yaklaşma açısının destek
  dizi kinematiğine etkisi (0°/45°/90°) sadece özet düzeyinde teyit edildi, PL/H parametrelerine
  doğrudan sayı taşınmadı — sadece "45° civarı optimal" genel bulgusu §doğrulama olarak kullanıldı.

---

## Kaynaklar

- Alcock, A. M., Gilleard, W., Hunter, A. B., Baker, J., & Brown, N. (2012). Curve and instep kick
  kinematics in elite female footballers. *Journal of Sports Sciences, 30*(4), 387–394.
  https://doi.org/10.1080/02640414.2011.643238 · özet: https://pubmed.ncbi.nlm.nih.gov/22214481/
- Carlsson, T., Isberg, J., Nilsson, J., & Carlsson, M. (2018). The influence of task conditions on
  side foot-kick accuracy among Swedish first league women's soccer players. *Journal of Sports
  Science and Medicine, 17*(1), 74–81. https://pmc.ncbi.nlm.nih.gov/articles/PMC5844211/ (açık erişim)
- Egan, C. D., Verheul, M. H. G., & Savelsbergh, G. J. P. (2007). Effects of experience on the
  coordination of internally and externally timed soccer kicks. *Journal of Motor Behavior, 39*(5),
  423–432. https://doi.org/10.3200/JMBR.39.5.423-432 · özet: https://pubmed.ncbi.nlm.nih.gov/17827118/
- Palucci Vieira, L. H., Cunha, S. A., Santiago, P. R., Dos Santos, P. C., Cardenas, G. C., Barbieri,
  R. A., Baptista, A. M., & Barbieri, F. A. (2019). Dominant/non-dominant support limb kinematics and
  approach run parameters in futsal kicking of stationary and rolling ball. *Journal of Sports
  Medicine and Physical Fitness, 59*(11), 1852–1860. https://doi.org/10.23736/S0022-4707.19.09654-3
  **[özet]** tam metin ödeme duvarı arkasında, sadece abstract erişildi.
- Barbieri, F. A., Gobbi, L. T. B., Santiago, P. R. P., & Cunha, S. A. (2010). Performance comparisons
  of the kicking of stationary and rolling balls in a futsal context. *Sports Biomechanics, 9*(1),
  1–15. https://doi.org/10.1080/14763141003690211
- Levanon, J., & Dapena, J. (1998). Comparison of the kinematics of the full-instep and pass kicks in
  soccer. *Medicine & Science in Sports & Exercise, 30*(6), 917–927.
  https://doi.org/10.1097/00005768-199806000-00022 (knee extension: full kick %86, pass kick %67 —
  özet üzerinden doğrulandı, tam metin ödeme duvarında) **[özet]**
- Kellis, E., & Katis, A. (2007). Biomechanical characteristics and determinants of instep soccer
  kick. *Journal of Sports Science and Medicine, 6*(2), 154–165.
  http://jssm.org/volume06/iss2/cap/jssm-06-154.pdf (açık erişim, tam metin okundu — Hay 1993 destek
  ayağı mesafesi ve Tol ve ark. 2002 yuvarlanan top alıntıları bu makaleden)
- Kellis, E., Katis, A., & Gissis, I. (2004). Knee biomechanics of the support leg in soccer kicks
  from three angles of approach. *Medicine & Science in Sports & Exercise, 36*(6), 1017–1028.
  https://doi.org/10.1249/01.MSS.0000128147.01979.31 **[özet]** tam metin ödeme duvarında.
- Asai, T., Carré, M. J., Akatsuka, T., & Haake, S. J. (2002). The curve kick of a football I: impact
  with the foot. *Sports Engineering, 5*(4), 183–192. (zaten RESEARCH.md'de, plase §1'de tekrar
  kullanıldı — off-centre temas fiziği)
- Messi/Neymar temas noktası ve takip için coaching kaynakları (laboratuvar değil, düşük güven):
  genel futbol koçluğu içerikleri, "finesse shot" tekniği üzerine — PL6 için tek dayanak, doğrulanmalı.

### Bu oturumda kullanılan ama teyit edilemeyen/reddedilen iddialar
- Tol ve ark. (2002)'nin **birincil kaynağı** (dergi, yazarlar) bulunamadı, sadece Kellis & Katis
  (2007)'in aktardığı tek cümle kullanıldı. Birincil kaynak bulunursa doğrulanmalı.
