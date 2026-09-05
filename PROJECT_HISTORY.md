# Sofra — Proje Geçmişi

Bu dosya tüm sohbetlerin birebir kopyası değildir. Projeyi sürdürmek için gerekli önemli kararları, tamamlanan işleri, dağıtımları ve geri dönüş noktalarını kalıcı olarak özetler.

## Mevcut sistem

- Mobil uygulama: React Native / Expo
- Kimlik doğrulama ve kullanıcı verileri: Firebase
- Tarif API'si: FastAPI / Uvicorn
- Sunucu: `129.121.89.248`
- Canlı API servisi: `sofra-api.service`
- Servis systemd ile etkin ve sunucu yeniden başlayınca otomatik açılıyor.
- Kod deposu: `Yigit-App-lab/Sofra`, ana dal `main`
- Fiyat şehri: yalnız İstanbul

## Hesap ve mobil uygulama

- E-posta/parola girişi, parola yenileme, çıkış ve misafir erişimi eklendi.
- Apple Developer Program üyeliği tamamlandı.
- Apple ile giriş gerçek iOS development build üzerinde çalıştı.
- Firebase iOS ve Android uygulamaları yapılandırıldı.
- Android paket adı `com.yberktas.sofra`; EAS imza SHA-1 değeri Firebase'e eklendi.

## Profil ve geri bildirim

- Beğendim ve Pişirdim bağımsız seçimler olarak uygulanıyor.
- Tat sinyali yalnız Beğendim seçimini sayıyor.
- Beğendiklerim ayrı profil ekranında gösteriliyor.
- Bana göre değil listesini gösterme ve geri alma sonraki işler arasında.

## Tasarım ve tanıtım

- İlk açılış tanıtımı dört sayfaya genişletildi.
- Süre/bütçe kontrolleri ile beslenme filtreleri ayrı sayfalarda açıklanıyor.
- Tanıtım sayfaları düğmenin yanında sağa/sola kaydırma hareketiyle de değiştirilebiliyor.

## Tarif verisi

- Yemek olmayan saklama, dondurma ve et/tavuk suyu hazırlama kayıtları silinmek yerine karantinaya alındı.
- Ana yemek, atıştırmalık ve karışık protein denetimleri eklendi.
- Hatalı porsiyon verimleri ve eksik ana malzemeler için maliyet güvenlik kontrolleri uygulandı.

## Tarif maliyetleri

- Market Fiyatı kaynağı üzerinden günlük İstanbul ortalama fiyatları kullanılıyor.
- Sebze/meyvenin yanında et, tavuk, balık ve temel proteinler fiyatlandırılıyor.
- Galeta unu, mayonez, soya sosu, hardal, karbonat, ketçap, köri, kornişon turşu, nar ekşisi ve milföy günlük fiyat akışına eklendi.
- Paketli ürünlerde markalı sonuçlara izin veriliyor; benzer ürün ve gerçekçi olmayan fiyatlar filtreleniyor.
- Uzman incelemesinden kabul edilen 286 malzeme miktarı ve 108 tarif kişi sayısı canlı veritabanına işlendi.
- İşlem öncesi yedek: `/root/recipes.db.before-reviewed-import-20260903T184659Z.bak`
- v14 denetiminde 754 olan hesaplanamayan tarif sayısı, v15'te 696'ya düştü.

## Önemli Git kayıtları

- `32072a2` — Paketli ürünleri günlük market fiyatlarına ekleme
- `3dd9732` — Uzman tarafından incelenen miktarları güvenli aktarma aracı
- `a48c271` — Uzman çalışma dosyasına porsiyon düzeltme alanı
- `3a093af` — Uzman incelemesine tam tarif içeriği
- `fc18d01` — Eksik tarif miktarlarını dışa aktarma
- `9b11eff` — Profil geri bildirim listeleri ve geri alma işlemleri

## Çalışma yöntemi

1. Güncel öncelikler için `TODO.md` okunur.
2. Tamamlanan kutular işaretlenir.
3. Önemli kararlar, dağıtımlar, denetim sonuçları ve yedek yolları bu dosyaya eklenir.
4. Canlı veritabanı değişiklikleri her zaman önce kuru deneme ve yedekle uygulanır.

## Mobil build yöntemi

- Aktif iOS geliştirme ve sık ekran değişiklikleri için `development` build kullanılır.
- Development build bir kez kurulduktan sonra JavaScript değişiklikleri Metro üzerinden test edilir.
- `preview` build yalnızca kararlı kontrol noktalarında, uygulamayı Metro olmadan test etmek için üretilir.
- Android testleri şimdilik ertelendi; değişiklikler toplandıktan sonra yeni Android build alınır.

## 2026-09-04 — Test süreci standardizasyonu

