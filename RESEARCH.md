# Araştırma: Doğru Şut ve Doğru Pas Tekniği

> Amaç: Uygulamanın "hoca" kurallarını keyfi değil, spor bilimi araştırmalarına dayandırmak.
> Kapsam: Sadece top tekniği: **şut (instep / ayak üstü)** ve **pas (iç taraf / side-foot)**.
> Durum: v0.1 (2026-09-23). Sayılar ilk sürüm eşikleri, Mert'in kendi videolarıyla kalibre edilecek.

## Güven seviyesi etiketleri
- **[K]** Kaynaklı: aşağıdaki kaynaklardan birinde geçiyor.
- **[L]** Literatürde yaygın bilgi: kaynak incelemelerinde tekrar eden bulgu, kesin sayı henüz kaynak metinden teyit edilmedi.
- **[T]** Teknik tahmin: bizim eşiğimiz, test videolarıyla ayarlanacak.

---

## 1. Şut (Instep Kick): hareket 5 evreden oluşur
1. **Yaklaşma:** Topa açılı koşu. Düz koşu yerine ~30–45° açıyla yaklaşmak en hızlı şutu verir. **[L]** (Isokawa & Lees 1988, Lees ve ark. 2010 incelemesinde)
2. **Destek ayağı basışı:** Destek ayağı topun yanına basar.
3. **Geri salınım:** Vuruş bacağının dizi büküldükçe büküş artar ("kurma").
4. **Vuruş:** Önce uyluk öne gelir, sonra diz hızla açılır (kamçı etkisi, proksimalden distale sıralama). **[L]**
5. **Takip:** Vuruş sonrası bacak hedefe doğru devam eder.

