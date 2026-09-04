<!--
  DRAFT. Written from the code, not from a template: every claim below was
  checked against src/cloudStore.js, src/auth.js, src/notifications.js,
  app/account.js, firestore.rules and backend/recipe_api.py.

  Before publishing:
   1. BEFORE PUBLISHING: make sure iletisim@buaksamnepisireyim.com actually
      receives mail. A privacy policy that names an unreachable contact address
      is worse than one with no address, and Apple requires it to stay
      reachable for as long as the app is listed. Most registrars offer free
      forwarding to an existing inbox — that is enough.
   2. Have a lawyer read it. Sofra stores dietary filters. These are cooking
      settings, not medical records — a user may set "glutensiz" because a
      child or a guest is coeliac — so this draft does not claim they are
      special-category data under KVKK m.6 / GDPR m.9. The residual risk is
      that a regulator reads a filter as *inferred* health data about the
      account holder; the draft minimises that by using them for nothing but
      recipe filtering. That judgement call belongs to a lawyer, not to this
      file. Not legal advice.
   3. The "Güvenlik" section currently admits that recipe traffic is
      unencrypted. Once the API is served over HTTPS, update that paragraph.
-->

# Sofra — Gizlilik Politikası

**Yürürlük tarihi:** 4 Eylül 2026

## 1. Veri sorumlusu

Sofra uygulamasını Yigit Berktaş bir birey olarak yayımlar ve işletir. Bu
politikada "biz" ifadesi buna karşılık gelir. İletişim: iletisim@buaksamnepisireyim.com

## 2. Kısaca

- Sofra'yı hesap açmadan, misafir olarak kullanabilirsin. Bu durumda hiçbir
  veri buluta gönderilmez; her şey yalnız cihazında kalır.
- Hesap açarsan tercihlerin ve kilerin cihazlar arasında eşitlenir.
- Reklam yoktur, analitik veya izleme aracı yoktur, verilerini kimseye satmayız.
- Hesabını uygulama içinden kalıcı olarak silebilirsin.

## 3. İşlediğimiz veriler

### 3.1 Hesap verileri

Hesap açmayı seçersen, kimlik doğrulama Google Firebase Authentication
üzerinden yapılır:

- **E-posta ile kayıt:** e-posta adresin ve şifren. Şifreyi biz görmeyiz;
  Firebase tarafında karma (hash) olarak saklanır.
- **Apple ile giriş:** Apple'ın verdiği kullanıcı kimliği ve e-posta adresi.
  Apple'ın "e-postamı gizle" seçeneğini kullanırsan yalnız yönlendirme adresini
  görürüz.
- **Google ile giriş:** Google hesabının kimliği ve e-posta adresi.

### 3.2 Uygulama tercihleri ve içerik

Hesabın varsa aşağıdakiler Firestore'da `users/{kullanıcı-kimliği}/app/state`
yolunda saklanır ve cihazlarına eşitlenir:

- süre bütçesi ve kişi başı bütçe üst sınırı,
- **beslenme tercihleri: etsiz, vejetaryen/vegan, glutensiz, laktozsuz, düşük
  glisemik**,
- yemek yapma deneyimi düzeyi,
- kilerindeki ve mutfağındaki malzemeler,
- alışveriş listen,
- beğendiğin, pişirdiğin ve "bana göre değil" dediğin tarifler ile bunlardan
  öğrenilen tat tercihleri.

### 3.3 Beslenme filtreleri hakkında not

Etsiz, glutensiz, laktozsuz ve düşük glisemik seçenekleri birer **yemek
filtresidir**, sağlık kaydı değildir. İnsanlar çoğu zaman kendileri için değil,
sofradaki başkaları için yemek yapar: bu filtreleri çocuğun, bir misafirin ya da
ev halkından birinin ihtiyacı için de işaretleyebilirsin. Sofra bu seçimlerden
senin veya bir başkasının sağlık durumuna dair çıkarım yapmaz, böyle bir kayıt
tutmaz.

Bu seçimleri yalnızca sana uygun tarifleri süzmek için kullanırız; profilleme,
reklam veya üçüncü taraflarla paylaşım için kullanmayız. Hiç işaretlemek zorunda
değilsin; işaretlemezsen Sofra çalışmaya devam eder ve tercihlerini istediğin
zaman değiştirebilir veya hesabını silerek tamamen kaldırabilirsin.

> **Önemli:** Bu filtreler tarif verisindeki malzeme eşleşmelerine dayanır ve
> kusursuz değildir. Tıbbi bir zorunluluk varsa — çölyak, laktoz intoleransı,
> diyabet gibi — bir tarifi uygulamadan önce malzeme listesini kendin kontrol
> et. Sofra tıbbi tavsiye vermez ve tıbbi bir araç değildir.

### 3.4 Cihazında kalan veriler

