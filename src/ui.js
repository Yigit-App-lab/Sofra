// The shared components. Keeping them here is what lets each screen stay short
// enough to read in one sitting.
import React from 'react';
import { ActivityIndicator, Text, View, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useTheme, radius, space } from './theme';

export function Title({ children, size = 21 }) {
  const c = useTheme();
  return <Text style={{ color:c.ink, fontSize:size, fontWeight:'700', letterSpacing:-0.3 }}>{children}</Text>;
}

export function Body({ children, dim, size = 15, style }) {
  const c = useTheme();
  return <Text style={[{ color: dim ? c.ink2 : c.ink, fontSize:size, lineHeight:size*1.45 }, style]}>{children}</Text>;
}

export function Label({ children, top = space.l }) {
  const c = useTheme();
  return (
    <Text style={{ color:c.ink3, fontSize:11, letterSpacing:1.1, textTransform:'uppercase',
                   marginBottom:space.s, marginTop:top, fontWeight:'600' }}>{children}</Text>
  );
}

export function Card({ children, style }) {
  const c = useTheme();
  return (
    <View style={[{ backgroundColor:c.surface, borderColor:c.line, borderWidth:1,
                    borderRadius:radius.l, padding:space.l }, style]}>{children}</View>
  );
}

/** The number the whole product exists to show. */
export function Price({ value, unit, size = 38 }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection:'row', alignItems:'baseline', gap:6 }}>
      <Text style={{ color:c.accent, fontSize:size, fontWeight:'700', letterSpacing:-1,
                     fontVariant:['tabular-nums'] }}>{value}</Text>
      <Text style={{ color:c.accent, fontSize:size*0.5, fontWeight:'600' }}>₺</Text>
      {unit ? <Text style={{ color:c.ink3, fontSize:12.5, fontWeight:'600' }}>{unit}</Text> : null}
    </View>
  );
}

/** tone: cheap | pricey | accent | plain */
export function Chip({ children, tone = 'plain' }) {
  const c = useTheme();
  const map = { cheap:[c.cheapBg,c.cheap], pricey:[c.priceyBg,c.pricey],
                accent:[c.accentSoft,c.accent], plain:[c.surface2,c.ink2] };
  const [bg, fg] = map[tone] || map.plain;
  return (
    <View style={{ backgroundColor:bg, borderRadius:6, paddingHorizontal:8, paddingVertical:3 }}>
      <Text style={{ color:fg, fontSize:12, fontWeight:'600' }}>{children}</Text>
    </View>
  );
}

export function Button({ children, onPress, kind = 'primary', style, disabled = false,
  loading = false, accessibilityLabel }) {
  const c = useTheme();
  const p = kind === 'primary';
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [{ backgroundColor: p ? c.accent : c.surface2,
        borderRadius:radius.m, paddingVertical:13, paddingHorizontal:16,
        alignItems:'center', opacity: disabled ? 0.55 : pressed ? 0.8 : 1 }, style]}>
      {loading
        ? <ActivityIndicator color={p ? c.onAccent : c.ink2} />
        : <Text style={{ color: p ? c.onAccent : c.ink2, fontSize:15, fontWeight:'700' }}>{children}</Text>}
    </Pressable>
  );
}

export function Row({ children, gap = space.s, style }) {
  return <View style={[{ flexDirection:'row', alignItems:'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const c = useTheme();
  return <View style={{ height:StyleSheet.hairlineWidth, backgroundColor:c.line }} />;
}

/** name · chips · value, the row shape used by four of the five screens. */
export function LineItem({ name, sub, chips, value, onPress }) {
  const c = useTheme();
  const inner = (
    <>
      <Row style={{ paddingVertical:9, alignItems:'center' }} gap={space.s}>
        <View style={{ flex:1 }}>
          <Text style={{ color:c.ink, fontSize:15 }}>{name}</Text>
          {sub ? <Text style={{ color:c.ink3, fontSize:11.5, marginTop:1 }}>{sub}</Text> : null}
        </View>
        {chips}
        {value != null ? (
          <Text style={{ color:c.ink2, fontSize:14, fontWeight:'600',
                         fontVariant:['tabular-nums'] }}>{value}</Text>
        ) : null}
      </Row>
      <Divider />
    </>
  );
  return onPress
    ? <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}>{inner}</Pressable>
    : <View>{inner}</View>;
}

/** A horizontal row of choices. Used for every setting — no picker modals. */
export function Choice({ options, value, onChange, scroll }) {
  const c = useTheme();
  const items = options.map((o) => {
    const on = o.value === value;
    return (
      <Pressable key={String(o.value)} onPress={() => onChange(o.value)}
        accessibilityRole="button" accessibilityState={{ selected:on }}
        style={{ backgroundColor: on ? c.accent : c.surface, borderColor: on ? c.accent : c.line,
                 borderWidth:1, borderRadius:radius.s, paddingHorizontal:12, paddingVertical:7 }}>
        <Text style={{ color: on ? c.onAccent : c.ink2, fontSize:13.5, fontWeight:'600' }}>{o.label}</Text>
      </Pressable>
    );
  });
  if (scroll) {
    return (
      <ScrollView horizontal showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap:6, paddingRight:space.l }}>{items}</ScrollView>
    );
  }
  return <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6 }}>{items}</View>;
}

/** Seasonality state -> chip. Only the states worth flagging get colour. */
export function stateChip(st, t) {
  if (!st) return null;
  const tone = { peak:'cheap', stored:'cheap', winter:'pricey', off:'pricey' }[st.key] || 'plain';
  return <Chip tone={tone}>{t(st.key)}</Chip>;
}
