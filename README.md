# Sofra — çalışan uygulama / runnable app

Türkçe varsayılan, iOS hedefli. Maliyet hesabı telefonda; Firebase Authentication
ve Firestore kullanıcı hesabı, kiler, tercihler ve tarif geri bildirimlerini
cihazlar arasında eşitler.

## Geliştirme ve test

Bu proje native Firebase/Apple/Google entegrasyonları nedeniyle Expo Go yerine kurulu
bir EAS **development build** ile test edilir. Kalıcı proje özeti `PROJECT_BRIEF.md`,
güncel işler `TODO.md`, tam test/build yöntemi ise `TESTING.md` içindedir.

**Windows / PowerShell:**

```powershell
cd "C:\Users\yberktas\Desktop\my app1\Sofra"
npm.cmd run preflight
npm.cmd run ios:dev
```

QR kodunu normal iPhone kamerasıyla okutun ve Sofra development build içinde açın.
Normal çalıştırmada `--clear` kullanmayın. Ayrıntılı sorun giderme için `TESTING.md`
dosyasını izleyin.

### Neden SDK 54 — okumadan atlamayın

Proje şu anda Expo SDK 54 kullanır. SDK yükseltmesi ayrı bir iş olarak planlanmalı,
native bağımlılıklarla birlikte test edilmeli ve yeni development build alınmalıdır.

Yeni development, preview veya production build almadan önce `TESTING.md` içindeki
build kontrolünü uygulayın. Aktif geliştirmede mevcut development build Metro ile
yeniden kullanılır; JavaScript değişiklikleri için gereksiz EAS build alınmaz.

## Dosyalar

```
setup.ps1 / setup.sh      tek komutla proje kurulumu
tools/patch-app-json.js   dil ve iOS ayarlarını app.json'a yazar

app/                      ekranlar — dosya yolu doğrudan rota (expo-router)
  _layout.js              sağlayıcılar, tema
  (tabs)/index.js         Bu Akşam — ana ekran
  (tabs)/mutfak.js        kiler
  (tabs)/pazar.js         bu ay neyin ucuz olduğu
  (tabs)/liste.js         alışveriş listesi + toplam
  (tabs)/ben.js           öğrenilenler + ayarlar
  app/tarif/[id].js       tek tarif, satır satır maliyet, geri bildirim

src/
  engine.js               BÜTÜN fiyat ve sıralama mantığı. React yok.
  store.js                durum + telefona kayıt
  data.js                 paketlenmiş JSON
  i18n.js                 her metin, iki dilde
  theme.js                her renk ve ölçü
  ui.js                   paylaşılan bileşenler
  __tests__/engine.test.js  76 test: `node src/__tests__/engine.test.js`

assets/data/              malzeme, tarif, bölge verisi
```

## Tek kural

`src/engine.js` React'i import etmiyor ve ekranları tanımıyor. Bu bilinçli ve bu
depodaki en değerli şey:

- bir saniyede test edilir, simülatör gerekmez
- aynı dosya web prototipinde ve bu uygulamada değişmeden çalışıyor
- arayüzü baştan yazdığınızda — yazacaksınız — ürünün beyni sağ kalır

Fiyat veya sıralama mantığını asla bir ekrana koymayın.

## İlk beş değişiklik

Her biri sonraki için gereken şeyi öğretecek sırada:

1. **`src/theme.js`** — `accent` rengini değiştirin, kaydedin, telefona bakın.
   Uygulamanın tamamının nasıl biçimlendiğini öğrendiniz.
2. **`src/i18n.js`** — bir buton metnini değiştirin. Hiçbir ekranda niye düz metin
   olmadığını öğrendiniz.
3. **`assets/data/ingredients.json`** — pazardan bir fiyat güncelleyin, `source`
   alanını `pazar` yapın. Testleri çalıştırın.
4. **`assets/data/recipes.json`** — annenizin bir tarifini ekleyin. Var olan malzeme
   id'lerini kullanın; testler olmayan bir id'yi söyler.
5. **`src/engine.js`** — `WEIGHTS.cost` değerini 0,25'ten 0,45'e çıkarın. Uygulama
   fiyata çok daha fazla takar. Geri alın. Ürünün merkezî ayarını anladınız.

## Bulut hesabı

Firebase Authentication e-posta, Google ve Apple girişini sağlar. Firestore yalnızca
oturum açmış kullanıcının kendi `users/{uid}` yoluna erişmesine izin verir. Dil,
bildirim tercihi ve pazar fiyatı önbelleği cihazda kalır; kiler, filtreler, alışveriş
listesi ve tarif geri bildirimleri kullanıcı hesabıyla eşitlenir.

## Bilerek olmayan şeyler

Analitik, reklam ve fotoğraf yükleme yok.

Her biri bir haftalık iş ve bir uyum yükümlülüğü, ve hiçbiri "bu akşam ne pişireyim,
kaça gelir" sorusunu daha iyi cevaplamıyor. Sunucuyu, gerçek bir kullanıcı iki
telefon arasında senkron isteyince ekleyin. Öncesinde değil.

**Not:** Hesap silme akışı ve App Privacy beyanı App Store gönderiminden önce
tamamlanmalıdır. Analitik veya reklam eklenirse gizlilik beyanı yeniden değerlendirilmelidir.
