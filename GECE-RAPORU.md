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
1. **Referans kalibrasyonu (cp-14) bitmedi.** Ronaldo, Messi ve Neymar klipleri YouTube'dan indi (18 klip), ama çoğu yayın tekrarı ve maç görüntüsü: kamera hareket ediyor, açı arkadan ya da önden, ayak bile yanlış bulunuyor (Messi solak ama "sağ" çıktı). Yandan kuralları bunlarla kalibre etmek yanıltıcı olurdu. Sonuçlar: `test-videolar/referans/SONUCLAR.md`.
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