- Sohbet belleği yerine depo içindeki belgeler proje gerçeği olarak belirlendi.
- `PROJECT_BRIEF.md`, `TESTING.md` ve `AGENTS.md` eklendi.
- Development-client testleri için tünel varsayılan yapıldı; LAN ayrı ve isteğe bağlıdır.
- Expo development-client bağlantısında CLI'ın ürettiği `exp+sofra-app://` bağlantısının
  kullanılması, normal uygulama şemasıyla elle bağlantı kurulmaması kaydedildi.
- Preflight ve standart mobil başlatma komutları `package.json` içine eklendi.

## 2026-09-04 — Tarif maliyet denetimi v16

- Canlı veritabanı üzerinde v16 maliyet denetimi üretildi:
  `/tmp/sofra-recipe-cost-audit-v16.csv`.
- Sonuçlar v15 ile aynı kaldı: 696 hesaplanamayan maliyet, 664 düşük kapsam,
  25 düşük maliyetli ana protein yemeği.
- Uzman incelemesi için 435 eksik miktar satırı dışa aktarıldı:
  `/tmp/sofra-missing-quantities-final.csv`.
- Öncelik dağılımı: 45 zorunlu protein, 14 tarif başlığındaki ana malzeme,
  376 maliyet kapsamını tamamlayacak diğer malzeme.

## 2026-09-04 — Üç öneri yönteminin hizalanması

- `Benim için seç` paket içi kütüphaneyi, `Mevsime göre seç` ve `Kilerimden seç`
  API veritabanını kullanıyor. Üç yöntem artık aynı kuralları uyguluyor.
- Beslenme filtreleri tek yerde toplandı: `engine.dietaryFlags`. Glutensiz,
  laktozsuz, düşük glisemik ve vegan/vejetaryen seçimleri daha önce yalnız API'ye
  gönderiliyordu; paket içi öneri bunları hiç görmüyordu.
- `ingredients.json` malzemelerine `gluten`, `lactose`, `highGlycemic`, `meat` ve
  `animalProduct` alanları eklendi. Düşük glisemik listesi
  `backend/classify_low_glycemic.py` ile birebir aynı tutuldu; şehriye, erişte ve
  tarhana iki tarafta da eksik ve TODO'ya yazıldı.
- `Etsiz` artık API'nin `is_vegetarian` tanımıyla aynı: balık da etsiz sayılmıyor.
- Süre bütçesi paket içi motorda da kesin filtre oldu (`ctx.maxMinutes`); API
  `time_budget` alanını SQL'de zaten kesin filtre olarak kullanıyor.
- Maliyet güveni ortaklaştı: `engine.costOf` artık `coverage`, `trusted` ve
  `unavailableReason` döndürüyor; eşik %70 ve gerekçeler
  `backend/recipe_costs.py` ile aynı. Fiyatı güvenilir olmayan tarif üç yöntemde
  de fiyat göstermiyor.
- Kilerdeki protein önceliği eklendi (`PROTEIN_BONUS = 0.06`); API'nin ilk
  sıralama anahtarı olan `matched_protein_count` ile aynı amaç.
- Eşitlik bozucular API zinciriyle aynı sırada: protein, eksik malzeme sayısı,
  eşleşen malzeme sayısı, tarif ayrıntısı. Epsilon karşılaştırıcı denendi ve
  geçişli olmadığı için terk edildi; ağırlık olarak puana eklendi.
- Çok benzer tarifler `engine.dropNearDuplicates` ile teke indiriliyor; başlık
  normalleştirmesi `videolu`, `tarifi`, `nasıl yapılır` gibi kaynak gürültüsünü
  atıyor. `Videolu` ifadesi API tarafında `clean_recipe_title` ile hâlihazırda
  siliniyordu; paket içi kütüphanede hiç yoktu.
- Yeni `src/suggestions.js` iki farklı yanıt biçimini tek şekle çeviriyor; yeni
  `src/SuggestionCard.js` üç yöntemin kartını tek yerden basıyor. Ekrandaki
  Türkçe/İngilizce metinler `i18n.js` içine taşındı.
- Testler: `engine.test.js` 78 -> 98, yeni `suggestions.test.js` 15 test.
  `npm test` her iki dosyayı çalıştırıyor.
- Sunucu, veritabanı veya native değişiklik gerekmiyor; JavaScript yenilemesi
  yeterli.

## 2026-09-04 — Cihaz testi: mayonez bulgusu

- `Kilerimden seç` filtrelerle birlikte "Ev yapımı mayonez", "Mayonez" ve
  "Sarımsaklı mayonez" döndürdü. İki ayrı kusur çıktı.
- Yumurta, yağ ve limon içeren bir kiler, mayonez tarifinin bütün malzemelerini
  eşliyor; tarif %100 eşleşme ve "Hazır" olarak en üste çıkıyor. Yumurta
  `protein` sınıfında olduğu için bu oturumda eklenen kiler protein önceliği
  sorunu büyütmüştü.
