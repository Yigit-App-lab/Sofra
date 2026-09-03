import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Engine from './engine';
import { byId, cityRec, REGIONS } from './data';
import { deviceLangIndex } from './i18n';
import { useAuth } from './auth';
import { readCloudUserState, userDataFromState, writeCloudUserState } from './cloudStore';

const LEGACY_KEY = 'sofra.tr.v1';
const MIGRATION_OWNER_KEY = 'sofra.tr.v2.migrationOwner';
const GUEST_KEY = 'sofra.tr.v2.guest';
const userKey = (uid) => `sofra.tr.v2.user.${uid}`;
export const PRICING_CITY = 'İstanbul';

const initial = {
  ready: false,
  ownerUid: null,
  guestMode: false,
  syncStatus: 'idle',
  syncError: null,
  clientUpdatedAt: 0,
  langIndex: 0,
  languageDefaultVersion: 1,
  onboardingComplete: false,
  city: PRICING_CITY,
  timeBudget: 60,
  maxPerPortion: 120,
  meatless: false,
  dietPreference: 'standard',
  glutenFree: false,
  lactoseFree: false,
  lowGlycemic: false,
  dailyReminder: false,
  reminderHour: 17,
  reminderStatus: 'idle',
  skill: 1,
  // A plausible Turkish store cupboard, so the first launch is not an empty screen.
  pantry: {
    sogan:1, patates:1, salca_domates:1, aycicek_yagi:1, tuz:1, karabiber:1,
    un:1, pirinc:1, makarna:1, seker:1, yumurta:1, kirmizi_mercimek:1,
  },

  // New server-backed Kiler.
  // Keys are kiler_ingredients numeric IDs, stored as strings in JS objects.
  kiler: {},

  // Persistent shopping list.
  // Keys are ingredient IDs stored as strings.
  shoppingList: {},
  marketPriceSnapshot: null,

  profile: Engine.emptyProfile(),
};

/** Integer day number — the engine takes days, not dates, so its tests stay stable. */
export function today() { return Math.floor(Date.now() / 86400000); }

export function apiRecipeForLearning(recipe) {
  return {
    id: `api:${recipe.id}`,
    category: recipe.category || 'api',
    ingredients: [],
    tags: [],
    hero: null,
    apiTitle: recipe.title,
  };
}

