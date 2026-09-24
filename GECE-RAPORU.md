# Gece Raporu (2026-09-24 sabahı için)

> Yazan: Frodo. Plan: [GECE-PLANI.md](GECE-PLANI.md). Durum tablosu: [CHECKPOINTS.md](CHECKPOINTS.md).
> Hepsi **yerel commit**, push yok (senin isteğin). Her adım kontrol sayfasında doğrulandı: Messi 100, Mert 82 ve 88 hiç bozulmadı.

## Kısaca ne oldu
| Checkpoint | Ne kazandın |
|---|---|
| cp-10-regresyon | Kontrol sayfası: "Messi hâlâ 100 mü?" sorusu artık tek tıkla cevaplanıyor. Her değişiklik bu sayfadan geçti. |
| cp-11-evreler | Uygulama vuruşun beş anını buluyor: yaklaşma, destek ayağı basışı, kurma, temas, takip. Ölçümler kare sayısı yerine saniyeyle, 60 fps'e hazır. |
| cp-12-movenet | İkinci göz. Arkadan çekilen oyuncunun iskeleti artık çıkıyor (Liverpool frikiğinde 10 numaralı Messi). Sadece gerektiğinde ve topun yanındaki kişide devreye giriyor. |
| cp-13-vurus-turleri | Yeni mod: **Plase**. **Hareketli top** kendiliğinden anlaşılıyor, ona göre kural gevşiyor. **Her kurala tek başına yapılabilecek bir alıştırma** eklendi, raporda "Odaklan" altında. |
| cp-14a-olcum-yeterliligi | Kötü açıdan çekilen videoya sahte puan verilmiyor. Hoca "ölçüm yetersiz, şu açıdan çek" diyor. |
| cp-14c-makul-aralik | İskelet yanlış okununca çıkan imkânsız değerler (destek dizi 117°) elenir, hoca saçma öneri vermez. |

## Neyi neden yaptım (yeni başlayana anlatır gibi)
- **Önce kontrol düzeneği.** Bir binaya kat çıkmadan önce terazi kurmak gibi. Her yeni özellik eski sonuçları bozabilir. Kontrol sayfası olmasaydı her seferinde elle deneyecektik, gece boyu 5 checkpoint mümkün olmazdı.
- **MoveNet neden "yedek" olarak eklendi?** Yandan çekimde mevcut göz (BlazePose) zaten iyi. İkinci gözü her yerde çalıştırmak uygulamayı yavaşlatıyordu (ilk denemede %57). Kuralım: ikinci göz sadece birincinin kör olduğu yerde ve topun yanındaki kişide açılır.
- **Hareketli top neden bir "mod" değil?** Sürdüğün topa vurmak ayrı bir teknik değil, aynı şutun farklı koşulu. Uygulama temastan önce topun hızına bakıyor, hızlıysa kuralları biraz gevşetiyor (araştırmaya göre koşarken destek ayağı daha geride kalır, kurma kısalır). Eşiği senin bir şutuna bakarak 3'ten 5'e çektim: o top yavaşça kayıyordu, "hareketli top" sayılmamalıydı.
- **Neden sahte 100'ü kapattım?** Ronaldo'nun arkadan çekilmiş vuruşu 100 aldı. Oysa 7 ölçümden sadece biri yapılabilmişti. Tek başına çalışan biri bu puana güvenip hiçbir şeyi düzeltmezdi. Artık ölçümlerin en az yarısı yoksa puan yok.

## Dürüst olalım: ne olmadı
1. **Referans kalibrasyonu (cp-14) eşik değiştirmeden kapandı.** 18 klip tarandı, bulgular METRICS.md'de. En önemli iki bulgu koda girdi (sahte 100, imkânsız değerler). Ronaldo, Messi ve Neymar klipleri YouTube'dan indi (18 klip), ama çoğu yayın tekrarı ve maç görüntüsü: kamera hareket ediyor, açı arkadan ya da önden, ayak bile yanlış bulunuyor (Messi solak ama "sağ" çıktı). Yandan kuralları bunlarla kalibre etmek yanıltıcı olurdu. Sonuçlar: `test-videolar/referans/SONUCLAR.md`.
2. **Açı tespiti hatası duruyor.** Messi'nin yandan çekilmiş antrenman klibine "önden" diyor. Omuz genişliğine bakan bir düzeltme denedim, ama senin yandan şutunu "arkadan" sandı (vuruş anında gövde dönüyor). Kural gereği geri aldım: `deneme/aci-tespiti-omuz` dalında duruyor.
3. **Tarama yavaş.** Ekran kapanınca tarayıcı sayfayı yavaşlatıyor, gece kare başına 5 saniyeye çıktı. Kalabalık yayın görüntülerinde bir klip 25 dakika sürdü.