- `dinner_category_score` içine başlık sonundaki ada göre reddetme eklendi
  (`NOT_A_MEAL_HEADS`). Alt dizi araması kullanılamaz: "sos" ifadesi "soslu
  makarna" içinde, "hardal" ifadesi "hardallı tavuk" içinde geçiyor. Türkçe ad
  öbeği sonda olduğu için yalnız son kelime sınanıyor.
- `backend/test_dinner_suitability.py` eklendi; fastapi kurulu değilse atlanıyor.
- Tekrar eleme kapsama (containment) kuralıyla güçlendirildi ve kategori
  koşulundan çıkarıldı: aynı tarif birden çok kategoriyle geldiği için
  kategoriye bağlı karşılaştırma mayonez üçlüsünü kaçırıyordu.
- "Ev yapımı mayonez" ile "Sarımsaklı mayonez" bilerek ayrı bırakıldı; bunları
  birleştiren bir kural mercimek ve domates çorbasını da birleştirir. Bir çeşniyi
  akşam yemeği listesinden çıkaran şey tekrar eleme değil, yemeğe uygunluk.
- Testler: `engine.test.js` 98 -> 102.
- **Bu değişiklik sunucu dağıtımı gerektiriyor**: `backend/recipe_api.py`
  değişti, `deploy-sofra` çalıştırılmalı.

## 2026-09-04 — Ağ hatalarının görünür ve tekrar denenebilir olması

- Kiler ekranı "Tarif önerileri yüklenemedi" gösterdi. Sunucu kaydına göre istek
  sunucuya hiç ulaşmamıştı: aynı ekranın ilk çağrısı (`/kiler/ingredients`)
  17:32:55'te 200 döndü, `/recipes/tonight` ise kayıtta hiç görünmüyor.
- React Native yaklaşık bir dakika bekleyip `TypeError: Network request failed`
  veriyor; bu mesaj sinyalsiz telefonla aynı. Artık her çağrı `src/api.js`
  içindeki `request` fonksiyonundan geçiyor ve zaman aşımı taşıyor:
  hızlı uçlar 15s, sıralama uçları 30s, market fiyatları 35s.
- `error.kind` üç durumu ayırıyor: `timeout`, `offline`, `http`. `apiErrorKey`
  bunu i18n anahtarına çeviriyor, ekranlar `error.kind` bilmiyor.
- `ui.js` içine `ErrorNotice` eklendi: mesaj ve yerinde yeniden dene düğmesi.
  Bu Akşam ekranı hangi düğmenin çalıştığını hatırlıyor; Kiler ekranı yeniden
  denemeyi mevcut effect üzerinden yapıyor (`reloadToken`).
- "Yemek bulunamadı" ile "istek başarısız" ayrıldı: ilkinde yeniden dene
  düğmesi yok, çünkü tekrar denemek aynı sonucu verir.
- Yeni `src/__tests__/i18n-keys.test.js`: ekranların istediği her çeviri
  anahtarının `i18n.js` içinde tanımlı olduğunu doğruluyor. `makeT` eksik
  anahtarda anahtarın kendisini döndürdüğü için yazım hatası sessizce yayına
  çıkıyordu. İki test de bilerek bozularak sınandı.
- Ölçüm: `/recipes/tonight` sunucuda 6 kiler malzemesi ile limit 1, 5 ve 20
  için sırasıyla 5,93s / 5,87s / 5,95s. Süre limitten
  bağımsız olduğu için maliyet ekleme değil, sorgunun kendisi yavaş.
  `recipe_kiler` ve `recipe_completeness` CTE'leri her istekte tüm
  `recipe_ingredients` tablosunu tarıyor. TODO'ya yazıldı.
- Sunucu değişikliği yok; JavaScript yenilemesi yeterli.

## 2026-09-04 — /recipes/tonight yeniden yazıldı

- Ölçüm: sorgu limitten bağımsız 5,9 saniye. Sebep indeks eksikliği değil;
  indeksler var ve kullanılıyor. İki CTE her istekte tüm kütüphaneyi tarıyordu:
  `recipe_kiler` geçici B-tree ile 1.331.238 satır üretiyor (2,66s),
  `recipe_completeness` 1,63M satırı tarife göre grupluyor (2,21s).
- Kütüphane ölçeği: 174.949 tarif, 1.629.216 tarif-malzeme satırı, 150.441
  malzeme, 8.198 kiler eşlemesi, 807 kiler malzemesi.
- `matched` artık seçilen kiler kimliklerinden başlıyor: en yaygın altı malzemeyle
  0,375s, sıradan altı malzemeyle 0,034s, seyrek altı malzemeyle 0,003s.
- `total_kiler_ingredients` ve ham/eşlenmemiş malzeme sayıları isteğe değil
  tarife bağlı. Yeni `recipe_kiler_stats` tablosuna alındı;
  `backend/refresh_recipe_kiler_stats.py` kuruyor (`--dry-run`, `--verify`).
  Tablo yanına kurulup takas ediliyor, yarı dolu tablo okunmuyor.