function reducer(s, a) {
  switch (a.type) {
    case 'beginUser':
      return {
        ...initial,
        langIndex: s.langIndex,
        ownerUid: a.uid,
        syncStatus: a.uid ? 'loading' : 'idle',
      };
    case 'hydrate': {
      const profile = { ...s.profile, ...(a.value?.profile || {}) };
      const hydrated = { ...(a.value || {}) };
      delete hydrated.household;
      profile.liked = { ...(profile.liked || {}) };
      Object.entries(profile.feedback || {}).forEach(([id, item]) => {
        if (item?.liked || item?.event === 'liked') {
          profile.liked[id] = item.day || today();
        }
      });
      return {
        ...s, ...hydrated, profile, city:PRICING_CITY, ready:true,
        ownerUid:a.uid, syncStatus:a.uid ? 'synced' : 'idle', syncError:null,
        clientUpdatedAt:Number(a.clientUpdatedAt || 0),
      };
    }
    case 'syncing': return { ...s, syncStatus:'syncing', syncError:null };
    case 'synced': return { ...s, syncStatus:'synced', syncError:null };
    case 'syncError': return { ...s, syncStatus:'error', syncError:a.message || 'sync-failed' };
    case 'set': return a.key === 'city' ? { ...s, city:PRICING_CITY } : { ...s, [a.key]: a.value };
    case 'togglePantry': {
      const pantry = { ...s.pantry };
      if (pantry[a.id]) delete pantry[a.id]; else pantry[a.id] = 1;
      return { ...s, pantry };
    }

    case 'toggleKiler': {
      const kiler = { ...(s.kiler || {}) };
      const id = String(a.id);

      if (kiler[id]) {
        delete kiler[id];
      } else {
        kiler[id] = {
          id: a.id,
          name: a.name
        };
      }

      return { ...s, kiler };
    }

    case 'clearKiler':
      return { ...s, kiler: {} };

    case 'addShoppingItem': {
      const shoppingList = { ...(s.shoppingList || {}) };
      const id = String(a.id);

      shoppingList[id] = {
        id: a.id,
        name: a.name,
        quantity: a.quantity ?? null,
        unit: a.unit ?? null,
        checked: false,
      };

      return { ...s, shoppingList };
    }

    case 'removeShoppingItem': {
      const shoppingList = { ...(s.shoppingList || {}) };
      delete shoppingList[String(a.id)];
      return { ...s, shoppingList };
    }

    case 'toggleShoppingItem': {
      const shoppingList = { ...(s.shoppingList || {}) };
      const id = String(a.id);

      if (shoppingList[id]) {
        shoppingList[id] = {
          ...shoppingList[id],
          checked: !shoppingList[id].checked,
        };
      }

      return { ...s, shoppingList };
    }

    case 'clearShoppingList':
      return { ...s, shoppingList: {} };

    case 'setMarketPrices': {
      const previous = s.marketPriceSnapshot;
      if (!previous || previous.city !== a.value?.city) {
        return { ...s, marketPriceSnapshot: a.value };
      }
      const items = Object.fromEntries(
        (previous.items || []).map((item) => [item.id, item])
      );
      (a.value.items || []).forEach((item) => { items[item.id] = item; });
      return {
        ...s,
        marketPriceSnapshot: { ...previous, ...a.value, items:Object.values(items) },
      };
    }

    case 'feedback': {
      // Engine.learn mutates in place, so clone first — React needs a new object.
      const profile = JSON.parse(JSON.stringify(s.profile));
      Engine.learn(profile, a.recipe, a.event, today(), byId);
      profile.feedback = { ...(profile.feedback || {}) };
      const previousFeedback = profile.feedback[a.recipe.id] || {};
      const feedback = {
        liked: Boolean(previousFeedback.liked || previousFeedback.event === 'liked'),
        cooked: Boolean(previousFeedback.cooked || previousFeedback.event === 'cooked'),
        disliked: Boolean(previousFeedback.disliked || previousFeedback.event === 'disliked'),
        day: today(),
      };
      if (a.event === 'liked') {
        feedback.liked = true;
        feedback.disliked = false;
      } else if (a.event === 'cooked') {
        feedback.cooked = true;
      } else if (a.event === 'disliked') {
        feedback.disliked = true;
        feedback.liked = false;
      }
      profile.feedback[a.recipe.id] = feedback;
      if (a.recipe.apiTitle) {
        profile.apiRecipes = { ...(profile.apiRecipes || {}) };
        profile.apiRecipes[a.recipe.id] = {
          title: a.recipe.apiTitle,
          category: a.recipe.category,
        };
      }
      return { ...s, profile };
    }
    case 'resetProfile': return { ...s, profile: Engine.emptyProfile() };
    default: return s;
  }
}

const Ctx = createContext(null);

