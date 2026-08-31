import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Engine from '../../src/engine';
import { ING, REC, byId } from '../../src/data';
import { useStore, useEngineCtx, PRICING_CITY, apiRecipeForLearning } from '../../src/store';
import { makeT, tl } from '../../src/i18n';
import { useTheme, space, radius } from '../../src/theme';
import { Body, Button, Card, Chip, Price, Row, Title, stateChip } from '../../src/ui';
import { getMarketPrices, getSeasonalRecipes, getTonightRecipes } from '../../src/api';

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
  const ranked = useMemo(() => Engine.recommend(REC, ctx), [ctx]);
  const kilerIds = useMemo(
    () => Object.values(state.kiler || {}).map(item => Number(item.id)),
    [state.kiler]
  );

  async function recommendRandom() {
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
      setChoice(null);
      setError(t('noneMatch'));
      return;
    }
    const previousIds = new Set(
      choice?.kind === 'local' ? choice.results.map(item => item.recipe.id) : []
    );
    // Keep the surprise, but only inside the best current cost/fit band so
    // today's market prices materially affect which dinners can be selected.
    const leading = currentRanked.slice(0, Math.min(12, currentRanked.length));
    const candidates = leading.filter(item => !previousIds.has(item.recipe.id));
    const pool = candidates.length ? candidates : leading;
    const results = [...pool]
      .sort(() => Math.random() - 0.5)
      .slice(0, 3);
    setError(null);
    setChoice({ kind:'local', mode:'random', results,
      reason:english ? 'A dinner idea chosen for you' : 'Senin için seçilen bir akşam yemeği' });
  }

  async function recommendSeasonal() {
    try {
      setLoading(true);
      setError(null);
      const data = await getSeasonalRecipes({
        month: ctx.month,
        region: ctx.region,
        city: PRICING_CITY,
        limit: 3,
        timeBudget: state.timeBudget,
        diet: state.dietPreference,
        glutenFree: state.glutenFree,
        lactoseFree: state.lactoseFree,
        lowGlycemic: state.lowGlycemic,
      });
      const recipes = data.recipes || [];
      if (!recipes.length) {
        setChoice(null);
        setError(english ? 'No suitable seasonal dinner was found.' : 'Mevsime uygun akşam yemeği bulunamadı.');
        return;
      }
      setChoice({ kind:'api', mode:'seasonal', recipes });
    } catch (e) {
      console.error('Tonight seasonal recommendation:', e);
      setChoice(null);
      setError(english ? 'Seasonal recommendations could not be loaded.' : 'Mevsim önerileri yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  async function recommendFromKiler() {
    if (!kilerIds.length) {
      setChoice(null);
      setError(english
        ? 'Add ingredients to Kiler first so Sofra can match a recipe.'
        : 'Sofra’nın tarif eşleştirebilmesi için önce Kiler’e malzeme ekle.');
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const data = await getTonightRecipes(kilerIds, {
        limit:3, timeBudget:state.timeBudget, city:PRICING_CITY,
      });
      const recipes = data.recipes || [];
      if (!recipes.length) {
        setChoice(null);
        setError(english ? 'No suitable Kiler recipe was found.' : 'Kiler’e uygun tarif bulunamadı.');
        return;
      }
      setChoice({ kind:'api', mode:'kiler', recipes });
    } catch (e) {
      console.error('Tonight Kiler recommendation:', e);
      setChoice(null);
      setError(english ? 'Kiler recommendation could not be loaded.' : 'Kiler önerisi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  function recordApiFeedback(recipe, event) {
    dispatch({ type:'feedback', recipe:apiRecipeForLearning(recipe), event });
  }

  function renderLocalResult() {
    return (
      <View style={{ marginTop:space.l }}>
        {choice.results.map((s, index) => {
          const r = s.recipe;
          const scale = state.household / r.servings;
          const heroState = Engine.stateOf(byId[r.hero], ctx.region, ctx.month, ctx.regions);
          return (
            <Card key={r.id} style={{ marginBottom:space.m }}>
              <Text style={{ color:c.accent, fontSize:11, fontWeight:'800', letterSpacing:0.7 }}>
                {choice.mode === 'seasonal'
                  ? `${english ? 'SEASONAL CHOICE' : 'MEVSİMSEL SEÇİM'} ${index + 1}`
                  : `${english ? 'TONIGHT’S CHOICE' : 'BU AKŞAMIN SEÇİMİ'} ${index + 1}`}
              </Text>
              <Title size={24}>{t.title(r)}</Title>
              <Body dim size={12.5}>{r.minutes} {t('min')} · {t.cat(r.category)}</Body>
              <Body size={13} style={{ marginTop:space.s }}>{choice.reason}</Body>
              <View style={{ marginTop:space.m }}>
                <Price value={tl(s.cost.perPortion)} unit={t('perPerson')} />
                <Body dim size={12.5}>
                  {t('forN', state.household)} · {tl(s.cost.total * scale)} ₺ {t('total').toLowerCase()}
                </Body>
              </View>
              <Row gap={6} style={{ flexWrap:'wrap', marginVertical:space.m }}>
                {stateChip(heroState, t)}
                {s.missing.length > 0 && <Chip>{s.missing.length} {t('toBuy')}</Chip>}
              </Row>
              <Button onPress={() => router.push(`/tarif/${r.id}`)}>{t('cook')}</Button>
            </Card>
          );
        })}
      </View>
    );
  }

  function renderApiResult() {
    return (
      <View style={{ marginTop:space.l }}>
        {choice.recipes.map((r, index) => {
          const ready = r.missing_count === 0;
          const hasCost = r.cost_per_portion != null && (r.cost_coverage || 0) >= 0.7;
          const scale = state.household / (r.servings || 4);
          return (
            <Card key={r.id} style={{ marginBottom:space.m }}>
              <Text style={{ color:c.accent, fontSize:11, fontWeight:'800', letterSpacing:0.7 }}>
                {choice.mode === 'seasonal'
                  ? `${english ? 'SEASONAL CHOICE' : 'MEVSİMSEL SEÇİM'} ${index + 1}`
                  : `${english ? 'FROM YOUR PANTRY' : 'KİLERİNDEN'} ${index + 1}`}
              </Text>
              <Title size={24}>{r.title}</Title>
              <Body dim size={12.5}>
                {r.total_minutes != null ? `${r.total_minutes} ${t('min')} · ` : ''}
                {r.category || (english ? 'Recipe' : 'Tarif')}
              </Body>
              <Body size={13} style={{ marginTop:space.s }}>
                {choice.mode === 'seasonal'
                  ? `${english ? 'Seasonal ingredients' : 'Mevsim malzemeleri'}: ${(r.seasonal_ingredients || []).join(', ')}`
                  : english
                    ? `Matched with ${r.matched_count || 0} ingredients in your Kiler`
                    : `Kilerindeki ${r.matched_count || 0} malzemeyle eşleşti`}
              </Body>
              <View style={{ marginTop:space.m }}>
                <Price value={hasCost ? tl(r.cost_per_portion) : '—'} unit={t('perPerson')} />
                <Body dim size={12.5}>
                  {hasCost
                    ? `${t('forN', state.household)} · ${tl(r.cost_total * scale)} ₺ ${t('total').toLowerCase()} · ${t('approximateCost')}`
                    : t('costUnavailable')}
                </Body>
              </View>
              <Row gap={6} style={{ flexWrap:'wrap', marginVertical:space.m }}>
                {hasCost && (
                  <Chip>{t('priceCoverage', `%${Math.round((r.cost_coverage || 0) * 100)}`)}</Chip>
                )}
                {choice.mode === 'seasonal' && (
                  <Chip tone="accent">{r.seasonal_count} {english ? 'in season' : 'mevsiminde'}</Chip>
                )}
                {choice.mode !== 'seasonal' && (
                  <>
                <Chip tone={ready ? 'accent' : undefined}>
                  {ready ? english ? 'Ready' : 'Hazır' : `${r.missing_count} ${english ? 'missing' : 'eksik'}`}
                </Chip>
                <Chip>%{Math.round(r.match_percent || 0)} {english ? 'match' : 'eşleşme'}</Chip>
                  </>
                )}
              </Row>
              <Row gap={6} style={{ marginBottom:space.s }}>
                <Button style={{ flex:1 }} onPress={() => recordApiFeedback(r, 'liked')}>{t('loved')}</Button>
                <Button style={{ flex:1 }} kind="ghost" onPress={() => recordApiFeedback(r, 'cooked')}>{t('made')}</Button>
              </Row>
              <Button kind="ghost" onPress={() => recordApiFeedback(r, 'disliked')}>
                {t('nope')}
              </Button>
              <View style={{ height:space.s }} />
              <Button onPress={() => router.push(`/api-tarif/${r.id}`)}>
                {t('cook')}
              </Button>
            </Card>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl * 2 }}>
      <View style={{ marginBottom:space.l }}>
        <Title size={28}>{english ? 'What shall we cook tonight?' : 'Bu akşam ne pişirelim?'}</Title>
      </View>
      <ChoiceButton number="1" title={english ? 'Choose for me' : 'Benim için seç'}
        subtitle={english ? 'Recommend a random dinner' : 'Rastgele bir akşam yemeği öner'}
        onPress={recommendRandom} disabled={loading} />
      <ChoiceButton number="2" title={english ? 'Choose by season' : 'Mevsime göre seç'}
        subtitle={english ? 'Use ingredients in season now' : 'Şu an mevsiminde olan malzemeleri kullan'}
        onPress={recommendSeasonal} disabled={loading} />
      <ChoiceButton number="3" title={english ? 'Choose from my Kiler' : 'Kilerimden seç'}
        subtitle={english ? `Match my ${kilerIds.length} Kiler ingredients` : `${kilerIds.length} Kiler malzememle eşleştir`}
        onPress={recommendFromKiler} disabled={loading} />

      {loading && (
        <View style={{ paddingVertical:space.xl, alignItems:'center' }}>
          <ActivityIndicator color={c.accent} />
          <Body dim size={13} style={{ marginTop:space.s }}>
            {english ? 'Finding a recipe…' : 'Tarif aranıyor…'}
          </Body>
        </View>
      )}
      {!loading && error ? (
        <View style={{ backgroundColor:c.surface2, borderRadius:radius.m, padding:space.m, marginTop:space.m }}>
          <Body>{error}</Body>
        </View>
      ) : null}
      {!loading && choice?.kind === 'local' ? renderLocalResult() : null}
      {!loading && choice?.kind === 'api' ? renderApiResult() : null}
    </ScrollView>
  );
}
