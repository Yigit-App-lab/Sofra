import React from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useStore } from '../../src/store';
import { makeT } from '../../src/i18n';
import { useTheme } from '../../src/theme';

// Text glyphs rather than an icon library: one less dependency, and it keeps the
// starter installable with nothing but the Expo defaults. Swap in
// @expo/vector-icons when you want real icons.
const glyph = (ch) => ({ color, size }) => <Text style={{ color, fontSize:size-3 }}>{ch}</Text>;

export default function TabsLayout() {
  const c = useTheme();
  const { state } = useStore();
  const t = makeT(state.langIndex);
  return (
    <Tabs screenOptions={{
      headerStyle:{ backgroundColor:c.ground },
      headerTintColor:c.ink,
      headerTitleStyle:{ fontWeight:'700', fontSize:20 },
      tabBarActiveTintColor:c.accent,
      tabBarInactiveTintColor:c.ink3,
      tabBarStyle:{ backgroundColor:c.surface, borderTopColor:c.line },
      tabBarLabelStyle:{ fontSize:10.5, fontWeight:'600' },
      sceneStyle:{ backgroundColor:c.ground },
    }}>
      <Tabs.Screen name="index"  options={{ title:t('tonight'), tabBarIcon:glyph('◐') }} />
      <Tabs.Screen name="mutfak" options={{ title:t('pantry'), tabBarIcon:glyph('▤') }} />
      <Tabs.Screen name="tarifler" options={{ title:state.langIndex === 1 ? 'Recipes' : 'Tarifler', tabBarIcon:glyph('⌕') }} />
      <Tabs.Screen name="pazar"  options={{ title:t('market'),  tabBarIcon:glyph('₺') }} />
      <Tabs.Screen name="liste"  options={{ title:t('list'),    tabBarIcon:glyph('✓') }} />
      <Tabs.Screen name="ben"    options={{ title:t('me'),      tabBarIcon:glyph('◇') }} />
    </Tabs>
  );
}
