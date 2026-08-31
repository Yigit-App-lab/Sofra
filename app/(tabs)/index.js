import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import Engine from '../../src/engine';
import { REC, byId } from '../../src/data';
import { useStore, useEngineCtx } from '../../src/store';
import { makeT, tl } from '../../src/i18n';
import { useTheme, space, radius } from '../../src/theme';
import { Body, Button, Card, Chip, Price, Row, Title, stateChip } from '../../src/ui';
import { getTonightRecipes } from '../../src/api';

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
  const { state } = useStore();
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

  function recommendRandom() {
    if (!ranked.length) {
      setChoice(null);
      setError(t('noneMatch'));
      return;
    }
    const previousId = choice?.kind === 'local' ? choice.result.recipe.id : null;
    const candidates = ranked.filter(item => item.recipe.id !== previousId);
    const pool = candidates.length ? candidates : ranked;
    const result = pool[Math.floor(Math.random() * pool.length)];
    setError(null);
    setChoice({ kind:'local', mode:'random', result,
      reason:english ? 'A dinner idea chosen for you' : 'Senin için seçilen bir akşam yemeği' });
  }

  function recommendSeasonal() {
    if (!ranked.length) {
      setChoice(null);
      setError(t('noneMatch'));
      return;
    }
    const result = [...ranked].sort((a, b) =>
      (b.parts?.season || 0) - (a.parts?.season || 0) || b.total - a.total
    )[0];
    setError(null);
    setChoice({ kind:'local', mode:'seasonal', result,
      reason:english ? 'Recommended for this month and your region' : 'Bu aya ve bulunduğun bölgeye uygun' });
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
      const data = await getTonightRecipes(kilerIds, { limit:1, timeBudget:state.timeBudget });
      const recipe = data.recipes?.[0];
      if (!recipe) {
        setChoice(null);
        setError(english ? 'No suitable Kiler recipe was found.' : 'Kiler’e uygun tarif bulunamadı.');
        return;
      }
      setChoice({ kind:'api', mode:'kiler', recipe,
        reason:english
          ? `Matched with ${recipe.matched_count || 0} ingredients in your Kiler`
          : `Kilerindeki ${recipe.matched_count || 0} malzemeyle eşleşti` });
    } catch (e) {
      console.error('Tonight Kiler recommendation:', e);
      setChoice(null);
      setError(english ? 'Kiler recommendation could not be loaded.' : 'Kiler önerisi yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  function renderLocalResult() {
    const s = choice.result;
    const r = s.recipe;
    const scale = state.household / r.servings;
    const heroState = Engine.stateOf(byId[r.hero], ctx.region, ctx.month, ctx.regions);
    return (
      <Card style={{ marginTop:space.l }}>
        <Text style={{ color:c.accent, fontSize:11, fontWeight:'800', letterSpacing:0.7 }}>
          {choice.mode === 'seasonal'
            ? english ? 'SEASONAL CHOICE' : 'MEVSİMSEL SEÇİM'
            : english ? 'TONIGHT’S CHOICE' : 'BU AKŞAMIN SEÇİMİ'}
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
  }

  function renderApiResult() {
    const r = choice.recipe;
    const ready = r.missing_count === 0;
    return (
      <Card style={{ marginTop:space.l }}>
        <Text style={{ color:c.accent, fontSize:11, fontWeight:'800', letterSpacing:0.7 }}>
          {english ? 'FROM YOUR PANTRY' : 'KİLERİNDEN'}
        </Text>
        <Title size={24}>{r.title}</Title>
        <Body dim size={12.5}>
          {r.category || (english ? 'Recipe' : 'Tarif')}
          {r.total_minutes != null ? ` · ${r.total_minutes} ${english ? 'min' : 'dk'}` : ''}
        </Body>
        <Body size={13} style={{ marginTop:space.s }}>{choice.reason}</Body>
        <Row gap={6} style={{ flexWrap:'wrap', marginVertical:space.m }}>
          <Chip tone={ready ? 'accent' : undefined}>
            {ready ? english ? 'Ready' : 'Hazır' : `${r.missing_count} ${english ? 'missing' : 'eksik'}`}
          </Chip>
          <Chip>%{Math.round(r.match_percent || 0)} {english ? 'match' : 'eşleşme'}</Chip>
        </Row>
        <Button onPress={() => router.push(`/api-tarif/${r.id}`)}>
          {english ? 'Open recipe' : 'Tarifi aç'}
        </Button>
      </Card>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl * 2 }}>
      <Title size={28}>{english ? 'What shall we cook tonight?' : 'Bu akşam ne pişirelim?'}</Title>
      <Body dim size={14} style={{ marginTop:5, marginBottom:space.l }}>
        {english ? 'Choose how Sofra should recommend dinner.' : 'Sofra’nın akşam yemeğini nasıl önereceğini seç.'}
      </Body>
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
