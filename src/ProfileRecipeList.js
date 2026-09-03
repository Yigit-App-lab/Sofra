import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { recById } from './data';
import { cleanRecipeTitle, makeT } from './i18n';
import { useStore } from './store';
import { space, useTheme } from './theme';
import { Body, Card } from './ui';

export default function ProfileRecipeList({ kind }) {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const t = makeT(state.langIndex);
  const profile = state.profile;

  const records = kind === 'liked'
    ? (profile.liked || {})
    : kind === 'cooked'
      ? (profile.cooked || {})
      : Object.fromEntries(Object.entries(profile.feedback || {})
        .filter(([, item]) => item?.disliked || item?.event === 'disliked')
        .map(([id, item]) => [id, item?.day || 0]));
  const ids = Object.keys(records).sort((a, b) => Number(records[b] || 0) - Number(records[a] || 0));

  const titleOf = (id) => recById[id]
    ? t.title(recById[id])
    : cleanRecipeTitle(profile.apiRecipes?.[id]?.title || id);
  const openRecipe = (id) => router.push(id.startsWith('api:')
    ? `/api-tarif/${id.slice(4)}`
    : `/tarif/${id}`);
  const emptyText = t.code === 'en'
    ? ({ liked:'You have no liked recipes yet.', cooked:'You have no cooked recipes yet.', disliked:'You have no “Not for me” recipes.' }[kind])
    : ({ liked:'Henüz beğendiğin bir tarif yok.', cooked:'Henüz pişirdiğin bir tarif yok.', disliked:'Henüz “Bana göre değil” dediğin bir tarif yok.' }[kind]);

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl * 2 }}>
      {!ids.length ? <Body dim>{emptyText}</Body> : ids.map((id) => (
        <Card key={id} style={{ marginBottom:space.s, padding:space.m }}>
          <View style={{ flexDirection:'row', alignItems:'center', gap:space.m }}>
            <Pressable accessibilityRole="button" onPress={() => openRecipe(id)}
              style={({ pressed }) => ({ flex:1, opacity:pressed ? 0.6 : 1 })}>
              <Text style={{ color:c.ink, fontSize:15, lineHeight:21 }}>{titleOf(id)}</Text>
              <Text style={{ color:c.ink3, fontSize:11.5, marginTop:3 }}>
                {t.code === 'en' ? 'Tap to open' : 'Tarifi aç'}
              </Text>
            </Pressable>
            <Pressable accessibilityRole="button"
              accessibilityLabel={t.code === 'en' ? 'Undo selection' : 'Seçimi geri al'}
              onPress={() => dispatch({ type:'removeFeedback', id, kind })}
              style={({ pressed }) => ({
                backgroundColor:c.surface2, borderRadius:8, paddingHorizontal:11,
                paddingVertical:9, opacity:pressed ? 0.65 : 1,
              })}>
              <Text style={{ color:c.ink2, fontSize:12.5, fontWeight:'700' }}>
                {t.code === 'en' ? 'Undo' : 'Geri al'}
              </Text>
            </Pressable>
          </View>
        </Card>
      ))}
    </ScrollView>
  );
}
