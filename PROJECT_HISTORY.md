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

