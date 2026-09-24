# Parametreler ve referans analizi (2026-09-24 akşam)

> Mert'in kararı: şimdilik **sadece `test-videolar/referans/` içindeki yeni videolar** referans.
> Gelecekte denenecek videolar bu tarzda olacak. Vuran oyuncu = **kameraya en yakın kişi**.

## 1. Referans videolarının analizi (9 video + 2 fotoğraf)

| # | Dosya (19.xx) | Çözünürlük | fps | Süre | Açı | Kamera | Not |
|---|---|---|---|---|---|---|---|
| 1 | 10.40 | 478×850 | 30 | 11 sn | arkadan | sabit | son ~4 sn TikTok bitiş ekranı |
| 2 | 10.53 | 478×850 | 30 | 47 sn | yandan/çapraz, değişken | elde, kesmeli | Rodrygo, birden çok vuruş, sahne kesmeleri |
| 3 | 11.16 | 576×1024 | 30 | 11 sn | kalecinin arkasından | yayın | **maç frikiği, kameraya en yakın kişi KALECİ** |
| 4 | 11.17 | 510×848 | 29 | 14 sn | yandan/önden, yakın | elde | Lamine Yamal, oyuncu kadrajı dolduruyor |
| 5 | 11.20 (1) | 392×850 | 54 | 2 sn | arkadan-çapraz | sabit | **ekran kaydı**: arama çubuğu, yazılar, uygulama arayüzü |
| 6 | 11.20 | 478×850 | 30 | 29 sn | değişken | elde, kesmeli | Santos idmanı, birden çok oyuncu; bir karede vurmayan biri kameraya çok yakın |
| 7 | 11.21 (1) | 478×850 | 30 | 13 sn | arkadan | sabit | "1 Or 2?" yazısı, son ~3 sn bitiş ekranı |
| 8 | 11.21 (2) | 478×850 | 30 | 78 sn | arkadan + yandan, birden çok çekim | sabit, kesmeli | anlatımlı eğitim, ekrana çizilmiş kırmızı çizgi, altyazı |
| 9 | 11.21 | 478×850 | 30 | 9 sn | arkadan | sabit | "1 Or 2?", kaleci uzakta ve küçük |
| F1, F2 | fotoğraflar | — | — | — | önden-çapraz | — | Neymar vuruş sonrası duruş; F2'de ön planda bulanık bir rakip var |