## Senden ihtiyacım olan (öncelik sırasıyla)
1. **Kendi videoların, tam yandan, telefon sabit:** 5 ayak üstü şut, 5 plase, 5 sürerek vuruş. Asıl kalibrasyon verisi bunlar olacak. Hedef kullanıcı sensin.
2. **Arkadan 2-3 frikik** (MoveNet'in gerçek testi).
3. Karar: yandan olmayan çekimde şut/plase puanı tamamen gizlensin mi, yoksa uyarıyla gösterilsin mi? Açı tespiti düzelene kadar önerim: uyarıyla göster.

## Sıradaki iş önerim
- Açı tespiti v2: temas anı yerine temastan **önceki koşu karelerinde** gövde yönelimi (gövde henüz dönmeden).
- Senin videolarınla cp-14 kalibrasyonu: plase ve hareketli top eşikleri [T] olarak duruyor.
- PL4 (plasede diz hızı oranı) ölçümü dağılıyor (28 ile 1257 arası), tanımı düzeltilmeli.
- Hız: tarayıcıda kare başına ~1 sn. Uzun videolar için "oynatarak işleme" (PRODUCT-PLAN'daki hız maddesi).

## Sabah eki (Mert'in denemesi)
- **Yeni hata:** arada bir bulutların orada iskelet beliriyor. Muhtemel sebep: nesne modeli bulutu kişi sanıyor, MoveNet yedeği kabul ediyor. Çözüm planı: anatomi + zemin hizası + süreklilik kontrolü, eşikler 0.5/0.45. Hangi video/saniye olduğu bekleniyor.
- Sıra: bulut iskeleti → açı tespiti v2 → vuruş bulma → hız → 60 fps.

## 2026-09-24 gündüz raporu (Frodo, doğrulama tarayıcıda Messi antrenman klibiyle)
| İş | Durum |
|---|---|
| Messi "önden" gerilemesi (9aaab8f) | ✅ Yandan/Şut/100 geri geldi |
| Seçmeli menü, otomatik mod yok (cp-15) | ✅ tarayıcıda çalışıyor |
| Kural matrisi rules.js (cp-16), referans satırı raporda | ✅ Messi hâlâ 100 |
| Tek oyuncu / tek top (cp-18) | ✅ kaleciye iskelet yok |
| Nişangah top boyutunda (b0d108b) | ✅ |
| Şut izi, fizik eğrisi + animasyon (cp-19, a8f1fef, b0d108b) | ⚠️ yerdeki topa artık atlamıyor, yön doğru; iz başı uçan topun ~60 px gerisinde |
| Kalite kapısı (kamera kayması + netlik) | ⚠️ ölçülüyor, ekranda gösterilmiyor, eşikler [T] |
| Çift top NMS (balls.js) | ✅ Messi klibinde tek top |
| Toplu referans sayfası (tests/referans.html) | hazır, klasör yapısı bekleniyor |
| Çapraz denetim turu | ✅ kritik bulgu yok, 2 küçük bulgu düzeltildi |

Testler: 194/194. Hepsi yerel commit, push yok.

**Sıradaki parti:** iz gecikmesi, kalite kapısını ekranda gösterme + analizi durdurma, iki puan (teknik + sonuç), hız + FIFA tarzı yükleme ekranı, sonra FIFA 14 arayüzü.
**Senden:** videoları `test-videolar/<tur>/<ayak>/<aci>/<iyi|kotu>_<ad>.mp4` yapısına ayırıp `node scripts/referans-liste.mjs`. Telefon için Artifact: Google model dosyalarını (~30 MB) indirme onayı.

## 2026-09-24 gece: "neden kötü gitti" (kodu Frodo yazdı)
Ürün tanımı (Mert onayladı): **video gelir → top ne yaptı → postürde neden → nasıl düzelir.**

| Commit | Ne değişti | Doğrulama |
|---|---|---|
| adc61fd | Vuran oyuncu = kameraya en yakın (en uzun) kişi; tarama önizlemesi iskelet çizmiyor; "Vuran oyuncuyu seç" dokunuşu | Referans 9: iskelet 4 karede de vuran oyuncuda, kaleciye yok |
| 6abd14d | "Ölçülemez" kalktı: her açıdan görülen ölçülür (arkadan şut/plase/pas artık analiz ediliyor). Dokunarak seçilen oyuncunun ezilmesi hatası düzeldi | Testler |
| c9b1dc7 | **Teşhis motoru**: outcome.js (top ne yaptı) + sebep.js (neden-sonuç tablosu, kaynaklı) + rapor başında "Ne oldu / Neden / Nasıl düzelir". Tablo: SEBEP-SONUC.md | Referans 9: "Top yana kıvrıldı, çünkü vuruştan sonra ayağın gövdenin önünden fazla çaprazladı" |
| fb22a83 | TikTok bitiş ekranı ve sahne kesmesi: vuruş aranmaz, takip kesmeden geçmez | Eşikler 9 referans videosunda ölçüldü (bitiş ekranı 7/7) |
| ad00854 | Kameradan uzaklaşan topun yüksekliği yandan okunmaz, yanlış "havalandı" demez | Messi klibinde bulundu |
| 3ff9893 | Top izi yanlış nesneye bağlanmasın: uçuş hızı, hız kopukluğu, iz temastan 0.2 sn içinde başlamalı, en iyi aday elenirse sıradaki | Referans 9: iz ve teşhis çalışıyor. Messi: iz artık çizilmiyor (yanlış iz yerine iz yok) |

Messi (yandan, şut, sol) hâlâ **100**. **Bilinen eksik:** Messi klibinde gerçek top adaylarda var ama iz kurulamıyor (temas topunun boyutu yanlış ölçülüyor, 66 px; gerçek top ~20 px). Sıradaki işlerden biri. Telefon sürümü güncellendi (aynı bağlantı). Testler 229/229.

**Dürüst durum:**
- Puan eşiklerinin çoğu **[T] tahmin**. Referans 9'daki iyi bir şuta 27/100 verdi; bu, eşiklerin sert olduğunu gösteriyor. Düzeltmenin yolu senin etiketlerin (aşağıda).
- Arkadan çekimde yükseklik, yandan çekimde sağ-sol okunmuyor (tek kameranın sınırı). Rapor bunu saklamıyor, söylüyor.

**Senden (kısa):** 5-10 videona tek kelimelik etiket: "havalandı", "sağa kaçtı", "güçsüz", "iyiydi". Dosya adına yazman yeter (ör. `havalandi_mert3.mp4`). Uygulamanın topu doğru okuyup okumadığını ve puanın iyiyi kötüden ayırıp ayırmadığını bununla ölçeceğim, eşikleri ona göre ayarlayacağım.
