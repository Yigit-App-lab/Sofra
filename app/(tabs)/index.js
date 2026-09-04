import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Engine from '../../src/engine';
import Suggestions from '../../src/suggestions';
import { ING, REC } from '../../src/data';
import { useStore, useEngineCtx, PRICING_CITY } from '../../src/store';
import { makeT } from '../../src/i18n';
import { useTheme, space, radius } from '../../src/theme';
import { Body, ErrorNotice, ScreenBackdrop, Title } from '../../src/ui';
import SuggestionCard from '../../src/SuggestionCard';
import { apiErrorKey, getMarketPrices, getSeasonalRecipes, getTonightRecipes } from '../../src/api';

const SUGGESTION_LIMIT = 3;

function ChoiceButton({ number, title, subtitle, onPress, disabled }) {
  const c = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({ backgroundColor:c.surface, borderColor:c.line, borderWidth:1,
        borderRadius:radius.m, padding:space.m, marginBottom:space.s, flexDirection:'row',
        alignItems:'center', opacity:disabled ? 0.5 : pressed ? 0.7 : 1 })}>
      <View style={{ width:38, height:38, borderRadius:19, backgroundColor:c.accentSoft,
        alignItems:'center', justifyContent:'center', marginRight:space.m }}>
        <Text style={{ color:c.accent, fontSize:16, fontWeight:'800' }}>{number}</Text>
      </View>
      <View style={{ flex:1 }}>
        <Text style={{ color:c.ink, fontSize:16, fontWeight:'700' }}>{title}</Text>
        <Text style={{ color:c.ink3, fontSize:12.5, marginTop:3 }}>{subtitle}</Text>
      </View>
      <Text style={{ color:c.ink3, fontSize:21 }}>›</Text>
    </Pressable>
  );
}

