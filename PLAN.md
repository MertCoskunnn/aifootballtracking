# Futbol AI Hoca: Proje Planı

> Durum: Fikir netleştirme (v0.1, 2026-09-23). Çalışma adı, isim sonra seçilecek.

## Tek cümlede
Telefonla çekilmiş bir futbol videosunu veya duruş fotoğrafını analiz eden bir uygulama. İskeleti çıkarır, şut, pas ve duruş tekniğini puanlar, bir hoca gibi "şunu düzelt" der.

## İlham
TikTok'ta tracking sistemiyle basketbol antrenmanı yapan, atışlarını analiz eden içerikler. Bu projede futbol versiyonunu ve basit bir postür analizini yapıyoruz. Asıl amaç YouTube içeriği: yapay zekayı bir hoca gibi kullanmak.

## Nasıl çalışır? (yeni başlayana)
1. **Göz:** Bir "poz tahmini" modeli, videonun her karesinde vücudun 33 noktasını bulur: omuz, dirsek, kalça, diz, ayak bileği vb. Bu, oyuncunun üzerine çizilmiş bir çöp adam gibi düşünülebilir.
2. **Cetvel:** Bu noktalar arasındaki açıları ve mesafeleri ölçeriz. Örnekler: "şut anında diz açısı 140°", "destek ayağı topa 25 cm uzakta", "omuzlar 4° eğik".
3. **Hoca:** Ölçümleri doğru teknik aralıklarıyla karşılaştırıp puan ve yorum üretiriz. Örnek: "Gövden çok geride, top havaya kalkar. Şut anında gövdeni topun üstüne getir."

## Teknik seçimler (hepsi ücretsiz)
| Parça | Seçim | Neden |
|---|---|---|
| Platform | Web uygulaması (tarayıcı, telefonda da açılır) | Kurulum yok, link at, çalışsın. Kuralımız: çıplak ve hafif mimari (Vanilla JS). |
| Poz modeli | Google MediaPipe Pose Landmarker (JS) | Ücretsiz, tarayıcıda cihazın kendisinde çalışır, video sunucuya gitmez (gizlilik). 33 nokta verir. |
| Top tespiti | 1. aşama: kullanıcı topa tıklar. Sonra: tarayıcı içi nesne tespiti (COCO "sports ball") | Top takibi zor bir problem, işe en kolay güvenilir yoldan başlarız. |
| Hoca yorumları | Kural tabanlı şablonlar (bizim yazdığımız eşikler) | Ücretsiz, açıklanabilir, videoda anlatması kolay ("hoca şu kurala bakıyor"). LLM ile yorum sonra, ücretsiz bir seçenek bulunursa. |
| Sunucu | Yok. Statik site: GitHub Pages / Vercel ücretsiz | Maliyet sıfır. |

> Doğrulanacak: MediaPipe'ın güncel JS paket adı ve sürümü ilk checkpoint'te kontrol edilecek.

## Modüller ve sıra
1. **M0: Video → iskelet** (temel). Video yükle, üstüne iskeleti çiz, kare kare ilerle. Her şey bunun üstüne kurulu.
2. **M1: Postür analizi** (en kolay, hızlı sonuç). Önden ve yandan birer fotoğraf. Ölçümler: omuz eğimi, kalça eğimi, baş öne kayma, diz içe çökme. Çıktı: basit bir rapor kartı.
3. **M2: Şut analizi.** Yandan çekilmiş video. Ölçümler: destek ayağının topa mesafesi, şut anında gövde açısı, diz ve ayak bileği kilidi, takip hareketi. Çıktı: 0–100 puan ve 2–3 düzeltme önerisi.
4. **M3: Pas analizi.** Şut modülünün iç taraf versiyonu: ayak açısı, gövdenin hedefe dönüklüğü.
5. **M4: Hoca katmanı.** Puanları karakterli, esprili bir hoca diline çeviren katman. İçerik için en eğlenceli kısım.

## Sınırlar (dürüst olalım)
- **Tek kamera = 2D.** Derinliği tahmin ederiz, ölçemeyiz. Doğru sonuç için çekim açısı kuralı gerekir: yandan, sabit telefon, tüm vücut kadrajda.
- **"Teşhis" değil "gözlem".** Postür modülü tıbbi teşhis koymaz, "şu tarafın eğik görünüyor" der ve bir uyarı notu gösterir. Hem etik hem hukuki olarak doğrusu bu.
- **Hızlı hareket.** Şut anı 1–2 kareye düşebilir. Mümkünse 60 fps çekim önerilir.

## İçerik açısı (not)
Video kurgusu anlatım odaklı ve sinematik olacak, ekran kaydı ağırlıklı olmayacak. Güçlü anlar: "AI hocam şutumu 43 aldı", postür sonucunu kendi üzerinde gösterme, önce/sonra karşılaştırması. Kurgu ayrıca düşünülecek.

## Mert'in karar vermesi gerekenler
1. İlk modül: **Postür (M1)** mü, **Şut (M2)** mi? Önerim: M0 + M1. En hızlı "vay" anını verir, şut modülünün altyapısını da hazırlar.
2. Proje adı.
3. GitHub reposu: `github.com/new` üzerinden private, boş repo açılıp linki verilecek.
4. Test videoları: Mert'in kendi şut ve pas videoları (yandan, 60 fps varsa).

## Çalışma parametreleri (Mert, 2026-09-23)
- Her şey ücretsiz. Ücretli servis yok.
- Kod vault dışında: `Desktop\projeler\futbol-ai-hoca`
- Onay checkpoint'lerde alınır. Mert bilgisayar başında değilse doğrulanmış işi checkpoint'ler, kararı gerektiren yerde durup not bırakırım.
- Alt ajan yok. Token tasarruflu çalışılır.
