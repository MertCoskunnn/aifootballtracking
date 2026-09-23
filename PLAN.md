# Futbol AI Hoca: Proje Planı

> Durum: Fikir netleştirme (v0.1, 2026-09-23). Çalışma adı, isim sonra seçilecek.

## Tek cümlede
Telefonla çekilmiş bir şut ya da pas videosunu analiz eden bir uygulama. İskeleti çıkarır, top tekniğini puanlar, bir hoca gibi "şunu düzelt" der.

## İlham
TikTok'ta tracking sistemiyle basketbol antrenmanı yapan, atışlarını analiz eden içerikler. Bu projede futbol versiyonunu yapıyoruz. Asıl amaç YouTube içeriği: yapay zekayı bir hoca gibi kullanmak.

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

> Doğrulandı: `@mediapipe/tasks-vision@1.0.1`, model tarayıcıda yükleniyor ve çalışıyor.

## Kapsam (Mert'in kararı, 2026-09-23)
Uygulama **yalnızca top tekniği** üzerine: şut ve pas. Postür analizi kapsamdan çıktı. Modül ayrımı yok, tek bir uygulama. Teknik kurallar: [RESEARCH.md](RESEARCH.md)

## Yol haritası (checkpoint'ler)
- **cp-00-plan:** Plan ✅
- **cp-01-arastirma:** Doğru şut ve pas tekniği araştırması, ölçüm tablosu ✅
- **cp-02-iskelet:** Video yükle → iskelet → temas ve top işaretleme → ölçüm → 0–100 puan ve öneriler (şut + pas) ✅ *(gerçek videoyla test bekliyor)*
- **cp-05-kalibrasyon:** Mert'in gerçek videolarıyla eşikleri ayarlama *(Mert gerekli)*
- **cp-06-otomatik:** Temas anını ve topu otomatik bulma (ileri seviye)
- **cp-07-hoca-kisiligi:** Hoca dili ve karakteri (içerik için)
- **cp-08-yayin:** GitHub Pages'te yayın

## Sınırlar (dürüst olalım)
- **Tek kamera = 2D.** Derinliği tahmin ederiz, ölçemeyiz. Doğru sonuç için çekim açısı kuralı gerekir: yandan, sabit telefon, tüm vücut kadrajda.
- **Hızlı hareket.** Şut anı 1–2 kareye düşebilir. Mümkünse 60 fps çekim önerilir.

## İçerik açısı (not)
Video kurgusu anlatım odaklı ve sinematik olacak, ekran kaydı ağırlıklı olmayacak. Güçlü anlar: "AI hocam şutumu 43 aldı", postür sonucunu kendi üzerinde gösterme, önce/sonra karşılaştırması. Kurgu ayrıca düşünülecek.

## Mert'in karar vermesi gerekenler
1. Proje adı (repo: `aifootballtracking`)
2. Test videoları: Mert'in kendi şut ve pas videoları (yandan, 60 fps varsa)

## Çalışma parametreleri (Mert, 2026-09-23)
- Her şey ücretsiz. Ücretli servis yok.
- Kod vault dışında: `Desktop\projeler\futbol-ai-hoca`
- Onay checkpoint'lerde alınır. Mert bilgisayar başında değilse doğrulanmış işi checkpoint'ler, kararı gerektiren yerde durup not bırakırım.
- Alt ajan yok. Token tasarruflu çalışılır.
