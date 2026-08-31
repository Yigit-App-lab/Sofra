// "Ben" — what the app has learned, plus every setting. Showing people the model
// is what makes personalisation feel like a service rather than surveillance, and
// it is also the best debugging tool you will have.
import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import Engine from '../../src/engine';
import { REC, recById, CITIES } from '../../src/data';
import { useStore, useEngineCtx, today } from '../../src/store';
import { makeT, tl, LANGS } from '../../src/i18n';
import { useTheme, space } from '../../src/theme';
import { Label, Body, Card, LineItem, Choice, Chip, Divider } from '../../src/ui';

function Stat({ label, value }) {
  const c = useTheme();
  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between',
                     alignItems:'baseline', paddingVertical:9 }}>
        <Text style={{ color:c.ink, fontSize:15 }}>{label}</Text>
        <Text style={{ color:c.ink2, fontSize:15, fontWeight:'700' }}>{value}</Text>
      </View>
      <Divider />
    </View>
  );
}

function Weights({ title, bucket, limit, labelOf }) {
  const c = useTheme();
  const keys = Object.keys(bucket).sort((a, b) => bucket[b].w - bucket[a].w).slice(0, limit);
  if (!keys.length) return null;
  return (
    <>
      <Label>{title}</Label>
      <View style={{ gap:space.s }}>
        {keys.map((k) => (
          <View key={k}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
              <Text style={{ color:c.ink, fontSize:13.5 }}>{labelOf(k)}</Text>
              <Text style={{ color:c.ink3, fontSize:12, fontVariant:['tabular-nums'] }}>
                {bucket[k].w.toFixed(2)}
              </Text>
            </View>
            <View style={{ height:6, borderRadius:3, backgroundColor:c.surface2 }}>
              <View style={{ height:6, borderRadius:3, backgroundColor:c.accent,
                             width:`${Math.round(bucket[k].w*100)}%` }} />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

export default function Ben() {
  const c = useTheme();
  const { state, dispatch } = useStore();
  const t = makeT(state.langIndex);
  const ctx = useEngineCtx();
  const p = state.profile;
  const set = (key, value) => dispatch({ type:'set', key, value });

  const cooked = Object.keys(p.cooked);
  const fav = useMemo(() => {
    let best = null, bw = 0;
    Object.keys(p.cuisines).forEach((k) => { if (p.cuisines[k].w > bw) { bw = p.cuisines[k].w; best = k; } });
    return best ? `${t.cat(best)} · ${bw.toFixed(2)}` : '—';
  }, [p.cuisines, t.code]);
  const avg = useMemo(() => {
    const all = Engine.recommend(REC, ctx);
    return all.length ? all.reduce((s, x) => s + x.cost.perPortion, 0) / all.length : 0;
  }, [ctx]);

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
      <Card>
        <Stat label={t('cookedN')} value={cooked.length} />
        <Stat label={t('signalsN')} value={p.events} />
        <Stat label={t('pantryN')}
              value={Object.keys(state.pantry).filter((k) => state.pantry[k]).length} />
        <Stat label={t('favCat')} value={fav} />
        <Stat label={t('avgCost')} value={`${tl(avg)} ₺`} />
      </Card>

      {p.events === 0 && (
        <View style={{ marginTop:space.l }}><Body dim size={13.5}>{t('nothingYet')}</Body></View>
      )}

      {cooked.length > 0 && (
        <>
          <Label>{t('history')}</Label>
          {cooked.sort((a, b) => p.cooked[b] - p.cooked[a]).slice(0, 10).map((id) => (
            <LineItem key={id} name={t.title(recById[id])}
              chips={<Chip>{today() - p.cooked[id]}{t.code === 'en' ? 'd' : ' gün'}</Chip>} />
          ))}
        </>
      )}

      <Label>{t('settings')}</Label>
      <Body dim size={12}>{t('city')}</Body>
      <View style={{ height:space.s }} />
      <Choice scroll options={CITIES.map((x) => ({ value:x.name, label:x.name }))}
              value={state.city} onChange={(v) => set('city', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('household')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={[1,2,3,4,5,6,7,8].map((n) => ({ value:n, label:String(n) }))}
              value={state.household} onChange={(v) => set('household', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('timeBudget')} · {state.timeBudget} {t('min')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={[20,30,45,60,90].map((m) => ({ value:m, label:`${m}` }))}
              value={state.timeBudget} onChange={(v) => set('timeBudget', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>
        {t.code === 'en' ? 'Daily reminder · 11:00' : 'Günlük hatırlatma · 11:00'}
      </Body>
      <View style={{ height:space.s }} />
      <Choice
        options={[
          { value:false, label:t.code === 'en' ? 'Off' : 'Kapalı' },
          { value:true, label:t.code === 'en' ? 'On' : 'Açık' },
        ]}
        value={Boolean(state.dailyReminder)}
        onChange={(v) => set('dailyReminder', v)}
      />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('budget')} · {state.maxPerPortion} ₺</Body>
      <View style={{ height:space.s }} />
      <Choice options={[15,25,40,60,120].map((m) => ({ value:m, label:`${m} ₺` }))}
              value={state.maxPerPortion} onChange={(v) => set('maxPerPortion', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('meatless')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={[{ value:false, label:t.code === 'en' ? 'Off' : 'Kapalı' },
                        { value:true, label:t.code === 'en' ? 'On' : 'Açık' }]}
              value={state.meatless} onChange={(v) => set('meatless', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>
        {t.code === 'en' ? 'Diet preference' : 'Beslenme tercihi'}
      </Body>
      <View style={{ height:space.s }} />
      <Choice
        options={[
          {
            value:'standard',
            label:t.code === 'en' ? 'Standard' : 'Standart'
          },
          {
            value:'vegetarian',
            label:t.code === 'en' ? 'Vegetarian' : 'Vejetaryen'
          },
          {
            value:'vegan',
            label:'Vegan'
          },
        ]}
        value={state.dietPreference || 'standard'}
        onChange={(v) => set('dietPreference', v)}
      />

      <View style={{ height:space.m }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Gluten' : 'Gluten'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Gluten-free' : 'Glutensiz'
          },
        ]}
        value={Boolean(state.glutenFree)}
        onChange={(v) => set('glutenFree', v)}
      />

      <View style={{ height:space.s }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Lactose' : 'Laktoz'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Lactose-free' : 'Laktozsuz'
          },
        ]}
        value={Boolean(state.lactoseFree)}
        onChange={(v) => set('lactoseFree', v)}
      />

      <View style={{ height:space.s }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Glycemic' : 'Glisemik'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Low glycemic' : 'Düşük Glisemik'
          },
        ]}
        value={Boolean(state.lowGlycemic)}
        onChange={(v) => set('lowGlycemic', v)}
      />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('language')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={LANGS.map((l, i) => ({ value:i, label:l.label }))}
              value={state.langIndex} onChange={(v) => set('langIndex', v)} />

      <View style={{ height:space.xl }} />
      <Pressable onPress={() => dispatch({ type:'resetProfile' })}>
        <Text style={{ color:c.ink3, fontSize:13, textDecorationLine:'underline' }}>
          {t('resetProfile')}
        </Text>
      </Pressable>
    </ScrollView>
  );
}
