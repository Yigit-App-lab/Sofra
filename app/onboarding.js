import React, { useRef, useState } from 'react';
import { FlatList, ImageBackground, SafeAreaView, Text, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useStore } from '../src/store';
import { useAuth } from '../src/auth';
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
    title:'Zamanını ve bütçeni sen belirle',
    body:'Hazırlamak için ayırabileceğin süreyi ve bütçe sınırını seç. Sofra yalnızca bu koşullara uygun tarifleri değerlendirir.',
    note:'Kontrol sende',
  },
  {
    image:require('../assets/onboarding/kitchen-sofra.png'),
    title:'Filtreler sana uygun tarifleri bulur',
    body:'Beslenme tercihlerini Profilim’den seçebilirsin. Bu filtreler Benim İçin Seç, Mevsime Göre Seç ve Kilerimden Seç sonuçlarının tamamında uygulanır.',
    filters:[
      'Etsiz · Vejetaryen · Vegan',
      'Glutensiz · Laktozsuz',
      'Düşük glisemik',
    ],
    note:'Tercihlerini istediğin zaman değiştirebilirsin',
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
  const router = useRouter();
  const { user } = useAuth();
  const { state, dispatch } = useStore();
  const listRef = useRef(null);
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  const last = page === PAGES.length - 1;
  const translucentSurface = c.surface === '#FFFFFF'
    ? 'rgba(255,255,255,0.93)'
    : 'rgba(19,28,31,0.94)';

  const goNext = () => {
    if (last) {
      dispatch({ type:'set', key:'onboardingComplete', value:true });
      router.replace(user || state.guestMode ? '/(tabs)' : '/login');
      return;
    }
    const next = page + 1;
    listRef.current?.scrollToIndex({ index:next, animated:true });
    setPage(next);
  };

  return (
    <View style={{ flex:1, backgroundColor:'#EAEEEC' }}>
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(_, index) => String(index)}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, index) => ({ length:width, offset:width * index, index })}
        onMomentumScrollEnd={(event) => {
          const next = Math.round(event.nativeEvent.contentOffset.x / width);
          setPage(Math.max(0, Math.min(PAGES.length - 1, next)));
        }}
        renderItem={({ item }) => (
          <ImageBackground source={item.image} resizeMode="cover"
            style={{ width, flex:1, backgroundColor:'#EAEEEC' }}>
            <SafeAreaView style={{ flex:1 }}>
              <View style={{ flex:1, padding:space.xl, paddingBottom:145 }}>
                <Text style={{ color:c.accent, fontWeight:'800', fontSize:18, letterSpacing:0.5 }}>SOFRA</Text>
                <Body dim size={13} style={{ marginTop:4 }}>Her akşam daha kolay bir karar</Body>
                <Card style={{ backgroundColor:translucentSurface, padding:space.l, marginTop:space.l }}>
                  <Title size={27}>{item.title}</Title>
                  <Body dim size={14.5} style={{ marginTop:space.s }}>{item.body}</Body>
                  {item.filters?.map((filter) => (
                    <View key={filter} style={{ flexDirection:'row', alignItems:'center', marginTop:space.m }}>
                      <View style={{ width:7, height:7, borderRadius:4, backgroundColor:c.accent,
                        marginRight:space.s }} />
                      <Text style={{ color:c.ink, fontSize:14, fontWeight:'600', flex:1 }}>{filter}</Text>
                    </View>
                  ))}
                  <Text style={{ color:c.accent, fontSize:12.5, fontWeight:'700', lineHeight:18, marginTop:space.m }}>
                    {item.note}
                  </Text>
                </Card>
              </View>
            </SafeAreaView>
          </ImageBackground>
        )}
      />

      <SafeAreaView pointerEvents="box-none" style={{ position:'absolute', left:0, right:0, bottom:0 }}>
        <View style={{ paddingHorizontal:space.xl, paddingBottom:space.xl }}>
          <View style={{ flexDirection:'row', justifyContent:'center', gap:7, marginBottom:space.l }}>
            {PAGES.map((_, index) => (
              <View key={index} style={{ width:index === page ? 24 : 7, height:7, borderRadius:4,
                backgroundColor:index === page ? c.accent : c.line }} />
            ))}
          </View>
          <Button onPress={goNext} accessibilityLabel={last ? 'Sofra’yı kullanmaya başla' : 'Sonraki tanıtım sayfası'}>
            {last ? 'Başlayalım' : 'Devam Et'}
          </Button>
        </View>
      </SafeAreaView>
    </View>
  );
}
