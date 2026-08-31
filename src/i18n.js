// Türkçe varsayılan. İkinci dil İngilizce.
//
// No screen contains a literal Turkish word — everything goes through t(). That
// discipline costs nothing now and is what makes a second market possible later.
import { getLocales } from 'expo-localization';

export const LANGS = [{ code:'tr', label:'Türkçe' }, { code:'en', label:'English' }];

const S = {
  tonight:['Bu Akşam','Tonight'], kitchen:['Mutfak','Kitchen'], market:['Pazar','Market'],
  list:['Liste','List'], me:['Profilim','You'],
  perPerson:['kişi başı','per person'], forN:['%s kişi için','for %s people'],
  total:['Toplam','Total'], min:['dk','min'],
  cook:['Bunu pişir','Cook this'], skip:['Bu akşam olmaz','Not tonight'],
  loved:['Beğendim','Loved it'], made:['Pişirdim','Made it'], nope:['Bana göre değil','Not for me'],
  feedbackSaved:['Seçimin profiline eklendi.','Saved to your profile.'],
  have:['mutfağında','in your kitchen'], toBuy:['alınacak','to buy'],
  peak:['Tam mevsimi','Peak season'], shoulder:['Mevsimine yakın','Near season'],
  stored:['Her zaman uygun','Cheap all year'], winter:['Serada, pahalı','Greenhouse, pricey'],
  off:['Mevsimi değil','Out of season'], pantry:['Kiler','Pantry'],
  ingredients:['Malzemeler','Ingredients'], method:['Yapılışı','Method'],
  others:['Diğer seçenekler','Other options'], driver:['En pahalı malzeme','Priciest ingredient'],
  ofBill:['faturanın','of the bill'],
  search:['Malzeme ara…','Search ingredients…'], inKitchen:['Mutfağında olanlar','In your kitchen'],
  cheapNow:['Şimdi en ucuz','Cheapest right now'], expensiveNow:['Şimdi pahalı','Expensive now'],
  addThese:['Eklemek için dokun','Tap to add'],
  shopping:['Alışveriş listesi','Shopping list'], toBuyList:['Alınacaklar','To buy'],
  comingSoon:['Yakında gelecekler','Coming into season'],
  cookedN:['Pişirilen yemek','Dishes cooked'], signalsN:['Zevk sinyali','Taste signals'],
  pantryN:['Mutfaktaki malzeme','Items in kitchen'], favCat:['En sevilen tür','Favourite category'],
  avgCost:['Ortalama maliyet','Average cost'], history:['Son pişirilenler','Recently cooked'],
  likedRecipes:['Beğendiklerim','Liked recipes'],
  likedEmpty:['Henüz beğendiğin bir tarif yok.','You have not liked a recipe yet.'],
  nothingYet:['Bir şey pişirin, burası dolsun.','Cook something and this fills up.'],
  noneMatch:['Bu filtrelerle yemek yok. Bütçeyi veya süreyi genişletin.','Nothing matches. Loosen the budget or time.'],
  settings:['Ayarlar','Settings'], city:['Şehir','City'], household:['Kaç kişi','People'],
  timeBudget:['Süre','Time'], budget:['Bütçe · kişi başı','Budget · per person'],
  meatless:['Etsiz','Meatless'], language:['Dil','Language'],
  resetProfile:['Öğrenilenleri sıfırla','Reset what it learned'],
  estimated:['tahmini','estimated'],
  livePrices:['Günlük market ortalaması','Daily market average'],
  seasonalFallback:['Canlı fiyat yok · mevsim tahmini gösteriliyor','Live price unavailable · showing seasonal estimate'],
  marketCount:['%s market','%s markets'],
  lastUpdated:['Güncellendi','Updated'],
  priceSource:['Fiyat kaynağı','Price source'],
  priceDate:['Fiyat tarihi','Price date'],
  marketAverageSource:['Market Fiyatı · günlük market ortalaması','Market Fiyatı · daily market average'],
  seasonalSource:['Sofra · mevsimsel fiyat tahmini','Sofra · seasonal price estimate'],
  approximateCost:['yaklaşık maliyet','estimated cost'],
  priceCoverage:['%s fiyat kapsamı','%s price coverage'],
  costUnavailable:['Fiyat hesaplanamadı','Cost unavailable'],
};

const CAT = {
  bakliyat:['Bakliyat','Pulses'], corba:['Çorba','Soup'], sebze:['Sebze','Vegetable'],
  zeytinyagli:['Zeytinyağlı','In olive oil'], dolma:['Dolma & sarma','Stuffed'],
  pilav_makarna:['Pilav & makarna','Rice & pasta'], yumurta:['Yumurta','Egg'],
  kiymali:['Kıymalı','With mince'], hamur:['Hamur işi','Pastry'],
  tatli:['Tatlı','Dessert'], salata:['Salata','Salad'],
};

export const MONTHS = [
  ['Oca','Jan'],['Şub','Feb'],['Mar','Mar'],['Nis','Apr'],['May','May'],['Haz','Jun'],
  ['Tem','Jul'],['Ağu','Aug'],['Eyl','Sep'],['Eki','Oct'],['Kas','Nov'],['Ara','Dec'],
];

/** Turkish first: if the phone is not set to a language we ship, default to Turkish. */
export function deviceLangIndex() {
  const tags = getLocales().map((l) => (l.languageCode || '').toLowerCase());
  return tags[0] === 'en' ? 1 : 0;
}

export function makeT(i) {
  const t = (key, a) => {
    const s = S[key] ? (S[key][i] || S[key][0]) : key;
    return a === undefined ? s : s.replace('%s', a);
  };
  t.code = LANGS[i].code;
  t.cat = (k) => (CAT[k] ? CAT[k][i] || CAT[k][0] : k);
  t.month = (m) => MONTHS[m - 1][i] || MONTHS[m - 1][0];
  t.itemName = (item) => (item ? item.names[t.code] || item.names.tr : '');
  t.title = (r) => (r ? r.titles[t.code] || r.titles.tr : '');
  t.state = (st) => (st ? t(st.key) : '');
  return t;
}

/** 4.6 -> "4.6", 22.4 -> "22", 103.9 -> "104". Prices do not need decimals above ten. */
export function tl(n) {
  if (n == null) return '—';
  return n < 10 ? n.toFixed(1) : String(Math.round(n));
}
