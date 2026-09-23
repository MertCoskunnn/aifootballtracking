# Çekim Rehberi: Hocanın doğru görebilmesi için

Uygulama tek kamerayla 2D görüyor. Kamera ne kadar iyi konumlanırsa ölçüm o kadar doğru olur.

## Telefon ayarları
- **iPhone:** Ayarlar → Kamera → Formatlar → **En Uyumlu**. Varsayılan "Yüksek Verimlilik" (HEVC) formatı Windows'ta Chrome'da açılmayabilir.
- **Kare hızı:** Varsa **60 fps**. Ayak topa sadece 1–2 karede değiyor, 30 fps'te bu an kaçabilir.
- **Çözünürlük:** 1080p yeterli, 4K gerekmez (dosya büyür, işlem yavaşlar).
- **Yatay çek.**

## Kamera nereye?
```
            hedef / kale
                 ↑
                 |
      [top]   oyuncu koşusu →
                 
   📱  ← 3-5 metre, tam yandan
```
- **Tam yandan.** Vuran bacak kameraya bakan taraf olsun.
- **Sabit.** Telefonu bir yere daya ya da tripod kullan. Elde çekim ölçümü bozar.
- **Kalça yüksekliğinde** (~1 m). Yukarıdan ya da aşağıdan çekme.
- **Tüm vücut ve top kadrajda.** Koşu başından takibin sonuna kadar kafa ve ayaklar kesilmesin.
- **Kadrajda başka kimse olmasın.** Uygulama topa en yakın kişiyi seçiyor ama tek kişi en güvenlisi.

## Ortam
- Gün ışığı ya da iyi aydınlatma. Karanlıkta iskelet titrer.
- Kıyafet zeminden farklı renkte olsun.
- Top beyaz ya da açık renk olsun, işaretlemesi kolay olur.

## Kalibrasyon için lazım olanlar (cp-05)
| Video | Adet | Not |
|---|---|---|
| İyi şut | 2–3 | "Bu iyiydi" dediğin şutlar |
| Kötü şut | 1–2 | Bilerek geriye yaslan ya da destek ayağını öne bas |
| İyi pas | 2–3 | İç taraf, yerden |
| Kötü pas | 1 | Havalanan pas |

Kötü videolar önemli. Hoca iyiyi kötüden ayırabiliyor mu, ancak böyle test edebiliriz.

Videoları `test-videolar/` klasörüne koy. Bu klasör git'e gitmiyor, yüzün ve vücudun gizli kalıyor.
