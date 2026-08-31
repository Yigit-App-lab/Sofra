// Root layout. Everything the whole app needs is wired up exactly once, here.
import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StoreProvider, useStore } from '../src/store';
import { useTheme } from '../src/theme';
import { configureDailyReminder } from '../src/notifications';

function Shell() {
  const c = useTheme();
  const { state } = useStore();

  useEffect(() => {
    if (!state.ready) return;
    configureDailyReminder({
      enabled: Boolean(state.dailyReminder),
      shoppingList: state.shoppingList || {},
      langIndex: state.langIndex,
    }).catch((error) => {
      console.warn('Daily reminder could not be scheduled', error);
    });
  }, [state.ready, state.dailyReminder, state.shoppingList, state.langIndex]);

  if (!state.ready) return <View style={{ flex:1, backgroundColor:c.ground }} />;
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{
        headerStyle:{ backgroundColor:c.ground },
        headerTintColor:c.ink,
        headerBackButtonDisplayMode:'minimal',
        headerTitleStyle:{ fontWeight:'700' },
        contentStyle:{ backgroundColor:c.ground },
      }}>
        <Stack.Screen name="(tabs)" options={{ headerShown:false }} />
        <Stack.Screen
          name="api-tarif/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="tarif/[id]"
          options={{
            title: '',
            headerBackTitle: '',
          }}
        />
        <Stack.Screen
          name="begendiklerim"
          options={{ title: state.langIndex === 1 ? 'Liked recipes' : 'Beğendiklerim' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <StoreProvider><Shell /></StoreProvider>;
}