- Tablo yoksa veya tüm tarifleri kapsamıyorsa API sayıları eskisi gibi yerinde
  hesaplıyor (`recipe_kiler_stats_ready`, 120 saniyelik önbellek). Yani kod
  tablodan önce kurulursa yavaş çalışır, bozulmaz; tarif içe aktarımından sonra
  bayat tablo sessizce tarif düşürmez.
- Denklik testi: `backend/test_tonight_equivalence.py` sentetik bir kütüphane
  kuruyor, mevcut kodu ve seçilen git sürümünü iki modül olarak yükleyip her
  sıralama alanını ve sıralama düzenini karşılaştırıyor. 11 senaryo × 2 kod yolu
  + bayat tablo senaryosu: tamamı aynı.
- Bu test gerçek bir hatayı yakaladı: `t.total_kiler_ingredients` yer değiştirmesi
  `st.total_kiler_ingredients` içine de girip `ss.` üretmişti. Yalnız önbellekli
  yolda, yani yenileme çalıştıktan sonraki canlı yolda patlayacaktı.
- `/recipes/by-kiler` aynı düzeltmeyi almadı; ölçülmediği için dokunulmadı,
  TODO'ya yazıldı.
- **Dağıtım sırası**: push -> `deploy-sofra` -> `refresh_recipe_kiler_stats.py`
  -> `--verify`. Ters sıra da güvenli, yalnız arada yavaş kalır.

## 2026-09-04 — Kiler listesinde tekrarlayan tarifler

- Cihaz testinde Kiler listesinde dört "Taze Fasulye" göründü. Ekran görüntüsüne
  göre dördünün başlığı birebir aynı; yalnız kategori (Sebze, Zeytinyağlı) ve
  süre (35/40/45 dk) farklı. Yani gerçek kopya başlıklar.
- Sebep: Kiler ekranı (`app/(tabs)/mutfak.js`, bileşen adı `Kiler`) API
  satırlarını doğrudan kendi kartına basıyordu; tekrar eleme yalnız Bu Akşam
  ekranında çalışıyordu. Artık iki kural da uygulanıyor.
- İki ayrı sorun, iki ayrı kural:
  `dropNearDuplicates` aynı ve kapsanan başlıkları teke indiriyor;
  yeni `capByHeadNoun` aynı ana adı (Türkçede son kelime) taşıyan yemek sayısını
  sınırlıyor. Zeytinyağlı, etli ve fırında taze fasulye üç ayrı yemek olduğu için
  birleştirilmiyor, sayıları sınırlanıyor. Kiler listesinde en fazla 2,
  Bu Akşam'ın üç kartında en fazla 1.
- `yemek`, `yemeği`, `yemekleri` kelimeleri gürültü listesine eklendi: "Taze
  Fasulye" ile "Taze Fasulye Yemeği" aynı yemek, ve "yemeği" ana ad olamaz.
- Bu Akşam'da `topUp` seçeneği var: sınır yüzünden üç karttan azı kalırsa
  çıkarılanlar sıralamayı bozmadan geri konuyor. Uzun listede bilerek kapalı;
  açık olsaydı havuz yirmiden küçük olduğu her durumda sınır anlamsızlaşırdı.
  Bu, testin yakaladığı bir tasarım hatasıydı.
- Testler: `engine.test.js` 102 -> 109, `suggestions.test.js` 15 -> 20.
- Kalıcı çözüm kaynak veride: aynı başlıklı tarifleri birleştirmek veya
  karantinaya almak. TODO'ya yazıldı.
- Sunucu değişikliği yok; JavaScript yenilemesi yeterli.

## 2026-09-04 — Yayın hazırlığı: bulunanlar ve gizlilik politikası

- **Hesap silme zaten yapılmış.** `app/account.js` içinde tam akış var: şifre,
  Google ve Apple için yeniden kimlik doğrulama, `deleteCloudUserState`,
  `deleteUser`, cihazdaki kopyanın silinmesi ve iki adımlı onay. Profilim
  ekranından `/account` ile erişiliyor. TODO iki yerde yanlıştı, düzeltildi.
  Kalan iş: gerçek cihazda üç giriş yöntemiyle denemek.
- **Bildirimler yalnız yerel.** `notifications.js` günlük hatırlatmayı cihazda
  planlıyor; `getExpoPushToken` çağrısı yok. Yani "push notification
  yapılandırması" maddesi gereksiz ve gizlilik politikasında bildirim
  belirtecinden söz etmek gerekmiyor.