Dil seçimi, tanıtım ekranını görüp görmediğin ve günlük hatırlatma ayarların
yalnız cihazında saklanır (AsyncStorage). Misafir kullanımda yukarıdaki tüm
tercihler de yalnız cihazında kalır.

### 3.5 Sunucu kayıtları

Tarif ve fiyat verileri kendi sunucumuzdaki bir API'den gelir. Bu sunucu, her
istek için IP adresini ve istenen adresi teknik kayıt olarak tutar. Bu kayıtlar
hata ayıklama ve kötüye kullanımı önleme amacıyla tutulur; pazarlama için
kullanılmaz ve hesabınla ilişkilendirilmez — API isteklerinde kimlik bilgisi
gönderilmez.

### 3.6 İşlemediğimiz veriler

Konum, rehber, fotoğraflar, reklam kimliği, cihaz parmak izi ve çerez
kullanmıyoruz. Uygulamada analitik, çökme raporlama veya reklam aracı yoktur.
Bildirimler cihazında yerel olarak planlanır; uzak bildirim (push) belirteci
üretmiyor ve toplamıyoruz.

## 4. İşleme amaçları ve hukuki dayanak

| Veri | Amaç | Dayanak |
| --- | --- | --- |
| Hesap verileri | Hesabını oluşturmak ve girişini sağlamak | Sözleşmenin ifası |
| Tercihler, kiler, listeler | Uygulamanın çalışması ve cihazlar arası eşitleme | Sözleşmenin ifası |
| Beslenme filtreleri | Uygun tarifleri süzmek | Sözleşmenin ifası |
| Tat geri bildirimleri | Önerileri sana göre iyileştirmek | Sözleşmenin ifası |
| Sunucu kayıtları | Güvenlik, hata ayıklama, kötüye kullanımın önlenmesi | Meşru menfaat |

## 5. Paylaşım ve yurt dışına aktarım

Verilerini satmıyoruz ve reklam amacıyla paylaşmıyoruz. Hizmeti çalıştırmak için
şu sağlayıcıları kullanıyoruz:

- **Google Firebase (Authentication ve Cloud Firestore)** — hesap ve tercih
  verilerinin barındırılması. Google sunucuları Türkiye dışında bulunabilir.
- **Apple** — "Apple ile giriş" kullanırsan kimlik doğrulama.
- **Google** — "Google ile giriş" kullanırsan kimlik doğrulama.

Bu sağlayıcılar verileri bizim adımıza işler. Yurt dışına aktarım, KVKK'nın
aktarım hükümleri kapsamında ve açık rızana dayanılarak yapılır.

Tarif maliyetleri için market fiyatlarını dış kaynaklardan topluyoruz. Bu
isteklerde **hiçbir kullanıcı verisi** gönderilmez.

## 6. Saklama süreleri

- Hesap ve tercih verileri: hesabın var olduğu sürece.
- Hesabını sildiğinde: Firestore'daki tercih ve kiler verilerin ve Firebase
  Authentication hesabın silinir, cihazındaki yerel kopya kaldırılır.
- Sunucu teknik kayıtları: en fazla 30 gün tutulmasını hedefliyoruz.

## 7. Hesabını silme

Uygulamada **Profilim → Hesap ve güvenlik → Hesabımı sil** yolunu izle.
Güvenlik için önce şifrenle ya da Apple/Google hesabınla yeniden giriş yapman
istenir. Silme işlemi geri alınamaz.

## 8. Haklarınız

KVKK m.11 ve — sana uygulanıyorsa — GDPR kapsamında; verilerinin işlenip
işlenmediğini öğrenme, bunlara erişme, düzeltilmesini veya silinmesini isteme,
işlemeye itiraz etme ve rızanı geri çekme hakların vardır. Talebini
iletisim@buaksamnepisireyim.com adresine iletebilirsin. En kısa sürede, her hâlükârda otuz
gün içinde yanıt veririz.

## 9. Güvenlik

Kimlik doğrulama ve tercih eşitlemesi Google Firebase üzerinden şifreli
bağlantıyla yapılır. Firestore kuralları, her kullanıcının yalnız kendi
verilerine erişmesine izin verir.

> **Şu anki sınırlama:** tarif ve fiyat isteklerini karşılayan API henüz şifresiz
> bağlantı (HTTP) üzerinden çalışıyor. Bu isteklerde hesap bilgisi veya şifre
> bulunmaz; ancak kilerinde işaretlediğin malzemeler ve beslenme tercihlerin,
> ağı izleyebilen biri tarafından görülebilir. Bu bağlantıyı şifrelemek üzerinde
> çalışıyoruz.

## 10. Çocuklar

Sofra 13 yaşın altındaki çocuklara yönelik değildir ve bilerek bu yaş grubundan
veri toplamayız.

## 11. Değişiklikler

Bu politikayı güncellersek yürürlük tarihini değiştirir ve önemli değişiklikleri
uygulama içinde duyururuz.

## 12. İletişim

iletisim@buaksamnepisireyim.com
