# Futbol AI Hoca: Ürün Taslağı (v1.0 hedefi)

> Karar verici ve planlayıcı: Frodo (Opus). Uygulayıcı: Sonnet 5 ajanları. Tarih: 2026-09-23.
> Bu dosya "ne yapıyoruz ve neden" sorusunun tek cevabıdır. Ajanlar bu plana göre çalışır.

## 1. Ürün tek cümlede
Telefonla çekilmiş bir şut, pas ya da frikik videosunu tarayıcıda analiz eden, araştırmaya dayalı kurallarla puanlayan, bir hoca gibi konuşan ve "Messi'ye ne kadar benziyorsun?" diye kıyaslayan ücretsiz bir web uygulaması.

## 2. Kullanıcı akışı (v1.0)
1. **Mod seç:** Şut (ayak üstü) · Pas (iç taraf) · Frikik / falsolu
2. **Video yükle:** Kamera açısı rehberi moda göre gösterilir (şut ve pas yandan, frikik arkadan veya çapraz)
3. **İşleme:** İlerleme çubuğu, canlı iskelet (✅ cp-04)
4. **Temas anı:** Uygulama **önerir** (otomatik), kullanıcı onaylar ya da düzeltir
5. **Top:** Kullanıcı tıklar → oyuncu seçilir ve takip edilir (✅ cp-03)
6. **Rapor:** Puan, madde madde ölçümler, "odaklan" önerisi, hoca yorumu
7. **Messi kıyası:** Referans profil varsa benzerlik yüzdesi ve en büyük 2 fark
8. **Kaydet:** Ölçüm veri setine eklenir (kalibrasyon ve ilerleme takibi için), JSON veya CSV olarak dışa aktarılır

## 3. Mimari (değişmez ilkeler)
- **Vanilla JS, kütüphane yok, sunucu yok.** Tek dış bağımlılık: MediaPipe (CDN).
- **Saf mantık tarayıcıdan ayrı:** `metrics.js`, `coach.js` ve yeni mantık dosyaları DOM'a dokunmaz. Hepsi `node --test` ile test edilir.
- **Katmanlar:**
  | Dosya | Rol |
  |---|---|
  | `app.js` | Arayüz ve akış (göz ve ekran) |
  | `metrics.js` | Ölçüm (cetvel) ve oyuncu takibi |
  | `coach.js` | Kurallar ve puan (hoca) |
  | `detect.js` *(yeni)* | Temas anı önerisi |
  | `dataset.js` *(yeni)* | Kayıt, dışa aktarma, sol ayağın aynalanması |
  | `compare.js` *(yeni)* | Referans profil (Messi) ve benzerlik hesabı |
  | `tests/*.test.mjs` *(yeni)* | Node testleri, bağımlılık yok |
- **Gizlilik:** Video cihazdan çıkmaz. `test-videolar/` git'e gitmez. Referans profil sadece sayı içerir.
- **Önbellek:** Her sürümde `?v=N` etiketi artırılır.

## 4. Modlar ve kurallar
| Mod | Kamera | Temel ölçümler | Kaynak |
|---|---|---|---|
| Şut | Yandan | Destek ayağının ön-arka konumu, gövde, destek dizi, kurma, temas anında diz, karşı kol, takip | RESEARCH.md Ş1–Ş8 |
| Pas | Yandan | Destek ayağı, gövde, salınım, takip, destek dizi | RESEARCH.md P1–P5 |
| **Frikik / falso** *(yeni)* | **Arkadan veya çapraz** | Yaklaşma açısı, destek ayağının topa **yanal** mesafesi (arkadan ölçülebilir), gövdenin yana yatması, vuruş bacağının içeri dönüşü, takibin gövde önünden çaprazlaması | RESEARCH.md F1..Fn (araştırılacak) |

Messi'ye 63 verilmesinin sebebi: frikik farklı bir teknik ve yandan çekim varsayımı arkadan çekilmiş görüntüye uymuyor. Frikik modu bu yüzden ayrı bir kural seti ve ayrı bir kamera varsayımıyla çalışacak.

## 5. Messi kıyası (referans profil)
- **Profil:** Bir moddaki N iyi klipten çıkan ölçümlerin ortalaması ve standart sapması, ayrıca temas anına göre hizalanmış diz ve gövde açı eğrileri.
- **Benzerlik:** Ölçüm başına z-skoru → 0–100, ağırlıklı ortalama. En büyük 2 fark cümleyle anlatılır.
- **Sol ayak:** Solak oyuncunun ölçümleri aynalanarak sağ ayak eşdeğerine çevrilir (açılar değişmez, yönler çevrilir).
- **Veri:** Mert iyi klipleri uygulamada analiz edip "referansa ekle" der. Profil `profiles/messi-frikik.json` gibi dosyalarda tutulur.

## 6. Kalibrasyon
Kaydedilen ölçümlerden eşiklerin gerçek dağılımı görülür. Mert'in iyi ve kötü etiketli klipleriyle "hoca iyiyi kötüden ayırıyor mu" testi yapılır. **Kural:** Eşik değişikliği her zaman bir veri gerekçesiyle ve commit mesajında yazılı olarak yapılır.

## 7. Yol haritası
| Checkpoint | İçerik | Kim | Doğrulama |
|---|---|---|---|
| cp-05-testler | `node --test` altyapısı, mevcut mantığın testleri | Sonnet | Testler geçiyor |
| cp-06-frikik | Frikik araştırması (RESEARCH F-bölümü), kurallar, arkadan kamera ölçümleri, mod seçimi | Sonnet | Sahte iskelet testleri + tarayıcı akışı |
| cp-07-veri | Ölçüm kaydı, JSON/CSV dışa aktarma, sol ayak aynalama | Sonnet | Testler + tarayıcı |
| cp-08-temas | Otomatik temas anı önerisi (vuran ayağın hız zirvesi ve topa yakınlık) | Sonnet | Sahte hareket dizisiyle test |
| cp-09-kiyas | Referans profil ve benzerlik motoru, "referansa ekle" ve kıyas raporu | Sonnet | Testler + tarayıcı |
| cp-10-kalibrasyon | Gerçek veriyle eşik ayarı | Frodo + **Mert'in verisi** | Mert'in iyi ve kötü klipleri |
| cp-11-hiz | Oynatarak işleme (requestVideoFrameCallback) ile 3–5 kat hız | Sonnet | Gerçek video |
| cp-12-hoca-kisiligi | Hoca dili ve karakteri | Frodo + Mert | Mert'in beğenisi |
| cp-13-yayin | GitHub Pages | Frodo | Canlı link |

## 8. Çalışma düzeni (ajanlar için)
- Her ajan **tek bir checkpoint** yapar, saf mantığı test eder, `node --test` geçmeden bitmez.
- Ajan commit atmaz. Frodo inceler, tarayıcıda dener, commit ve push eder.
- Commit mesajları "neden" anlatımıyla ve yeni başlayana hitap ederek yazılır (Kurallar.md).
- Kapsam dışına çıkılmaz. Belirsizlikte en basit yol seçilir ve bir notla işaretlenir.
