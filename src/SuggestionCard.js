// One card for every dinner suggestion, whichever method produced it.
//
// `Benim için seç` used to print the price unconditionally while the other two
// methods hid it below 70% cost coverage — so the same dish could be "18 ₺ kişi
// başı" in one method and "Fiyat hesaplanamadı" in another. Both now arrive as
// the normalised shape from `suggestions.js` and are rendered here, once.
import React from 'react';
import { Text, View } from 'react-native';
import Engine from './engine';
import { byId } from './data';
import { tl } from './i18n';
import { useTheme, space } from './theme';
import { Body, Button, Card, Chip, Price, Row, Title, stateChip } from './ui';
import Suggestions from './suggestions';

export default function SuggestionCard({ suggestion, mode, index, t, ctx, onPress }) {
  const c = useTheme();
  const s = suggestion;
  const heading = t(Suggestions.headingFor(mode));
  const heroState = s.hero && ctx
    ? Engine.stateOf(byId[s.hero], ctx.region, ctx.month, ctx.regions)
    : null;
  const coveragePercent = `%${Math.round((s.coverage || 0) * 100)}`;

  return (
    <Card style={{ marginBottom:space.m }}>
      <Text style={{ color:c.accent, fontSize:11, fontWeight:'800', letterSpacing:0.7 }}>
        {index == null ? heading : `${heading} ${index + 1}`}
      </Text>
      <Title size={24}>{s.title}</Title>
      <Body dim size={12.5}>
        {s.minutes != null ? `${s.minutes} ${t('min')} · ` : ''}
        {s.category ? t.cat(s.category) : t('recipeGeneric')}
      </Body>
      <Body size={13} style={{ marginTop:space.s }}>
        {Suggestions.reasonFor(s, mode, t)}
      </Body>

      <View style={{ marginTop:space.m }}>
        <Price value={s.costTrusted ? tl(s.perPortion) : '—'} unit={t('perPerson')} />
        <Body dim size={12.5}>
          {s.costTrusted
            ? `${t('forN', s.servings)} · ${tl(s.total)} ₺ ${t('total').toLowerCase()} · ${t('approximateCost')}`
            : t('costUnavailable')}
        </Body>
      </View>

      <Row gap={6} style={{ flexWrap:'wrap', marginVertical:space.m }}>
        {s.costTrusted ? <Chip>{t('priceCoverage', coveragePercent)}</Chip> : null}
        {stateChip(heroState, t)}
        {mode === 'seasonal' && s.seasonalCount != null
          ? <Chip tone="accent">{t('inSeasonCount', s.seasonalCount)}</Chip>
          : null}
        {mode !== 'seasonal' && s.ready === true
          ? <Chip tone="accent">{t('readyToCook')}</Chip>
          : null}
        {mode !== 'seasonal' && s.ready === false
          ? <Chip>{t('missingCount', s.missingCount)}</Chip>
          : null}
        {mode !== 'seasonal' && s.matchPercent != null
          ? <Chip>{t('matchPercent', `%${Math.round(s.matchPercent)}`)}</Chip>
          : null}
      </Row>

      <Button onPress={() => onPress(s)}>{t('cook')}</Button>
    </Card>
  );
}
