# Gece Planı (2026-09-23 → 24)

> Planlayan ve kontrol eden: Frodo (Opus). Uygulayan: Sonnet ajanları (en fazla 4). Push yok, sadece yerel commit.
> Hedef kullanıcı: sahada **tek başına bireysel idman yapan oyuncu**. Telefon sabit, tek kamera, top duruyor ya da kendi sürdüğü top.
> Her parametre şu soruya cevap vermeli: "Bu oyuncu yarın sahada neyi farklı yaparsa bu sayı düzelir?"

## Mimari (karar verildi)
- Veri sözleşmesi değişmez: kare başına `{ t, people: [[{x,y,v} x33]], balls }`. Yeni her "göz" bu biçime çevrilir.
- MoveNet Thunder = ikinci göz. Sadece BlazePose'un iskelet çıkaramadığı kişi kutusunda, tembel yüklenir. Model `models/movenet-thunder/` (12.48 MB, Apache 2.0, kaynak tfhub.dev Google).
- TF.js `@tensorflow/tfjs@4.22.0` (sabit sürüm) tek yeni bağımlılık, sadece gerekince yüklenir.
- Ölçüm pencereleri kare sayısıyla değil saniyeyle tanımlanır (60 fps hazırlığı).

## Adımlar
| # | Checkpoint | İçerik | Kim | Durum |
|---|---|---|---|---|
| 1 | cp-10-regresyon | `pipeline.js` (tarama akışı app.js'ten ayrılır) + `tests/regresyon.html` + `tests/beklenen.json` | Sonnet A | ✅ cp-10 |
| 2 | (veri) | Referans klipler: Ronaldo ayak üstü, Messi/Neymar plase, hareketli topa vuruş, arkadan frikik → `test-videolar/referans/` + `KAYNAKLAR.md` | Sonnet B | ✅ 18 klip |
| 3 | (araştırma) | `RESEARCH-VURUS-TURLERI.md`: plase ve hareketli top parametreleri, bireysel idman çevirisi | Sonnet C | ✅ taslak |
| 4 | cp-11-evreler | Evre bulucu (yaklaşma, basış, kurma, temas, takip), pencereler saniyeyle | Sonnet | ✅ |
| 5 | cp-12-movenet | Adaptör (17→33), movenet.js, vision.js yedek yolu, MoveNet iskeleti farklı renk | Sonnet | ✅ |
| 6 | cp-13-vurus-turleri | Plase modu, hareketli top ayrımı, kural setleri, otomatik tür önerisi | Sonnet | ✅ |
| 6b | cp-14a-olcum-yeterliligi | (Referans taramasında bulundu) Tek madde ölçülüp 100 puan verilmesin: ağırlık kapsamı %50 altındaysa puan yok, "ölçüm yetersiz" + çekim önerisi | Sonnet | ✅ |
| 6c | cp-14b-aci-tespiti | (Referans verisinden) Açıyı koşudan değil vücut yöneliminden oku: omuz genişliği/gövde boyu (yandan küçük), sol omuzun tarafı (önden/arkadan). Messi antrenmanı "önden" sanılıyordu | Sonnet | ❌ gerçek videoda başarısız (K2 88→62), `deneme/aci-tespiti-omuz` dalında. Sonraki fikir: temastan önceki koşu karelerinde yönelim |
| 6d | cp-14c-makul-aralik | (Referans verisinden) Fizyolojik olarak imkânsız ölçümler (destek dizi 117°, gövde -85°) "ölçülemedi" sayılsın, saçma öneri çıkmasın | Sonnet | ✅ |
| 7 | cp-14-referans-dogrulama | Referans kliplerle kalibrasyon, METRICS.md güncelleme | Frodo | ✅ eşik değişmedi (veri yetersiz), bulgular METRICS.md |

## Kabul kapıları (her checkpoint)
1. `node --test tests/*.test.mjs` hepsi geçer.
2. Regresyon: Messi MV1 100, Mert K1 82, K2 88 (bilinçli ve gerekçeli değişiklik hariç).
3. Frodo diff'i okur, tarayıcıda gerçek videoyla dener, sonra yerel commit + tag + CHECKPOINTS.md satırı.
4. Aynı sorun 3 denemede çözülmezse `deneme/<ad>` dalına alınır.
