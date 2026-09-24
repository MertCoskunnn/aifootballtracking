# Çalışma Düzeni (2026-09-24)

> Projenin amacı: Mert'in bu uygulamayla kendi vuruşunu geliştirmesi ve süreci videoya dökmesi.
> Gerçek kullanıcıya verilmeyecek. Kanalın konsepti: **AI slop yok.** Bu yüzden her sonuç
> gerçek ölçüme dayanır, uydurma veri ve jenerik metin yoktur.

## Roller
- **Frodo (proje yöneticisi):** plan, karar, doğrulama, Mert'e rapor. Kod yazmaz.
- **Sonnet çalışanları:** kodu yazar. Aynı anda en fazla 4. Her çalışanın dosya alanı briefte yazılıdır, başkasının alanına dokunmaz.
- **Denetçi (ayrı bir Sonnet):** yazan çalışan değil, işe hiç dokunmamış taze bir Sonnet. Yazan kendi işini denetlemez.

## Çapraz kontrol (her iş partisi için)
1. **Yazan:** testleri yeşil, açık dosya listesiyle commit, raporunda "tarayıcıda neye bakılmalı" ve "emin olmadığım yer" yazar.
2. **Denetçi** commit aralığını şu listeyle okur, bulguları önem sırasıyla yazar:
   - Brief'te istenen yapıldı mı? Brief dışı sessiz değişiklik var mı?
   - Testler gerçek davranışı mı ölçüyor, yoksa kendini doğrulayan (totoloji) testler mi? Test geçsin diye eşik oynanmış mı?
   - Uydurma veri var mı? Ölçülmemiş eşik `[T]` diye işaretli mi, referans iddiası dayanaklı mı?
   - Veri sözleşmesi (33 nokta + top listesi) ve regresyon yolu (Messi 100, Mert 82/88) korunuyor mu?
   - Modüller arası tutarlılık: sürüm ekleri tek mi, iki çalışanın değişikliği çakışıyor mu?
   - Kullanıcıya görünen metin: doğal Türkçe mi, jenerik dolgu (slop) var mı?
3. **Düzeltme:** bulguları yazan çalışan düzeltir (denetçi değil).
4. **Frodo** tarayıcıda tek taramayla doğrular (Messi antrenman klibi + gerekirse bir Mert klibi), ekran görüntüsüyle kanıtlar. Doğrulanmayan iş "tamam" sayılmaz.
5. **Kayıt:** CHECKPOINTS.md satırı, önce/sonra ekran görüntüsü (video malzemesi) `ekran/` klasörüne.

## Kredi planı (2026-09-24, reset'e ~3.5 saat)
| Sıra | İş | Çalışan |
|---|---|---|
| Şimdi | Top izi animasyonu app.js'e | Çalışan 1 |
| Şimdi | Görüntü tarafı: kalite kapısı birleştirme, netlik düzeltme, çift top, sürüm eki | Çalışan 3 |
| Şimdi | Toplu referans sayfası (klasör yapısından) | Çalışan 4 |
| Sonra | Tek denetçi turu, üç işin hepsi için | Denetçi |
| Sonra | Düzeltmeler + tek tarayıcı doğrulaması + rapor | Çalışanlar + Frodo |
| Reset sonrası | İki puan (teknik + sonuç), kalite kapısı arayüzü, hız + yükleme ekranı, FIFA 14 arayüzü | yeni parti |

## Mert'in klasör yapısı
`test-videolar/<tur>/<ayak>/<aci>/<iyi|kotu>_<ad>.mp4`
tur: frikik, plase, ayakustu, pas · ayak: sol, sag · aci: yandan, arkadan