**Ortak özellikler (gelecek videoların tarzı):**
- Hepsi **dikey (9:16) telefon videosu**, TikTok/WhatsApp sıkıştırması, **düşük çözünürlük (~480×850)**, 30 fps.
- **Baskın açı ARKADAN** (1, 5, 7, 9, 8'in bir kısmı). Yandan çekim azınlıkta.
- Üstte **yazı/filigran** (TikTok logosu, "1 Or 2?", altyazı), sonda **siyah TikTok bitiş ekranı** (videonun %15-40'ı).
- Bazılarında **sahne kesmesi** (2, 6, 8): tek dosyada birden çok çekim.
- Netlik iyi (Laplacian medyanı 200-3000). Bulanıklık asıl sorun değil.

**"Kameraya en yakın kişi" kuralının durumu:**
- ✅ Çalışır: 1, 5, 7, 9 ve 8'in çekimleri. Oyuncu ön planda, kaleci uzakta ve küçük. Kaleci sorunu bu kuralla biter.
- ❌ Bozulur: **3** (kalecinin arkasından maç çekimi, en yakın kişi kaleci), **6** (bir karede vurmayan oyuncu kameranın dibinde), **F2** (ön planda rakip). Bu durumlar için "Vuran oyuncuyu seç" dokunuşu yedek olarak kalır.

**Mevcut sistemle çelişen bulgular (karar gerekiyor):**
1. Kural matrisinde **arkadan çekimde sadece frikik ölçülebiliyor**. Referansların çoğu arkadan çekilmiş şut ya da plase (7, 9: "1 Or 2?"). Bu hâliyle "Ayak üstü şut arkadan ölçülemez" çıkar. **Arkadan şut ve plase kuralları gerekiyor.**
2. **Bitiş ekranı ve sahne kesmesi** tespit edilmeli (siyah ekran kırpılır, her kesme ayrı çekim sayılır). Yoksa takip kesmede başka kişiye atlar.
3. **Elde çekim** (2, 4, 6): kalite kapısı "kamera hareketli" diyecek. Reddedilsin mi, uyarıyla mı işlensin?

## 2. Parametrelerimiz

### Kullanıcı seçer (zorunlu, otomatik mod yok)
| Parametre | Değerler |
|---|---|
| Açı | Yandan · Arkadan |
| Vuruş türü | Ayak üstü şut · Plase · Frikik · Pas |
| Ayak | Sağ · Sol |

### Uygulama otomatik bulur
| Parametre | Nasıl |
|---|---|
| İskelet | MediaPipe BlazePose (33 nokta); bulamazsa topa yakın kutuda MoveNet (ikinci göz) |
| Vuran oyuncu | **Temas karesinde ekranda en uzun görünen (kameraya en yakın) kişi**; yanlışsa dokunarak seçilir |
| Top | Nesne modeli (EfficientDet) + ayak çevresi yakınlaştırma; aynı top iki kez sayılmaz |
| Temas anı | Ayak hızlı (≥ 8 bacak boyu/sn) ve top o ayağın yanında hareketlenmeye başlıyor |
| Şut izi | Temastan sonraki top tespitlerine fizik eğrisi (yay) oturtulur; yerde duran top dışlanır |

### Puanlama kuralları (rules.js)
Puan: değer ideal aralıktaysa 100; dışındaysa `tol` kadar uzaklıkta 0'a doğrusal iner. Toplam = ağırlıklı ortalama. Ölçümlerin yarısından azı yapılabildiyse puan verilmez.

**Ayak üstü şut (yandan)** · referans Ronaldo [T: ölçüm bekleniyor]
| Kod | Ölçüm | İdeal | Tolerans | Ağırlık |
|---|---|---|---|---|
| Ş1 | Destek ayağı konumu (topa göre) | −0.45…−0.05 bacak | 0.30 | 3 |
| Ş3 | Gövde açısı | −18…3° | 15 | 3 |
| Ş2 | Destek dizi | 15…45° | 20 | 2 |
| Ş4 | Kurma (geri salınım) | 85…130° | 35 | 2 |
| Ş8 | Takip (kalça fleksiyonu) | 65…125° | 30 | 2 |
| Ş7 | Karşı kol | 35…110° | 30 | 1 |
| Ş5 | Temas anında diz | 30…60° | 25 | 1 (sadece ≥ 50 fps) |

**Plase (yandan)** · sol Messi, sağ Neymar [sağ: T]
| Kod | Ölçüm | İdeal | Tolerans | Ağırlık |
|---|---|---|---|---|
| PL2 | Destek ayağı konumu | −0.2…0.1 bacak | 0.3 | 3 |
| P3 | Gövde açısı | −10…8° | 15 | 3 |
| Ş2 | Destek dizi | 15…45° | 20 | 2 |
| Ş4 | Kurma | 60…110° | 35 | 1 |
| Ş8 | Takip | 45…100° | 30 | 1 |

**Frikik (arkadan)** · sol Messi, sağ Neymar [sağ: T]
| Kod | Ölçüm | İdeal | Tolerans | Ağırlık |
|---|---|---|---|---|
| F2 | Destek ayağının topa yanal mesafesi | 0.05…0.40 bacak | 0.25 | 3 |
| F5 | Takibin çaprazlaması | 0.3…1.0 bacak | 0.4 | 3 |
| F3 | Gövdenin yana yatışı | 5…22° | 15 | 2 |
| F4 | Kurma | 85…130° | 40 | 2 |
| F1 | Yaklaşma açısı | 20…50° | 30 | 2 |

**Pas (yandan)** · referans yok, araştırma değerleri: P1 destek konumu, P3 gövde, P5 salınım, P4 takip, destek dizi.

Ölçülemez kombinasyonlar (puan verilmez): şut/plase/pas **arkadan**, frikik **yandan**.

### Sistem eşikleri (hepsi [T] = gerçek videoyla kalibre edilecek)
| Parametre | Değer | Ne işe yarar |
|---|---|---|
| Top tespit güveni | 0.12 (tespit), 0.3 (takip) | düşük: küçük topu kaçırmamak için |
| MoveNet kabul | bacak güveni ≥ 0.45 + anatomi kontrolü | bulutlara iskelet oturmasın |
| Oyuncu takibi | kare başına ≤ 0.6 bacak boyu hareket, boy değişimi %25'ten az, en fazla 8 kare kayıp | başka birine atlamasın |
| Vuran oyuncu | temas karesinde iskeleti en uzun kişi (topa bakılmaz) | kameraya en yakın |
| Kamera kayması | 64×36 küçültmede > 1.5 px | hareketli kamera / maç görüntüsü |
| Netlik | Laplacian varyansı < 100 | bulanık video |
| Şut izi | temastan 0.2 sn içinde ≥ 1.5 top çapı hareket; en fazla 0.5 sn ileri uzatma | yerdeki topa kilitlenmesin |
