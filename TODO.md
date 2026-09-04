# Sofra — Yapılacaklar

Bu dosya Sofra projesinin kalıcı ana iş listesidir. Yeni işler buraya eklenir; tamamlananlar işaretlenir ve ayrıntılı sonuçlar `PROJECT_HISTORY.md` dosyasına yazılır.

## 1. Hesap ve senkronizasyon

- [x] E-posta doğrulama
- [x] Şifre yenileme
- [x] Çıkış yapma
- [x] Misafir erişimi
- [x] Hesabı ve kullanıcıya ait bulut verilerini silme
- [ ] Uygulama açıkken cihazlar arasında gerçek zamanlı eşitleme
- [ ] İnternet kesilince değişiklikleri sıraya alıp yeniden gönderme
- [ ] Eş zamanlı cihaz değişikliklerini güvenli birleştirme
- [ ] İki farklı hesabın verilerinin karışmadığını doğrulama
- [ ] Misafir verilerini kayıtlı hesaba taşıma

## 2. Giriş yöntemleri ve mobil testler

- [x] Apple Developer üyeliği
- [x] Apple ile girişin iOS cihazda testi
- [x] Firebase Android uygulaması ve SHA-1 yapılandırması
- [ ] Google ile girişin gerçek Android cihazda testi
- [ ] Android preview APK testi
- [ ] iOS development build regresyon testi
- [ ] Oturum kalıcılığını iOS ve Android'de doğrulama

## 3. Profil ve kullanıcı tercihleri

- [x] Beğendiklerim listesi
- [x] Beğendim ve Pişirdim seçimlerini bağımsız tutma
- [x] Tat sinyallerini yalnız Beğendim üzerinden sayma
- [x] Bana göre değil listesini profil altında gösterme
- [x] Bana göre değil seçimini geri alma (`ProfileRecipeList` içinde Geri al)
- [x] Pişirdiklerim için ayrı tam liste
- [x] Yakın tarihte pişirilen tarifin tekrar önerilmesini sınırlama — üç
  yöntemde de. Paket içi motor zaten puan düşürüyordu; API yöntemleri geçmişi
  hiç görmüyordu, çünkü geçmiş cihazda duruyor
- [x] Bana göre değil seçiminin gerçekten bastırılması. `PROJECT_BRIEF.md` bunu
  ürün kuralı olarak yazıyor ama hiçbir yerde uygulanmıyordu: paket içi motorda
  yalnız 0,22 puan cezası vardı, API yöntemlerinde hiç yoktu
- [x] Profil filtrelerinin üç öneri motorunda aynı çalıştığını doğrulama
  (bölüm 4 ile birlikte, cihazda doğrulandı)
- [ ] Bekleme süresini ve bastırmayı gerçek cihazda doğrulama: bir tarifi
  Pişirdim işaretleyip üç yöntemde bir hafta görünmediğini, Bana göre değil
  işaretleyip hiç görünmediğini, Geri al'dan sonra döndüğünü kontrol etme

## 4. Tarif motoru

- [x] Benim İçin Seç, Mevsime Göre Seç ve Kilerimden Seç ekranlarını hizalama
- [x] Kişi başı fiyat ve tarif bilgilerinin üç yöntemde aynı gösterilmesi
- [x] Etsiz, glutensiz, laktozsuz ve düşük glisemik filtrelerini tüm motorlarda doğrulama
- [x] Kilerde seçilmiş tavuk, et veya balığı uygun tariflerde önceliklendirme
- [x] Eşleşen malzeme sayısını sıralamada öne alma
- [x] Eşitlikte daha uzun ve ayrıntılı tarifi seçme
- [x] Çok benzer tarif tekrarlarını azaltma
- [x] Kiler listesinde aynı adı taşıyan tarifleri teke indirme (kütüphanede
  birebir "Taze Fasulye" başlıklı dört ayrı tarif var)
- [x] Bir öneri listesinde aynı ana addan en fazla belirli sayıda yemek
- [ ] Aynı adı taşıyan tarifleri kaynak veride birleştirme veya karantinaya alma
- [ ] Ana yemek, atıştırmalık ve yardımcı hazırlık sınıflandırmasını geliştirme
- [x] Mayonez, sos, salça, hamur gibi yardımcı hazırlıkları akşam yemeği
  önerilerinden çıkarma (başlık sonundaki ada göre)