export default function Tonight() {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const t = makeT(state.langIndex);
  const english = t.code === 'en';
  const ctx = useEngineCtx();
  const [choice, setChoice] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Which button produced the current state, so a failure can be retried in
  // place instead of making the user guess which one they pressed.
  const [lastMode, setLastMode] = useState(null);
  // The profile filters now live in ctx, so the bundled ranker applies the same
  // meatless / gluten / lactose / low-glycemic rules the API applies.
  const ranked = useMemo(() => Engine.recommend(REC, ctx), [ctx]);
  const kilerIds = useMemo(
    () => Object.values(state.kiler || {}).map(item => Number(item.id)),
    [state.kiler]
  );

  function show(mode, items) {
    // One dish per family, so three cards are three different dinners — but
    // topped up rather than shrinking the answer when variety is impossible.
    const suggestions = Suggestions.normalize(items, {
      english, limit:SUGGESTION_LIMIT, perFamily:1, topUp:true,
    });
    if (!suggestions.length) return false;
    setError(null);
    setChoice({ mode, suggestions });
    return true;
  }

  function fail(message) {
    setChoice(null);
    setError({ message, retry: true });
  }

  /** No dinner matched. True, and not a failure — so no retry button. */
  function empty(message) {
    setChoice(null);
    setError({ message, retry: false });
  }

  function retry() {
    if (lastMode === 'seasonal') recommendSeasonal();
    else if (lastMode === 'kiler') recommendFromKiler();
    else recommendRandom();
  }

  async function recommendRandom() {
    setLastMode('random');
    setLoading(true);
    setError(null);
    let currentRanked = ranked.filter((item) => item.recipe.main);
    try {
      const produce = ING
        .filter((item) => ['sebze', 'meyve', 'yesillik', 'protein'].includes(item.kind))
        .map((item) => ({ id:item.id, name:item.names.tr, unit:item.unit, kind:item.kind }));
      const snapshot = await getMarketPrices(PRICING_CITY, produce);
      dispatch({ type:'setMarketPrices', value:snapshot });
      const priceOverrides = Object.fromEntries(
        (snapshot.items || []).map((item) => [item.id, item])
      );
      currentRanked = Engine.recommend(REC, { ...ctx, priceOverrides })
        .filter((item) => item.recipe.main);
    } catch (e) {
      // Live data improves the ranking but must never block dinner offline.
      console.warn('Market prices unavailable; using seasonal estimates:', e);
    } finally {
      setLoading(false);
    }
    if (!currentRanked.length) {
      empty(t('noneMatch'));
      return;
    }
    const previousIds = new Set(
      choice?.mode === 'random' ? choice.suggestions.map(item => item.id) : []
    );
    // Keep the surprise, but only inside the best current cost/fit band so
    // today's market prices materially affect which dinners can be selected.
    const leading = currentRanked.slice(0, Math.min(12, currentRanked.length));
    const candidates = leading.filter(item => !previousIds.has(item.recipe.id));
    const pool = candidates.length ? candidates : leading;
    const results = [...pool].sort(() => Math.random() - 0.5);
    if (!show('random', results)) empty(t('noneMatch'));
  }

  async function recommendSeasonal() {
    setLastMode('seasonal');
    try {
      setLoading(true);
      setError(null);
      const data = await getSeasonalRecipes({
        month: ctx.month,
        region: ctx.region,
        city: PRICING_CITY,
        limit: SUGGESTION_LIMIT * 3,
        timeBudget: state.timeBudget,
        diet: state.dietPreference,
        glutenFree: state.glutenFree,
        lactoseFree: state.lactoseFree,
        lowGlycemic: state.lowGlycemic,
      });
      if (!show('seasonal', data.recipes || [])) empty(t('noSeasonalDinner'));
    } catch (e) {
      console.error('Tonight seasonal recommendation:', e);
      fail(t(apiErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }

  async function recommendFromKiler() {
    setLastMode('kiler');
    if (!kilerIds.length) {
      empty(t('kilerEmpty'));
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getTonightRecipes(kilerIds, {
        limit:SUGGESTION_LIMIT * 3, timeBudget:state.timeBudget, city:PRICING_CITY,
        meatless:state.meatless,
        diet:state.dietPreference,
        glutenFree:state.glutenFree,
        lactoseFree:state.lactoseFree,
        lowGlycemic:state.lowGlycemic,
      });
      if (!show('kiler', data.recipes || [])) empty(t('noKilerRecipe'));
    } catch (e) {
      console.error('Tonight Kiler recommendation:', e);
      fail(t(apiErrorKey(e)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScreenBackdrop source={require('../../assets/onboarding/family-sofra.png')}>
    <ScrollView style={{ backgroundColor:'transparent' }}
      contentContainerStyle={{ padding:space.l, paddingBottom:space.xl * 2 }}>
      <View style={{ marginBottom:space.l }}>
        <Title size={28}>{t('tonightQuestion')}</Title>
      </View>
      <ChoiceButton number="1" title={t('chooseForMe')} subtitle={t('chooseForMeSub')}
        onPress={recommendRandom} disabled={loading} />
      <ChoiceButton number="2" title={t('chooseBySeason')} subtitle={t('chooseBySeasonSub')}
        onPress={recommendSeasonal} disabled={loading} />
      <ChoiceButton number="3" title={t('chooseFromKiler')}
        subtitle={t('chooseFromKilerSub', kilerIds.length)}
        onPress={recommendFromKiler} disabled={loading} />

      {loading && (
        <View style={{ paddingVertical:space.xl, alignItems:'center' }}>
          <ActivityIndicator color={c.accent} />
          <Body dim size={13} style={{ marginTop:space.s }}>{t('findingRecipe')}</Body>
        </View>
      )}
      {!loading && error ? (
        <ErrorNotice message={error.message} retryLabel={t('retry')}
          onRetry={error.retry ? retry : null} />
      ) : null}
      {!loading && choice ? (
        <View style={{ marginTop:space.l }}>
          {choice.suggestions.map((suggestion, index) => (
            <SuggestionCard key={suggestion.key} suggestion={suggestion} mode={choice.mode}
              index={index} t={t} ctx={ctx} onPress={(s) => router.push(s.route)} />
          ))}
        </View>
      ) : null}
    </ScrollView>
    </ScreenBackdrop>
  );
}
