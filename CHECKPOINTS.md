# Checkpoints

Geri dönmek için: `git checkout <tag>` (sadece bakmak için) ya da checkpoint protokolüne göre `deneme/` branch'i açıp ana hattı geri almak.

| Tarih | Tag | Ne çalışıyor | Bilinen sorunlar |
|---|---|---|---|
| 2026-09-23 | cp-00-plan | Plan dosyası, kod yok | - |
| 2026-09-23 | cp-01-arastirma | RESEARCH.md: şut ve pas ölçüm tablosu, kaynaklar | Eşikler henüz gerçek videoyla kalibre edilmedi |
| 2026-09-23 | cp-02-iskelet | Video yükle, kare kare iskelet, temas ve top işaretleme, şut/pas ölçümü, 0–100 puan. Sahte iskeletle test: iyi şut 100, kötü şut 31. Tarayıcıda model yükleniyor, akışta hata yok. | Gerçek insan videosuyla **henüz test edilmedi**. Eşikler kalibre değil. |

## Nasıl çalıştırılır
Proje klasöründe: `py -3 -m http.server 8765`, sonra tarayıcıda `http://localhost:8765`