- **Yayın için en kritik bulgu**: `app.json`, API `http://129.121.89.248:8000`
  adresinde olduğu için iOS'ta ATS'i tamamen kapatıyor
  (`NSAllowsArbitraryLoads`) ve Android'de cleartext trafiğe izin veriyor.
  Blanket ATS istisnası bilinen bir App Store ret gerekçesi. Ayrıca kilerdeki
  malzemeler ve beslenme tercihleri şifresiz gidiyor. `HTTPS_SETUP.md` yazıldı:
  alan adı, Caddy ile otomatik Let's Encrypt sertifikası, 8000 portunun
  kapatılması, politikanın aynı alan adından yayımlanması ve uygulama tarafı
  değişiklikleri. Son ikisi native yapılandırma olduğu için **yeni build
  gerektiriyor**, Metro yenilemesi yetmiyor.
- Gizlilik politikası taslakları koddan yazıldı, şablondan değil:
  `legal/gizlilik-politikasi.md` (Türkçe, sunulacak olan) ve
  `legal/privacy-policy.md`. Her iddia `cloudStore.js`, `auth.js`,
  `notifications.js`, `account.js`, `firestore.rules` ve `recipe_api.py` ile
  karşılaştırıldı. Analitik, reklam, çökme raporlama aracı yok; misafir
  kullanımda hiçbir veri buluta gitmiyor.
- **Beslenme filtrelerinin çerçevesi düzeltildi.** İlk taslak bunları KVKK m.6
  kapsamında özel nitelikli veri sayıyordu. Bu fazla iddialıydı: Sofra bir yemek
  uygulaması ve insanlar çoğu zaman kendileri için değil, sofradaki başkaları
  için yemek yapıyor. "Glutensiz" işareti hesap sahibinin sağlığı hakkında
  güvenilir bir bilgi vermez. Politikada artık "yemek filtresi" olarak
  tanımlanıyor, hukuki dayanak sözleşmenin ifası. Kalan risk, bir denetçinin
  filtreyi çıkarımsal sağlık verisi sayması; taslak bunu filtreleri başka hiçbir
  amaçla kullanmayarak azaltıyor. Karar hukukçuya ait.
- **Ama bu, filtrenin doğruluğunu güvenlik konusu yapıyor.** Çölyak hastası bir
  çocuk için filtre işaretleyen biri, filtrenin çalışmasına güveniyor. SQL'deki
  `kig.contains_gluten = 1` koşulu, malzeme `kiler_ingredients` tablosuna
  eşlenmemişse NULL döndürüyor ve tarif glutensiz filtresinden geçiyor. Yani
  hata yanlış tarafta: unu tanınmayan bir yazımla yazılmış tarif, glutenden
  kaçınan kişiye gösteriliyor. `unmapped_ingredient_count` sütununun varlığı
  eşlenmemiş malzemenin yaygın olduğunu gösteriyor. Ölçüm ve düzeltme TODO
  bölüm 5c'ye eklendi.
- Politikaya, filtrelerin kusursuz olmadığını ve tıbbi zorunluluk varsa malzeme
  listesinin kontrol edilmesi gerektiğini söyleyen bir uyarı eklendi. Aynı
  uyarının uygulama içinde de görünmesi gerekiyor.
- Yayımlanan politika adresi App Store Connect ve Google Play için zorunlu ve
  uygulama listede olduğu sürece erişilebilir kalmalı.
- Yayıncı: Yigit Berktaş, birey olarak. İletişim için Sofra'ya ayrı bir e-posta
  adresi kullanılacak.

## 2026-09-04 — Alan adları ve HTTPS hazırlığı

- Alan adları alındı: `buaksamnepisireyim.com` ve `buaksamnepisireyim.online`.
  Karar: `.com` site ve gizlilik politikası, `api.buaksamnepisireyim.com` API,
  `.online` kalıcı olarak `.com`'a yönlenir. Tek marka, tek sertifika seti, tek
  politika kopyası. API'yi ayrı alan adına koymak ikinci bir sertifika ve ikinci
  bir bakım noktası demek olurdu; faydası yok.
- `site/Caddyfile` gerçek adlarla hazır: API ters vekil, site dosya sunucusu,
  `.online` yönlendirmesi, HSTS başlıkları, günlük dosyası döndürme.
- `site/gizlilik.html` ve `site/privacy.html`, `legal/*.md` dosyalarından
  üretildi. Kendi kendine yeten sayfalar: dış CDN veya font isteği yok, telefon
  öncelikli, koyu tema uyumlu, iki dil birbirine bağlı. Taslak notu (hukukçu
  uyarısı) yayımlanan sayfaya sızmıyor; bunu bir sınama ile doğruladım.
- `site/index.html`: mütevazı bir açılış sayfası. Politikadan yukarı tıklayan bir
  inceleme uzmanının 404 görmemesi için. Uygulamanın henüz yayına hazırlandığını
  söylüyor, doğru olmayan hiçbir şey iddia etmiyor.
- Yürürlük tarihi 4 Eylül 2026, iletişim `iletisim@buaksamnepisireyim.com`.
  **Bu adresin yayından önce posta alması gerekiyor.**