- [x] Yemek olmayan saklama/hazırlık kayıtlarını karantinaya alma
- [x] Gerçekte videosu olmayan tariflerden “Videolu” ifadesini kaldırma
- [ ] Düşük glisemik sınıflandırmasına şehriye, erişte ve tarhanayı ekleyip
  `classify_low_glycemic.py` betiğini canlı veritabanında yeniden çalıştırma
- [ ] Süre bütçesinin kesin filtre olmasının öneri havuzunu ne kadar daralttığını
  gerçek cihazda ölçme
- [ ] Tarifler ve Mutfak ekranlarını da ortak öneri kartına taşıma

## 5. Tarif maliyetleri

- [x] Günlük İstanbul Market Fiyatı bağlantısı
- [x] Et, tavuk ve balık fiyatlarını maliyet motoruna bağlama
- [x] İlk paketli ürün grubunu günlük fiyat akışına ekleme
- [x] 286 malzeme miktarı ve 108 tarif porsiyonunu veritabanına aktarma
- [x] Katalog eklemelerini etkiye göre sıralayan araç —
  `backend/rank_catalog_gaps.py`. Gerçek maliyet motorunu içe aktarıyor, yani
  saydığı eksik kalem canlı kodun da eşleştiremediği kalem
- [ ] Aracı canlı veritabanında çalıştırıp öncelik listesini belirleme
- [ ] Öncelik listesindeki kalemleri `assets/data/ingredients.json` içine ekleme
  (fiyat, birim, kind, cls alanları elle doldurulacak — fiyat gerçek dünya
  verisi, tahmin edilmemeli)
- [ ] Güvenli ad eşleştirmeleri: yağ, çorba kaşığı un, kültür mantarı, maydanoz, köy biberi
- [ ] ~~Kataloğa ekleme: zerdeçal, margarin/Teremyağ, defne yaprağı, reyhan, fesleğen~~
- [ ] ~~Kataloğa ekleme: cheddar, sosis, dolmalık fıstık, avokado, kişniş~~
- [ ] ~~Kataloğa ekleme: kuyruk yağı, safran, salam~~
  — bu üç liste elle seçilmişti. Sıralama araçtan gelecek: baharatlar küçük
  miktarlarda kullanıldığı için kapsamı %70 eşiğinin altına genellikle
  düşürmüyor, yani muhtemelen düşük etkili. Araç çalıştıktan sonra bu maddeler
  gerçek öncelikle yeniden yazılacak
- [ ] Yeni ürünlerde yanlış eşleşme ve aykırı fiyat testleri
- [ ] v16 uzman dosyasındaki kalan 435 miktar satırını tamamlama (45 zorunlu protein,
  14 başlık malzemesi, 376 maliyet kapsamı)
- [ ] Öncelikli miktarlar: kaşar, un, tereyağı, domates, sucuk, galeta unu
- [ ] Bozuk ondalık ve hatalı kilogram kayıtlarını kaynak veride düzeltme
- [ ] Veritabanına yedekli aktarım sonrası v16 maliyet denetimi

## 5b. Ağ dayanıklılığı

- [x] Tüm API çağrılarına zaman aşımı ekleme
- [x] Yavaş sunucu ile bağlantı yokluğunu ayrı mesajlarla gösterme
- [x] Bu Akşam ve Kiler ekranlarına yeniden dene düğmesi
- [x] `/recipes/tonight` sorgusunu hızlandırma (kilerde 6 malzemeyle 5,9 saniye;
  süre limit değerinden bağımsız, yani maliyet ekleme değil sorgunun kendisi)
- [ ] `/recipes/by-kiler` ucunda aynı düzeltmeyi uygulama (hâlâ tüm kütüphane
  üzerinde `recipe_kiler` kuruyor)
- [ ] Veri değiştiren betiklerin sonuna `refresh_recipe_kiler_stats` çağrısı ekleme
- [ ] Tarifler, Pazar ve tarif ekranlarına da yeniden dene düğmesi

## 5c. Filtre güvenilirliği

Bu bir güvenlik konusu: insanlar kendileri için değil, çölyak hastası bir çocuk
ya da misafir için de filtre işaretliyor.

- [ ] Eşlenmemiş malzemesi olan tariflerin glutensiz/laktozsuz filtrelerinden
  geçtiğini ölçme. SQL'de `kig.contains_gluten = 1` koşulu, eşlenmemiş malzemede
  NULL döndüğü için tarif filtreden geçiyor — yanlış tarafta bir hata.
- [ ] Ölçüm sonucuna göre: eşlenmemiş malzeme içeren tarifleri katı filtrelerde
  eleme veya "malzemeleri kendin kontrol et" uyarısıyla işaretleme
