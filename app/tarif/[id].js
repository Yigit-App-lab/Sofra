// One recipe, costed line by line, with the three feedback buttons.
// Everything the app knows about its user enters through this screen.
import React from 'react';
import { ScrollView, View, Text } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Engine from '../../src/engine';
import { recById } from '../../src/data';
import { useStore, useEngineCtx } from '../../src/store';
import { makeT, tl } from '../../src/i18n';
import { useTheme, space } from '../../src/theme';
import { Title, Body, Label, Chip, Button, Row, Price, LineItem, stateChip } from '../../src/ui';

export default function Tarif() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { state, dispatch } = useStore();
  const t = makeT(state.langIndex);
  const ctx = useEngineCtx();

  const r = recById[id];
  if (!r) return <View style={{ padding:space.xl }}><Body dim>—</Body></View>;

  const cost = Engine.costOf(r, ctx);
  const feedback = state.profile.feedback?.[r.id] || {};
  const liked = Boolean(feedback.liked || feedback.event === 'liked');
  const cooked = Boolean(feedback.cooked || feedback.event === 'cooked');
  const disliked = Boolean(feedback.disliked || feedback.event === 'disliked');
  const hasFeedback = liked || cooked || disliked;

  function record(event) {
    dispatch({ type:'feedback', recipe:r, event });
  }

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
      <Title>{t.title(r)}</Title>
      <View style={{ marginTop:space.s }}>
        <Price value={tl(cost.perPortion)} unit={t('perPerson')} size={30} />
        <Body dim size={12.5} style={{ marginTop:2 }}>
          {r.minutes} {t('min')} · {t('forN', r.servings || 2)} {tl(cost.total)} ₺
        </Body>
      </View>

      <Label>{t('ingredients')}</Label>
      {r.ingredients.map((ri) => {
        const it = ctx.byId[ri.id];
        const st = Engine.stateOf(it, ctx.region, ctx.month, ctx.regions);
        const lineCost = Engine.unitsConsumed(ri, it) * Engine.unitPrice(
          it, ctx.region, ctx.month, ctx.regions, ctx.priceOverrides
        );
        return (
          <LineItem key={ri.id}
            name={t.itemName(it)}
            sub={ri.display || `${ri.qty} ${ri.unit}`}
            chips={
              <Row gap={5}>
                {state.pantry[ri.id] ? <Chip tone="accent">✓</Chip> : null}
                {st && (st.key === 'peak' || st.key === 'winter' || st.key === 'off')
                  ? stateChip(st, t) : null}
              </Row>
            }
            value={ri.optional ? '—' : `${tl(lineCost)} ₺`} />
        );
      })}

      <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'baseline',
                     borderTopWidth:2, borderTopColor:c.ink, paddingTop:space.m, marginTop:space.s }}>
        <Text style={{ color:c.ink, fontSize:16, fontWeight:'700' }}>{t('total')}</Text>
        <Text style={{ color:c.accent, fontSize:20, fontWeight:'700', fontVariant:['tabular-nums'] }}>
          {tl(cost.total)} ₺
        </Text>
      </View>

      <Label>{t('method')}</Label>
      {r.steps.map((s, i) => (
        <Row key={i} gap={space.m} style={{ alignItems:'flex-start', paddingVertical:7 }}>
          <Text style={{ color:c.accent, fontSize:13, minWidth:14, paddingTop:2, fontWeight:'700' }}>
            {i + 1}
          </Text>
          <Text style={{ flex:1, color:c.ink, fontSize:15, lineHeight:22 }}>{s}</Text>
        </Row>
      ))}

      <View style={{ height:space.xl }} />
      <Row gap={space.s}>
        <Button disabled={liked || disliked} style={{ flex:1 }}
          kind={liked ? 'primary' : 'ghost'} onPress={() => record('liked')}>
          {liked ? '✓ ' : ''}{t('loved')}
        </Button>
        <Button disabled={cooked} style={{ flex:1 }}
          kind={cooked ? 'primary' : 'ghost'} onPress={() => record('cooked')}>
          {cooked ? '✓ ' : ''}{t('made')}
        </Button>
      </Row>
      <View style={{ height:space.s }} />
      <Button disabled={disliked || liked}
        kind={disliked ? 'primary' : 'ghost'} onPress={() => record('disliked')}>
        {disliked ? '✓ ' : ''}{t('nope')}
      </Button>
      {hasFeedback ? <Body dim size={12.5} style={{ marginTop:space.s, textAlign:'center' }}>
        {t('feedbackSaved')}
      </Body> : null}
    </ScrollView>
  );
}
