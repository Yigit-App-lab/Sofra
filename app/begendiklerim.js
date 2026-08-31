import React from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { recById } from '../src/data';
import { useStore } from '../src/store';
import { makeT, cleanRecipeTitle } from '../src/i18n';
import { space } from '../src/theme';
import { Body, LineItem } from '../src/ui';

export default function Begendiklerim() {
  const router = useRouter();
  const { state } = useStore();
  const t = makeT(state.langIndex);
  const profile = state.profile;
  const liked = Object.keys(profile.liked || {})
    .sort((a, b) => profile.liked[b] - profile.liked[a]);

  const titleOf = (id) => recById[id]
    ? t.title(recById[id])
    : cleanRecipeTitle(profile.apiRecipes?.[id]?.title || id);

  const openRecipe = (id) => {
    if (id.startsWith('api:')) {
      router.push(`/api-tarif/${id.slice(4)}`);
    } else {
      router.push(`/tarif/${id}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl * 2 }}>
      {!liked.length ? (
        <Body dim>{t('likedEmpty')}</Body>
      ) : (
        <View>
          {liked.map((id) => (
            <LineItem
              key={id}
              name={titleOf(id)}
              sub={t.code === 'en' ? 'Tap to open' : 'Açmak için dokun'}
              onPress={() => openRecipe(id)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
