# Sofra — Yapılacaklar

Bu dosya Sofra projesinin kalıcı ana iş listesidir. Yeni işler buraya eklenir; tamamlananlar işaretlenir ve ayrıntılı sonuçlar `PROJECT_HISTORY.md` dosyasına yazılır.

## 1. Hesap ve senkronizasyon

- [x] E-posta doğrulama
- [x] Şifre yenileme
- [x] Çıkış yapma
- [x] Misafir erişimi
- [ ] Hesabı ve kullanıcıya ait bulut verilerini silme
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
- [ ] Bana göre değil listesini profil altında gösterme
- [ ] Bana göre değil seçimini geri alma
- [ ] Pişirdiklerim için ayrı tam liste
- [ ] Yakın tarihte pişirilen tarifin tekrar önerilmesini sınırlama
- [ ] Profil filtrelerinin üç öneri motorunda aynı çalıştığını doğrulama

## 4. Tarif motoru

- [x] Benim İçin Seç, Mevsime Göre Seç ve Kilerimden Seç ekranlarını hizalama
- [x] Kişi başı fiyat ve tarif bilgilerinin üç yöntemde aynı gösterilmesi
- [x] Etsiz, glutensiz, laktozsuz ve düşük glisemik filtrelerini tüm motorlarda doğrulama
- [x] Kilerde seçilmiş tavuk, et veya balığı uygun tariflerde önceliklendirme
- [x] Eşleşen malzeme sayısını sıralamada öne alma
- [x] Eşitlikte daha uzun ve ayrıntılı tarifi seçme
- [x] Çok benzer tarif tekrarlarını azaltma
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
- [ ] Güvenli ad eşleştirmeleri: yağ, çorba kaşığı un, kültür mantarı, maydanoz, köy biberi
- [ ] Kataloğa ekleme: zerdeçal, margarin/Teremyağ, defne yaprağı, reyhan, fesleğen
- [ ] Kataloğa ekleme: cheddar, sosis, dolmalık fıstık, avokado, kişniş
- [ ] Kataloğa ekleme: kuyruk yağı, safran, salam
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

- [ ] Gizlilik politikası
- [ ] Kullanım koşulları
- [ ] Hesap silme açıklaması ve uygulama içi akış
- [ ] App Store ekran görüntüleri ve mağaza metinleri
- [ ] Google Play ekran görüntüleri ve mağaza metinleri
- [ ] TestFlight testi
- [ ] Play Internal Testing
- [ ] Push notification yapılandırması
- [ ] App Store ve Google Play yayın öncesi kontrolü