- `https-cutover.patch` hazır ama **bilerek uygulanmadı**: `API_URL`
  değişikliği, `NSAppTransportSecurity` bloğunun kaldırılması ve
  `expo-build-properties` girdisinin çıkarılması. Bugün uygulanırsa uygulama
  API'ye erişemez. `git apply --check` mevcut ağaçta geçiyor; `app.json`
  round-trip'i özgün biçimlendirmeyle birebir aynı olduğu için yalnız hedef iki
  blok değişiyor.
- Sonraki adımların sırası `TODO.md` bölüm 7a'da: DNS, e-posta, Caddy, doğrulama,
  port kapatma, yama, yeni build, politika güncellemesi.

## 2026-09-04 — Profil geri bildirimi üç yöntemde de geçerli

- TODO bölüm 3'ün üç maddesi zaten yapılmıştı: `src/ProfileRecipeList.js`
  beğendiklerim, pişirdiklerim ve bana göre değil listelerini tarihe göre
  sıralı gösteriyor, her satırda `removeFeedback` çağıran bir Geri al düğmesi
  var ve hem paket içi hem API tariflerini açabiliyor. `ben.js` üçüne de
  bağlantı veriyor. Kutular işaretlendi. (Bu oturumda üçüncü kez TODO'nun
  gerçeğin gerisinde kaldığı görüldü — hesap silme ve bildirimlerden sonra.)
- Gerçekten eksik olan iki şey vardı ve ikisi de aynı sebepten: pişirme ve
  ret geçmişi cihazda, `state.profile` içinde duruyor; API bunu göremez.
  - Paket içi motor son pişirilen tarifi `repetitionPenalty` ile geriye
    çekiyordu; `Mevsime göre seç`, `Kilerimden seç` ve Kiler sekmesi listesi
    profili hiç görmüyordu.
  - `Bana göre değil` hiçbir yerde bastırma yapmıyordu. `PROJECT_BRIEF.md`
    "gelecekteki uygunsuz önerileri bastırmalı" diyor; paket içi motorda yalnız
    en fazla 0,22 puanlık bir ceza vardı, yani reddedilen yemek yine başa
    gelebiliyordu. API yöntemlerinde hiç etkisi yoktu.
- Çözüm `engine.js` içinde tek yerde: `isRejected`, `daysSinceCooked`,
  `cookedRecently` ve bunları listeye uygulayan `dropRejected`.
  `suggestions.normalize` ve Kiler listesi aynı işlevi çağırıyor.
- Ayrım bilinçli: **ret kesin**, profil ekranından geri alınana kadar bir daha
  gelmiyor. **Bekleme süresi esnek** (7 gün): boş ekrandan iyidir, bu yüzden
  `topUp` istendiğinde en eski pişirilenler geri konuyor. Ret bu durumda bile
  geri gelmiyor; testte kart sayısı bire düşse dahi doğrulanıyor.
- "Bu akşam olmaz" (soft skip) bastırılmıyor: bu "bu akşam değil" demek, "asla"
  değil. Puan cezası olarak kalıyor ve bunun böyle kaldığı test ediliyor.
- Normalleştirilmiş öneri şekline `profileKey` eklendi: paket içi tarif kendi
  kimliğiyle, API tarifi `api:<id>` ile saklanıyor (`apiRecipeForLearning`).
  Ekranlar artık bu ayrımı bilmek zorunda değil.
- `i18n-keys` testindeki bir hata düzeltildi: satır içi Türkçe metin arayan
  düzenli ifade, tek tırnaklar arasında satır sonu geçmesine izin verdiği için
  bir açıklama satırını yakalayıp koda değil metne takılıyordu. Gerçek bir
  regresyonu hâlâ yakaladığı yeniden sınandı.
- Testler: `engine.test.js` 109 -> 115, `suggestions.test.js` 20 -> 24.
- Sunucu değişikliği yok; JavaScript yenilemesi yeterli.

## 2026-09-04 — Katalog eklemelerini etkiye göre sıralama

- Önemli bağlantı: `backend/recipe_costs.py` kataloğunu
  `assets/data/ingredients.json` dosyasından okuyor — yani paket içi uygulamanın
  kataloğu ile maliyet motorunun kataloğu aynı dosya. Oraya eklenen her kalem
  175 bin tarifli API kütüphanesinin maliyet kapsamını da iyileştiriyor.
- `backend/rank_catalog_gaps.py` yazıldı. Eşleştirme kurallarını yeniden
  yazmıyor; `recipe_costs` modülünü içe aktarıyor ve `market_prices` modülünü
  bir taslakla değiştiriyor (kapsam aritmetiği fiyata bağlı değil). Böylece
  sistem python'uyla çalışıyor ve saydığı eksik kalem, canlı kodun da
  eşleştiremediği kalem oluyor.
