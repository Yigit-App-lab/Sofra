// Root layout. Everything the whole app needs is wired up exactly once, here.
import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { StoreProvider, useStore } from '../src/store';
import { AuthProvider, useAuth } from '../src/auth';
import { useTheme } from '../src/theme';
import { configureDailyReminder } from '../src/notifications';

function Shell() {
  const c = useTheme();
  const { state, dispatch } = useStore();
  const { user, ready:authReady } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const onAuthScreen = segments[0] === 'login' || segments[0] === 'signup';
  const onOnboarding = segments[0] === 'onboarding';
  const storeReadyForUser = state.ready && state.ownerUid === (user?.uid || null);
  const hasAccess = Boolean(user || state.guestMode);

  useEffect(() => {
    if (!storeReadyForUser || !authReady) return;
    // Onboarding owns its completion navigation. Redirecting here at the same
    // time as its persisted state update can dispatch before the nested tabs
    // navigator is registered.
    if (onOnboarding) return;
    if (!state.onboardingComplete) {
      router.replace('/onboarding');
      return;
    }
    if (!hasAccess && !onAuthScreen) router.replace('/login');
    if (hasAccess && onAuthScreen) router.navigate('/(tabs)');
  }, [storeReadyForUser, authReady, state.onboardingComplete, hasAccess, onAuthScreen, onOnboarding, router]);

  useEffect(() => {
    if (!state.ready) return;
    configureDailyReminder({
      enabled: Boolean(state.dailyReminder),
      shoppingList: state.shoppingList || {},
      langIndex: state.langIndex,
      hour: state.reminderHour || 17,
    }).then((result) => {
      dispatch({ type:'set', key:'reminderStatus', value:result.permission });
      if (state.dailyReminder && !result.scheduled) {
        dispatch({ type:'set', key:'dailyReminder', value:false });
      }
    }).catch((error) => {
      console.warn('Daily reminder could not be scheduled', error);
      dispatch({ type:'set', key:'reminderStatus', value:'error' });
    });
  }, [state.ready, state.dailyReminder, state.reminderHour, state.shoppingList, state.langIndex, dispatch]);

  if (!storeReadyForUser || !authReady ||
      (!state.onboardingComplete && !onOnboarding) ||
      (state.onboardingComplete && !hasAccess && !onAuthScreen)) {
    return <View style={{ flex:1, backgroundColor:c.ground }} />;
  }
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
        <Stack.Screen name="login" options={{ headerShown:false }} />
        <Stack.Screen name="signup" options={{ headerShown:false }} />
        <Stack.Screen
          name="account"
          options={{ title: state.langIndex === 1 ? 'Account & security' : 'Hesap ve güvenlik' }}
        />
        <Stack.Screen name="onboarding" options={{ headerShown:false }} />
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
        <Stack.Screen
          name="pisirdiklerim"
          options={{ title: state.langIndex === 1 ? 'Cooked recipes' : 'Pişirdiklerim' }}
        />
        <Stack.Screen
          name="bana-gore-degil"
          options={{ title: state.langIndex === 1 ? 'Not for me' : 'Bana göre değil' }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return <AuthProvider><StoreProvider><Shell /></StoreProvider></AuthProvider>;
}
