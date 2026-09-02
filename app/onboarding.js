import React, { useState } from 'react';
import { SafeAreaView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useStore } from '../src/store';
import { useTheme, radius, space } from '../src/theme';
import { Body, Button, Card, Title } from '../src/ui';

const PAGES = [
  {
    icon:'restaurant-outline',
    title:'Bu akşam ne pişirsem?',
    body:'Sofra; bütçene, ayırabileceğin zamana ve beslenme tercihlerine uygun yemekleri senin için seçer.',
    note:'Benim İçin Seç · Mevsime Göre Seç · Kilerimden Seç',
  },
  {
    icon:'basket-outline',
    title:'Kilerindekileri değerlendir',
    body:'Evdeki malzemeleri işaretle. Sofra eşleşen tarifleri öne çıkarır, eksikleri alışveriş listene ekler.',
    note:'Daha az israf · Daha kolay alışveriş',
  },
  {
    icon:'wallet-outline',
    title:'Maliyeti önceden gör',
    body:'İstanbul’daki günlük market ortalamalarıyla kişi başı ve toplam tahmini maliyeti gör. Beğendikçe öneriler sana uyum sağlar.',
    note:'Güncel fiyat · Mevsim bilgisi · Sana özel öneriler',
  },
];

export default function OnboardingScreen() {
  const c = useTheme();
  const { dispatch } = useStore();
  const [page, setPage] = useState(0);
  const item = PAGES[page];
  const last = page === PAGES.length - 1;

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:c.ground }}>
      <View style={{ flex:1, padding:space.xl, justifyContent:'space-between' }}>
        <View>
          <Text style={{ color:c.accent, fontWeight:'800', fontSize:18, letterSpacing:0.5 }}>SOFRA</Text>
          <Body dim size={13} style={{ marginTop:4 }}>Her akşam daha kolay bir karar</Body>
        </View>

        <Card style={{ padding:space.xl, minHeight:360, justifyContent:'center' }}>
          <View style={{ width:76, height:76, borderRadius:radius.l, backgroundColor:c.accentSoft,
            alignItems:'center', justifyContent:'center', marginBottom:space.xl }}>
            <Ionicons name={item.icon} size={38} color={c.accent} />
          </View>
          <Title size={30}>{item.title}</Title>
          <Body dim size={16} style={{ marginTop:space.m }}>{item.body}</Body>
          <View style={{ backgroundColor:c.surface2, borderRadius:radius.m, padding:space.m, marginTop:space.xl }}>
            <Text style={{ color:c.ink2, fontSize:13, fontWeight:'700', lineHeight:19 }}>{item.note}</Text>
          </View>
        </Card>

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
  );
}
