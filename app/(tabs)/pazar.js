// "Pazar" — what is cheap this month, in ₺, and what is about to come back.
// This is the screen that makes the app feel like it knows the market.
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView } from 'react-native';
import Engine from '../../src/engine';
import { ING, REC } from '../../src/data';
import { getMarketPrices } from '../../src/api';
import { useStore, useEngineCtx } from '../../src/store';
import { makeT, tl } from '../../src/i18n';
import { space } from '../../src/theme';
import { Label, Body, LineItem, stateChip, Chip } from '../../src/ui';

export default function Pazar() {

  const { state } = useStore();
  const t = makeT(state.langIndex);
  const ctx = useEngineCtx();
  const [live, setLive] = useState(null);
  const list = useMemo(() => Engine.marketNow(ING, ctx), [ctx]);

  useEffect(() => {
    let active = true;
    const produce = list
      .filter((x) => ['sebze', 'meyve', 'yesillik'].includes(x.item.kind))
      .slice(0, 18)
      .map((x) => ({ id:x.item.id, name:x.item.names.tr, unit:x.item.unit }));
    getMarketPrices(state.city, produce)
      .then((result) => { if (active) setLive(result); })
      .catch(() => { if (active) setLive(null); });
    return () => { active = false; };
  }, [state.city, list]);

  const cheap = list.filter((x) => x.factor < 1);
  const dear = list.filter((x) => x.factor > 1.2);
  const soon = useMemo(() => Engine.comingSoon(REC, ctx, 6), [ctx]);

  const unitLabel = (u) => (u === 'kg' ? '₺/kg' : u === 'L' ? '₺/L'
    : u === 'adet' ? (t.code === 'en' ? '₺/each' : '₺/adet')
    : (t.code === 'en' ? '₺/bunch' : '₺/demet'));

  const liveById = useMemo(() => Object.fromEntries(
    (live?.items || []).map((item) => [item.id, item])
  ), [live]);

  const Item = ({ x }) => {
    const observed = liveById[x.item.id];
    const price = observed?.average ?? x.price;
    const sub = observed
      ? `${t('livePrices')} · ${t('marketCount', observed.market_count)}`
      : (x.item.source === 'tahmin' ? t('estimated') : t('seasonalFallback'));
    return (
      <LineItem
        name={t.itemName(x.item)}
        sub={sub}
        chips={stateChip(x.state, t)}
        value={`${tl(price)} ${unitLabel(x.item.unit)}`}
      />
    );
  };

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
      <Body dim size={12.5}>
        {t.month(ctx.month)} · {state.city} · {ctx.regions[ctx.region][t.code === 'en' ? 'en' : 'tr']}
      </Body>
      {live?.updated_at && (
        <Body dim size={11.5}>
          {t('lastUpdated')} · {new Date(live.updated_at).toLocaleString(t.code === 'en' ? 'en-GB' : 'tr-TR')}
        </Body>
      )}

      <Label>{t('cheapNow')}  ·  {cheap.length}</Label>
      {cheap.map((x) => <Item key={x.item.id} x={x} />)}

      {dear.length > 0 && (
        <>
          <Label>{t('expensiveNow')}  ·  {dear.length}</Label>
          {dear.map((x) => <Item key={x.item.id} x={x} />)}
        </>
      )}

      {soon.length > 0 && (
        <>
          <Label>{t('comingSoon')}</Label>
          {soon.map((x) => (
            <LineItem key={x.recipe.id} name={t.title(x.recipe)}
              sub={x.blockers.map((b) => t.itemName(ctx.byId[b])).join(', ')}
              chips={<Chip>{t.month(x.nextMonth)}</Chip>} />
          ))}
        </>
      )}
    </ScrollView>
  );
}