### Ölçülecek şeyler (yandan çekim, 2D)
| # | Ölçüm | Doğru teknik | Neden önemli | Güven |
|---|---|---|---|---|
| Ş1 | **Destek ayağının topa ön-arka mesafesi** | Ayak topun hizasında ya da hafif gerisinde | Destek ayağı topun ne kadar önündeyse top o kadar yükselir | [K] Lees ve ark. 2010 |
| Ş2 | **Destek dizi bükülmesi** | Basışta ~26°, vuruş anında ~42° bükük. Kilitli (düz) değil, yumuşak | Şok emilimi ve denge | [K] |
| Ş3 | **Gövde açısı (vuruş anı)** | Alçak ve sert şut için gövde topun üstünde, hafif öne eğik. Geriye yaslanmak = top havalanır | Topun yüksekliğini en çok bu belirler | [L] |
| Ş4 | **Geri salınımdaki diz bükülmesi** | Belirgin büküş ("kurma"). Az büküş = zayıf şut | Kamçı etkisinin menzili | [L] eşik [T] ~90°+ büküş |
| Ş5 | **Vuruş anında diz** | Diz neredeyse açılmış ama tam kilitlenmemiş. Temas, maksimum açılmadan hemen önce | Hızın zirvesi | [L] |
| Ş6 | **Ayak bileği kilidi** | Parmak ucu aşağı, bilek sabit | Enerji topa kaybolmadan geçer | [L] (2D'de sınırlı ölçülür) |
| Ş7 | **Karşı kol** | Vuruş bacağının karşı kolu yana açık (denge ve "germe yayı") | Gövde rotasyonu ve denge | [L] Shan & Westerhoff 2005 |
| Ş8 | **Takip** | Vuruş ayağı temastan sonra hedefe doğru yükselir, erken kesilmez | Hızı korur, isabeti artırır | [L] |

## 2. Pas (Side-Foot / İç Taraf)
- İç taraf vuruşu hız karşılığında **isabet** sağlar. En isabetli vuruşlar en düşük ayak ve top hızında görüldü (ayak ~3.6 m/s, top ~8 m/s, ~2.7° sapma). **[K]**
- Destek ayağı ile top arası mesafe isabeti anlamlı biçimde etkiler. **[K]**
- Gövde ve vücut eğimi açılarının etkileşimi isabetle ilişkili. Takip evresinde gövde ve uyluk açıları önemli. **[K]**

### Ölçülecek şeyler
| # | Ölçüm | Doğru teknik | Güven |
|---|---|---|---|
| P1 | **Destek ayağı konumu** | Topun yanında, hedefe dönük | [K] mesafe etkili, eşik [T] |
| P2 | **Vuruş ayağının dönüklüğü** | Ayak dışa ~90° dönük, iç taraf topa dik (önden veya arkadan çekim gerekir) | [L] |
| P3 | **Gövde** | Topun üstünde, dik ya da hafif öne. Geriye yaslanma = pas havalanır | [K] |
| P4 | **Takip** | Kısa, kontrollü, hedefe doğru | [K] |
| P5 | **Hız kontrolü** | Pas şut değildir, abartılı salınım gerekmez | [K] |

---

## 3. Kamera kuralları (2D'nin sınırı)
- **Şut:** Tam yandan, vuruş bacağı kameraya bakan taraf. Telefon sabit, kalça yüksekliğinde, 3–5 m uzakta. Tüm vücut ve top kadrajda.
- **Pas:** Yandan (gövde ve takip için) ve arkadan veya önden (ayak dönüklüğü için).
- **FPS:** Vuruş anı çok kısa. 60 fps varsa kullan, 30 fps'te temas anı kaçabilir.
- **Tek kamera derinlik ölçemez.** Destek ayağının topa **yanal** mesafesini yandan göremeyiz. Sadece ön-arka mesafe ölçülür.

## 4. Ölçüleri normalize etmek
Pikselle ölçmek kişiye ve kameraya göre değişir. Mesafeleri **bacak boyuna** (kalça → ayak bileği) bölerek oransal hale getiriyoruz. Böylece 1.60 m ve 1.90 m boyundaki oyuncu aynı kuralla puanlanır.

---

## Kaynaklar
- Lees, A., Asai, T., Andersen, T. B., Nunome, H., Sterzing, T. (2010). The biomechanics of kicking in soccer: A review. *Journal of Sports Sciences.* [PDF](https://numerik.mi.fu-berlin.de/wiki/WS_2020/CoMaI_Dokumente/FTVS-2332-version1-the_biomechanics_of_kicking_in_soccer_a_review.pdf)
- Lees, A., Nolan, L. (1998). The biomechanics of soccer: A review. *Journal of Sports Sciences.*
- Kellis, E., Katis, A. (2007). Biomechanical characteristics and determinants of instep soccer kick. [ResearchGate](https://www.researchgate.net/publication/258035444_Biomechanics_and_determinants_of_instep_soccer)
- Kellis, Katis, Gissis (2004). Knee biomechanics of the support leg in soccer kicks from three angles of approach. *MSSE.*
- Destek bacağı kinetiği: [academia.edu](https://www.academia.edu/164840099/Kinetic_analysis_of_the_support_leg_in_soccer_instep_kicking)
- Yaklaşma açısı ve pelvis/lumbal sıralama: [ScienceDirect](https://www.sciencedirect.com/science/article/pii/S0021929023004918)
- Side-foot kick hareket analizi: [academia.edu](https://www.academia.edu/126480271/Motion_Analysis_and_Biomechanics_of_the_Side_Foot_Soccer_Kick)
- Pas isabeti, destek ayağı ve gövde: [ResearchGate](https://www.researchgate.net/publication/330918247_Biomechanics_Analysis_of_Passing_Accuracy_by_Using_Foot_and_Kick_Distance_at_the_Student_Football_Player)
- İç taraf vuruşunda kütle merkezi: [PMC](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC4234770/)
- Side-foot vuruşunda destek bacağı: [PMC](https://pmc.ncbi.nlm.nih.gov/articles/PMC9344159/)
- MediaPipe Pose Landmarker (Web): [Google AI Edge](https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker/web_js), paket `@mediapipe/tasks-vision@1.0.1` (npm'den doğrulandı)
