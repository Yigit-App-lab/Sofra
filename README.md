# Sofra — çalışan uygulama / runnable app

Türkçe varsayılan, iOS hedefli, sunucusuz. Bütün maliyet hesabı telefonda.

## Bugün, ücretsiz, kendi iPhone'unuzda çalıştırmak

Gereken: [Node.js](https://nodejs.org) (LTS) ve iPhone'da **Expo Go** (App Store, ücretsiz).
Mac gerekmiyor. Apple Developer üyeliği bu adım için gerekmiyor.

**Windows / PowerShell:**

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass   # sadece bu pencere için
.\setup.ps1
cd $HOME\sofra
npx expo start
```

**macOS / Linux:**

```bash
./setup.sh ~/sofra
cd ~/sofra
npx expo start
```

Sonra terminaldeki QR kodu iPhone kamerasıyla okutun. Telefon ve bilgisayar aynı
Wi-Fi ağında olmalı.

### Neden SDK 54 — okumadan atlamayın

App Store'daki **Expo Go, SDK 54'te dondurulmuş durumda**. Expo'nun kendi SDK 56
changelog'u *"Expo Go for SDK 56 is not available on the Apple App Store"* diyor ve
SDK 57 hâlâ inceleme bekliyor. Yani SDK 57 ile açtığınız bir proje bugün
kurabileceğiniz Expo Go'da **açılmaz**.

`setup.ps1` bu yüzden SDK 54 kullanıyor. 99 $'lık Apple Developer üyeliğini alıp
EAS ile gerçek bir *development build* çıkardığınızda `-Sdk 57` ile yükseltin.

## Gerçek bir iOS derlemesine geçmek (99 $ sonrası)

Mac gerekmiyor — EAS bulutta macOS'ta derliyor ve `eas submit` Windows'ta çalışıyor.

```powershell
npm i -g eas-cli
eas login
eas build:configure
eas device:create          # "Website that generates a registration URL" seçin,
                           # linki iPhone'da açın, profili kurun
eas build --profile development --platform ios
```

İki gizli bekleme var: yeni bir üyelikte cihaz kaydının yayılması **24–72 saat**
sürebilir (öncesinde derleme anlaşılmaz bir hatayla düşer), ve ilk harici TestFlight
derlemesi **Beta App Review**'dan geçer (1–2 gün). Ücretsiz kademe ayda 15 iOS
derlemesi veriyor.

iPhone'da **Ayarlar → Gizlilik ve Güvenlik → Geliştirici Modu**'nu açıp yeniden başlatın.

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

## Bilerek olmayan şeyler

Hesap yok. Sunucu yok. Analitik yok. Bildirim yok. Fotoğraf yükleme yok.

Her biri bir haftalık iş ve bir uyum yükümlülüğü, ve hiçbiri "bu akşam ne pişireyim,
kaça gelir" sorusunu daha iyi cevaplamıyor. Sunucuyu, gerçek bir kullanıcı iki
telefon arasında senkron isteyince ekleyin. Öncesinde değil.

**Not:** hesap olmadığı için Apple 5.1.1(v) hesap silme akışı gerekmiyor ve App
Privacy bildiriminde muhtemelen "Data Not Collected" diyeceksiniz. Analitik veya
reklam eklerseniz bu değişir.