- Ölçüt "kaç tarifte geçiyor" değil, "kaç tarifi yayımlanabilir maliyete
  taşıyor". Sentetik sınamada ortaya çıkan şey bu ayrımı gösteriyor: yalnız
  zerdeçalı eksik olan dört malzemeli bir tarif zaten yayımlanıyor, çünkü kapsam
  3/4 = %75 ve eşik %70. Üç malzemeli bir tarifte cheddar eklemek kapsamı
  %67'den %100'e çıkarıyor ve tarifi açıyor.
- Bu nedenle TODO'daki elle yazılmış üç katalog listesi (zerdeçal, defne
  yaprağı, reyhan, fesleğen…) muhtemelen düşük etkili: baharatlar küçük
  miktarlarda kullanılıyor ve kapsamı eşiğin altına düşürmüyorlar. Maddeler
  üstü çizili bırakıldı, sıralama araçtan gelecek.
- Ekler birbirini etkiliyor: üç malzemeli ve yalnız biri fiyatlanan bir tarif,
  iki eksik kalem birlikte eklenene kadar eşiği geçmiyor. Tek tek açgözlü seçim
  her birini sıfır kazançla puanlıyor ve hiçbirini seçmiyor — sınamada en büyük
  grup böyle atlandı. Bu yüzden tek kalem işe yaramadığında en iyi ikili
  aranıyor; sentetik sınamada 9 tarifin 9'u üç adımda açıldı
  ("cheddar", "hindi göğsü", "zerdeçal + safran").
- Araç fiyat üretmiyor. Fiyat gerçek dünya verisi; iskelet çıktısında `price`
  alanı boş bırakılıyor ve elle doldurulması gerekiyor.

## 2026-09-05 — Kaynak veri kalitesi: ölçüm araçları

- İki TODO maddesi de canlı veritabanına yazma gerektiriyor, bu yüzden önce
  ölçüm. İkisi de kuralları kopyalamak yerine canlı kodu içe aktarıyor.
- `backend/_load_api.py`: FastAPI ve pydantic'i taklit ederek `recipe_api`
  modülünü içe aktarıyor. VPS'te API sanal ortamda çalışıyor, sistem python'unda
  fastapi yok; `clean_recipe_title`, `dinner_category_score` ve
  `NOT_A_MEAL_HEADS` her denetim betiğine kopyalansaydı bir ay içinde canlı
  davranıştan ayrışırdı. Taklitler her yerde kullanılıyor, böylece denetim
  VPS'te, dizüstünde ve CI'da aynı sonucu veriyor.
- `backend/audit_duplicate_titles.py`: aynı başlığı taşıyan tarifleri malzeme
  örtüşmesine göre kümeliyor. Sentetik sınamada ortaya çıkan iki hata
  düzeltildi:
  - Başlık anahtarı yalnız `clean_recipe_title` kullanıyordu; bu yalnız
    "videolu" siliyor, dolayısıyla "Taze Fasulye Tarifi" ayrı bir başlık
    sayılıyordu. `engine.js` içindeki gürültü listesi yansıtıldı. (Aynı listeyi
    `clean_recipe_title` içine almak görünen başlıkları da iyileştirir; bu ayrı
    ve kullanıcıya görünür bir değişiklik.)
  - Sınıflandırma grup düzeyindeydi: tek bir gerçek varyant, grubun tamamını
    "varyant" yapıp içindeki gerçek kopyaların kaçmasına yol açıyordu. Artık
    önce kümeleme yapılıyor; bir başlık aynı anda hem kopya hem varyant
    barındırabiliyor.
  - Benzerlik eşiği bir bayrak, çünkü karar veriye bağlı: sınamada dört
    malzemeden üçünü paylaşan bir tarif %75 ile %80 eşiğinin hemen altında
    kaldı. Çıktı örneklerde örtüşme oranını yazıyor.
- `backend/audit_dinner_classification.py`: puan kovalarını ve 0 puan alan
  kategorileri büyüklüğüne göre listeliyor. Asıl boşluk 0 puan: anahtar
  kelimelerin tanımadığı bir kategori, nötrmüş gibi davranıp gerçek akşam
  yemekleriyle eşit yarışıyor.
- Hangi kopyanın kalacağı ayrı ve ikinci bir aşama. Malzeme örtüşmesi iki
  kaydın aynı yemek olduğuna zaten karar verdi; hangisinin kalacağına
  **hazırlanış** karar veriyor: daha uzun ve daha adımlı olan kazanıyor.
  Miktarlar ve üstveri yalnız eşitlik bozucu. İlk sürümde hepsi tek bir
  puana karıştırılmıştı ve hazırlanış 4000 karakterde kesiliyordu; bu yüzden
  iki fazla malzeme satırı olan bir kopya, on adımlık düzgün bir anlatımı
  yenebiliyordu. Sınamada bu durum doğrulandı: dört malzeme ve on adım,
  altı malzeme ve tek satırlık anlatımı geçiyor.
