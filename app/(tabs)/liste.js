// "Liste" — the shopping list for the next few dinners, with a running total.
// This is also the hook for delivery integration later: the list is already a
// structured set of {ingredient, quantity, unit}, which is what a basket API wants.
import React, { useMemo } from 'react';
import { ScrollView, View, Text } from 'react-native';
import Engine from '../../src/engine';
import { REC } from '../../src/data';
import { useStore, useEngineCtx } from '../../src/store';
import { makeT, tl } from '../../src/i18n';
import { useTheme, space } from '../../src/theme';
import { Label, Body, LineItem, stateChip } from '../../src/ui';

export default function Liste() {
  const c = useTheme();
  const { state } = useStore();
  const t = makeT(state.langIndex);
  const ctx = useEngineCtx();

  const meals = useMemo(() => Engine.recommend(REC, ctx, 3), [ctx]);
  const list = useMemo(() => Engine.shoppingList(meals, ctx), [meals, ctx]);

  if (!meals.length) {
    return <View style={{ padding:space.xl }}><Body dim>{t('noneMatch')}</Body></View>;
  }

  const qty = (x) => {
    if (x.unit === 'kg') return x.units < 1 ? `${Math.round(x.units*1000)} g` : `${x.units.toFixed(1)} kg`;
    if (x.unit === 'L') return x.units < 1 ? `${Math.round(x.units*1000)} ml` : `${x.units.toFixed(1)} L`;
    return `${Math.round(x.units*10)/10} ${t.code === 'en' ? '' : x.unit}`;
  };

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
      <Label top={0}>{t('shopping')}</Label>
      {meals.map((s) => (
        <LineItem key={s.recipe.id} name={t.title(s.recipe)}
          sub={`${s.recipe.minutes} ${t('min')}`}
          value={`${tl(s.cost.perPortion)} ₺`} />
      ))}

      <Label>{t('toBuyList')}  ·  {list.length}</Label>
      {list.map((x) => (
        <LineItem key={x.id} name={t.itemName(ctx.byId[x.id])} sub={qty(x)}
          chips={stateChip(x.state, t)} value={`${tl(x.cost)} ₺`} />
      ))}

      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'baseline',
                     borderTopWidth:2, borderTopColor:c.ink, paddingTop:space.m, marginTop:space.s }}>
        <Text style={{ color:c.ink, fontSize:16, fontWeight:'700' }}>{t('total')}</Text>
        <Text style={{ color:c.accent, fontSize:21, fontWeight:'700', fontVariant:['tabular-nums'] }}>
          {tl(list.total)} ₺
        </Text>
      </View>
    </ScrollView>
  );
}
