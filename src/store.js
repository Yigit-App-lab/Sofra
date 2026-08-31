// State and persistence. One React context, one AsyncStorage key.
//
// No accounts, no server: nothing this app does needs either. That also means no
// login screen, no password reset, no Apple 5.1.1 account-deletion flow, and a
// privacy policy that is one honest paragraph.
import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Engine from './engine';
import { byId, cityRec, REGIONS } from './data';
import { deviceLangIndex } from './i18n';

const KEY = 'sofra.tr.v1';
export const PRICING_CITY = 'İstanbul';

const initial = {
  ready: false,
  langIndex: 0,
  city: PRICING_CITY,
  household: 4,
  timeBudget: 60,
  maxPerPortion: 120,
  meatless: false,
  dietPreference: 'standard',
  glutenFree: false,
  lactoseFree: false,
  lowGlycemic: false,
  dailyReminder: false,
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
    case 'hydrate': return { ...s, ...a.value, city:PRICING_CITY, ready:true };
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

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        dispatch({ type:'hydrate', value: { langIndex: deviceLangIndex(), ...(raw ? JSON.parse(raw) : {}) } });
      } catch (e) {
        // A corrupt store must never brick the app.
        dispatch({ type:'hydrate', value: { langIndex: deviceLangIndex() } });
      }
    })();
  }, []);

  useEffect(() => {
    if (!state.ready) return;
    const { ready, ...persist } = state;
    AsyncStorage.setItem(KEY, JSON.stringify(persist)).catch(() => {});
  }, [state]);

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
