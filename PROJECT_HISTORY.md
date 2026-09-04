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