- [ ] `contains_gluten` ve `contains_lactose` bayraklarının kapsamını denetleme

## 6. Tasarım ve kullanıcı deneyimi

- [x] Bu Akşam, Tarifler ve Liste için arka plan görselleri
- [x] Arka plan görsellerinin görünürlüğünü artırma
- [x] İlk açılış tanıtımını dört sayfalı ve kaydırılabilir hale getirme
- [x] İlk girişte filtrelerin ne yaptığını açıklama
- [ ] Varsayılan Türkçe dilini temiz kurulumda yeniden doğrulama
- [ ] Günlük hatırlatma deneyimini geliştirme
- [ ] Uygulama ikonu ve açılış ekranı
- [ ] Erişilebilirlik kontrolü
- [ ] Uzun listelerde performans ve VirtualizedList optimizasyonu

## 7. Yayına hazırlık

### 7a. HTTPS geçişi — sıra önemli, `HTTPS_SETUP.md`

Yayın için en kritik madde: ATS'in tamamen kapatılması bilinen bir App Store
ret gerekçesi. Alan adları alındı: `buaksamnepisireyim.com` (site ve politika),
`api.buaksamnepisireyim.com` (API), `buaksamnepisireyim.online` (.com'a yönlenir).

- [x] Alan adı alma
- [x] Caddy yapılandırması — `site/Caddyfile` (gerçek alan adlarıyla hazır)
- [x] Politika sayfaları — `site/index.html`, `site/gizlilik.html`,
  `site/privacy.html` (kendi kendine yeten, telefon öncelikli)
- [x] Uygulama tarafı değişikliği — `https-cutover.patch` (bilerek
  **uygulanmadı**; HTTPS yanıt vermeden uygulanırsa uygulama API'ye erişemez)
- [ ] Beş A kaydını 129.121.89.248'e yönlendirme (api, kök ve www, iki alan adı
  için). Caddy ilk açılışta her ad için ayrı sertifika istiyor; çözülmeyen bir ad
  hata veriyor
- [ ] `iletisim@buaksamnepisireyim.com` adresinin gerçekten posta almasını
  sağlama. Politika bu adresi veriyor; Apple erişilebilir kalmasını istiyor.
  Kayıt firmasının yönlendirme özelliği yeterli
- [ ] VPS'e Caddy kurma, `site/Caddyfile` dosyasını yerleştirme,
  `caddy validate` sonra `systemctl reload`
- [ ] Üç adresi doğrulama: API yanıtı, politika sayfası 200, `.online` 301
- [ ] Doğrulamadan sonra uvicorn'u `127.0.0.1`'e bağlama (8000'i dışarıya kapatma)
- [ ] `https-cutover.patch` dosyasını uygulama (`git apply --check` önce)
- [ ] Native yapılandırma değiştiği için yeni EAS build — Metro yenilemesi yetmez
- [ ] Her iki politikadan "Şu anki sınırlama / Current limitation" paragrafını
  çıkarma ve HTML sayfalarını yeniden üretme (elle düzenleme değil)
- [ ] `129.121.89.248:8000` adresini bir süre açık tutma — telefonda kurulu eski
  build hâlâ IP'ye bakıyor

### 7b. Mağaza gereklilikleri

- [x] Gizlilik politikası taslağı — `legal/gizlilik-politikasi.md` ve
  `legal/privacy-policy.md`
- [ ] Gizlilik politikasının hukukçu tarafından okunması
- [ ] Politika adresini App Store Connect ve Google Play'e girme:
  `https://buaksamnepisireyim.com/gizlilik.html`
- [ ] Filtrelerin kusursuz olmadığına dair uyarıyı uygulama içinde de gösterme
  (filtre ekranında ve tarif ekranında)
- [x] Hesap silme açıklaması ve uygulama içi akış (Profilim → Hesap ve güvenlik)
- [ ] Hesap silme akışını gerçek cihazda üç giriş yöntemiyle doğrulama
- [ ] Kullanım koşulları
- [ ] Uygulama ikonu ve açılış ekranı (`app.json` içinde `icon`/`splash` yok)
- [ ] App Store ekran görüntüleri ve mağaza metinleri
- [ ] Google Play ekran görüntüleri ve mağaza metinleri
- [ ] TestFlight testi
- [ ] Play Internal Testing
- [ ] ~~Push notification yapılandırması~~ — günlük hatırlatma cihazda yerel
  olarak planlanıyor, uzak bildirim belirteci üretilmiyor; gerekmiyor
- [ ] App Store ve Google Play yayın öncesi kontrolü