- Hazırlanışın nerede durduğu şemadan bulunuyor: `recipes` üzerinde bir metin
  sütunu ya da ayrı bir adım tablosu. Uzunluk ve adım sayısı SQL içinde
  hesaplanıyor; 175 bin tarifin metnini python'a çekmek yüz megabaytı satır
  sonu saymak için taşımak olurdu. İki şema biçimi de sınandı.
- Karantina kararı: silmek yerine `recipe_exclusions`. Geri alınabilir ve
  silinen bir tarif, kullanıcının profilinde `api:<id>` olarak asılı kalır.
- Henüz hiçbir veri değişmedi.

## 2026-09-05 — Akşam yemeği sınıflandırması: Türkçe katlama ve kategori tablosu

Bir önceki turda yazılan iki denetim aracı canlı veritabanında çalıştırıldı.
Sonuçlar iki isteği birbirinden ayırdı: biri yapıldı, diğeri veriyle birlikte
düştü.

**Kopya başlıkların karantinaya alınması yapılmadı, çünkü ölçüm gereksiz
olduğunu gösterdi.** Araç 1.357 karantinaya alınabilir tarif buldu. En büyük
on kümenin tamamı — sütlaç, revani, ıslak kek, pankek — `dinner_category_score`
tarafından zaten -100 alıyor, yani öneriye hiç girmiyor. Listedeki tek istisna
limonataydı ve o da 0 alıyordu; nedeni kopya olması değil, aşağıdaki katlama
hatasıydı. Karantina kullanıcının gördüğü hiçbir şeyi değiştirmeyecekti;
karşılığında canlı veritabanına 1.357 satırlık bir yazma riski vardı. İstenen
ölçüm, isteği çürüten şey oldu.

**Sınıflandırma yapıldı ve asıl kazanç oradaydı.** Denetimin satırı şuydu:
16.918 tarif (%9,7) hiçbir kurala takılmıyor, 0 puanla gerçek akşam
yemekleriyle eşit yarışıyor.

- Türkçe katlama hatası. `str.casefold()` İ harfini "i" artı birleşen nokta
  (U+0307) yapıyor, dolayısıyla `"içecek" in "i̇çecekler"` her zaman yanlıştı.
  2.260 içecek tarifi kendi anahtar kelimesi tabloda dururken hiç
  reddedilmemiş. `fold_tr()` casefold'dan sonra ı'yı i'ye çeviriyor ve NFKD
  ayrıştırmasından sonra birleşen işaretleri atıyor. Hem metin hem de dört
  anahtar kelime tablosu bundan geçiyor, böylece aynı alfabede buluşuyorlar.
  Tablolar içe aktarımda bir kez katlanıyor: `dinner_category_score` her aday
  satır için çalışıyor, her çağrıda katlamak dolu bir kilerde milyonlarca
  işlem demekti.
- `CATEGORY_SCORES`. Denetimin listelediği kategori adları birebir eşleşme
  tablosuna alındı. Tablo yalnızca bütün anahtar kelime kuralları 0
  döndürdükten sonra okunuyor. Bu sıralama değişikliği eklemeli yapan şey:
  bir kategori adı, hâlihazırda puanlanmış bir tarifi asla ters çeviremiyor.
- Belirsiz kategoriler kasıtla dışarıda bırakıldı. "(kategorisiz)" 2.074,
  "Diğer Tarifler" 301, "Dünya Mutfaklarından Tarifler" 118, "Pratik Yemek
  Tarifleri" 400 — hepsi hem akşam yemeği hem tatlı barındırıyor. Adından
  çıkarılamayan yerde tahmin, görüşsüzlükten kötüdür.

Doğrulama, elle seçilmiş örneklerle yetinmedi. Kullanıcının çalıştırdığı sürüm
ile yeni sürüm 4.937 girdide yan yana koşturuldu; girdiler dört anahtar kelime
tablosunun tamamından, başlık sonu adlarından, denetimin kategori adlarından ve
gerçek tarif başlıklarından üretildi. Eski kural, katlama işlevi değiştirilebilir
biçimde yeniden yazıldı ve önce eski sürümü birebir ürettiği doğrulandı — yoksa
karşılaştırmanın bir anlamı olmazdı. Sonuç: eski görüşün bozulduğu 0 durum,
"katlama düzeltmesi ya da kategori tablosu" dışında açıklanamayan 0 durum.
Değişen 916 girdinin 803'ü eskiden 0 alıyordu, 113'ü ise eski kodun kendi
anahtar kelimesini bulamadığı durumlardı.

`backend/test_dinner_suitability.py` 50 vakaya çıktı ve artık `_load_api`
üzerinden içe aktarıyor. Eskisi `pytest.importorskip("recipe_api")`
kullanıyordu: fastapi kurulu olmayan bir makinede sınama sessizce atlanıyordu,
yani hiç koşmadığı halde yeşil görünüyordu.