export function StoreProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initial);
  const { user, ready:authReady } = useAuth();

  useEffect(() => {
    if (!authReady) return;
    const uid = user?.uid || null;
    let cancelled = false;
    dispatch({ type:'beginUser', uid });
    (async () => {
      try {
        const deviceRaw = await AsyncStorage.getItem('sofra.tr.v2.device');
        const device = deviceRaw ? JSON.parse(deviceRaw) : {};
        const migratedLanguage = Number(device.languageDefaultVersion || 0) >= 1;
        const deviceSettings = {
          ...device,
          // Existing installs are moved to Turkish once. A later explicit
          // language choice is preserved because version 1 is then persisted.
          langIndex:migratedLanguage ? Number(device.langIndex || 0) : 0,
          languageDefaultVersion:1,
        };
        if (!uid) {
          const guestRaw = await AsyncStorage.getItem(GUEST_KEY);
          const guest = guestRaw ? JSON.parse(guestRaw) : null;
          if (!cancelled) dispatch({
            type:'hydrate', uid:null,
            value:{ langIndex:deviceLangIndex(), ...(guest?.data || {}), ...deviceSettings },
          });
          return;
        }

        const [localRaw, cloud, migrationOwner, legacyRaw] = await Promise.all([
          AsyncStorage.getItem(userKey(uid)),
          readCloudUserState(uid).catch(() => null),
          AsyncStorage.getItem(MIGRATION_OWNER_KEY),
          AsyncStorage.getItem(LEGACY_KEY),
        ]);
        const localEnvelope = localRaw ? JSON.parse(localRaw) : null;
        let value = null;
        let clientUpdatedAt = 0;

        if (localEnvelope && Number(localEnvelope.clientUpdatedAt || 0) >= Number(cloud?.clientUpdatedAt || 0)) {
          value = localEnvelope.data;
          clientUpdatedAt = Number(localEnvelope.clientUpdatedAt || 0);
        } else if (cloud?.data) {
          value = cloud.data;
          clientUpdatedAt = Number(cloud.clientUpdatedAt || 0);
        } else if (!migrationOwner && legacyRaw) {
          value = JSON.parse(legacyRaw);
          clientUpdatedAt = Date.now();
          await AsyncStorage.setItem(MIGRATION_OWNER_KEY, uid);
        }

        if (!cancelled) dispatch({
          type:'hydrate', uid, clientUpdatedAt,
          value:{ langIndex:deviceLangIndex(), ...(value || {}), ...deviceSettings },
        });
      } catch (e) {
        if (!cancelled) dispatch({ type:'hydrate', uid, value:{ langIndex:deviceLangIndex() } });
      }
    })();
    return () => { cancelled = true; };
  }, [authReady, user?.uid]);

  useEffect(() => {
    const uid = user?.uid;
    if (!state.ready || !uid || state.ownerUid !== uid) return;
    const data = userDataFromState(state);
    const clientUpdatedAt = Date.now();
    // Always save locally immediately. Cloud writes are debounced, but signing
    // out right after a change must never discard that change on this device.
    AsyncStorage.setItem(userKey(uid), JSON.stringify({ data, clientUpdatedAt })).catch(() => {});
    const timer = setTimeout(async () => {
      dispatch({ type:'syncing' });
      try {
        await writeCloudUserState(uid, data, clientUpdatedAt);
        dispatch({ type:'synced' });
      } catch (error) {
        dispatch({ type:'syncError', message:error?.code || error?.message });
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [
    state.ready, state.ownerUid, user?.uid,
    state.timeBudget, state.maxPerPortion, state.meatless, state.dietPreference,
    state.glutenFree, state.lactoseFree, state.lowGlycemic, state.skill,
    state.pantry, state.kiler, state.shoppingList, state.profile,
  ]);

  useEffect(() => {
    if (!state.ready || state.ownerUid) return;
    if (!state.guestMode) {
      AsyncStorage.removeItem(GUEST_KEY).catch(() => {});
      return;
    }
    const data = { ...userDataFromState(state), guestMode:true };
    AsyncStorage.setItem(GUEST_KEY, JSON.stringify({ data, clientUpdatedAt:Date.now() })).catch(() => {});
  }, [
    state.ready, state.ownerUid, state.guestMode,
    state.timeBudget, state.maxPerPortion, state.meatless, state.dietPreference,
    state.glutenFree, state.lactoseFree, state.lowGlycemic, state.skill,
    state.pantry, state.kiler, state.shoppingList, state.profile,
  ]);

  useEffect(() => {
    if (!state.ready) return;
    const device = {
      langIndex:state.langIndex,
      languageDefaultVersion:1,
      onboardingComplete:state.onboardingComplete,
      dailyReminder:state.dailyReminder,
      reminderHour:state.reminderHour,
    };
    AsyncStorage.setItem('sofra.tr.v2.device', JSON.stringify(device)).catch(() => {});
  }, [state.ready, state.langIndex, state.onboardingComplete, state.dailyReminder, state.reminderHour]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStore must be used inside <StoreProvider>');
  return v;
}

/** The context object the engine needs. Memoised — it is rebuilt on every render. */
export function useEngineCtx() {
  const { state } = useStore();
  const priceOverrides = useMemo(() => {
    const snapshot = state.marketPriceSnapshot;
    if (!snapshot || snapshot.city !== PRICING_CITY) return {};
    return Object.fromEntries((snapshot.items || []).map((item) => [item.id, item]));
  }, [state.marketPriceSnapshot]);
  return useMemo(() => ({
    byId,
    regions: REGIONS,
    region: cityRec(PRICING_CITY).region,
    month: new Date().getMonth() + 1,
    pantrySet: state.pantry,
    profile: state.profile,
    timeBudget: state.timeBudget,
    maxPerPortion: state.maxPerPortion,
    meatless: state.meatless,
    skill: state.skill,
    day: today(),
    priceOverrides,
    priceSnapshot: state.marketPriceSnapshot,
  }), [state.pantry, state.profile, state.timeBudget,
       state.maxPerPortion, state.meatless, state.skill, state.marketPriceSnapshot,
       priceOverrides]);
}
