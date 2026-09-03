import React, { useState } from 'react';
import { ImageBackground, SafeAreaView, Text, View } from 'react-native';
import { useStore } from '../src/store';
import { useTheme, space } from '../src/theme';
import { Body, Button, Card, Title } from '../src/ui';

const PAGES = [
  {
    image:require('../assets/onboarding/family-sofra.png'),
    title:'Bu akşam ne pişirsem?',
    body:'Sofra; bütçene, ayırabileceğin zamana ve beslenme tercihlerine uygun yemekleri seçmene yardımcı olur.',
    note:'Benim İçin Seç · Mevsime Göre Seç · Kilerimden Seç',
  },
  {
    image:require('../assets/onboarding/cook-sofra.png'),
    title:'Filtrelerle sana uygun tarifleri bul',
    body:'Süre ve bütçeni belirle; etsiz, vejetaryen, vegan, glutensiz, laktozsuz veya düşük glisemik filtrelerini seç. Tercihlerini istediğin zaman Profilim’den değiştirebilirsin.',
    note:'Kontrol sende',
  },
  {
    image:require('../assets/onboarding/market-sofra.png'),
    title:'Kilerini ve bütçeni yönet',
    body:'Evdeki malzemeleri işaretle, eksikleri listene ekle. Günlük market ortalama fiyatlarıyla tahmini maliyeti önceden gör.',
    note:'Daha az israf · Güncel fiyat · Kolay alışveriş',
  },
];

export default function OnboardingScreen() {
  const c = useTheme();
  const { dispatch } = useStore();
  const [page, setPage] = useState(0);
  const item = PAGES[page];
  const last = page === PAGES.length - 1;
  const translucentSurface = c.surface === '#FFFFFF'
    ? 'rgba(255,255,255,0.93)'
    : 'rgba(19,28,31,0.94)';

  return (
    <ImageBackground source={item.image} resizeMode="cover" style={{ flex:1, backgroundColor:'#EAEEEC' }}>
      <SafeAreaView style={{ flex:1 }}>
        <View style={{ flex:1, padding:space.xl, justifyContent:'space-between' }}>
          <View>
            <Text style={{ color:c.accent, fontWeight:'800', fontSize:18, letterSpacing:0.5 }}>SOFRA</Text>
            <Body dim size={13} style={{ marginTop:4 }}>Her akşam daha kolay bir karar</Body>
            <Card style={{ backgroundColor:translucentSurface, padding:space.l, marginTop:space.l }}>
              <Title size={27}>{item.title}</Title>
              <Body dim size={14.5} style={{ marginTop:space.s }}>{item.body}</Body>
              <Text style={{ color:c.accent, fontSize:12.5, fontWeight:'700', lineHeight:18, marginTop:space.m }}>
                {item.note}
              </Text>
            </Card>
          </View>

          <View>
            <View style={{ flexDirection:'row', justifyContent:'center', gap:7, marginBottom:space.l }}>
              {PAGES.map((_, index) => (
                <View key={index} style={{ width:index === page ? 24 : 7, height:7, borderRadius:4,
                  backgroundColor:index === page ? c.accent : c.line }} />
              ))}
            </View>
            <Button onPress={() => last
              ? dispatch({ type:'set', key:'onboardingComplete', value:true })
              : setPage((value) => value + 1)}>
              {last ? 'Başlayalım' : 'Devam Et'}
            </Button>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
