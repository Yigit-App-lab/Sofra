import React, { useMemo } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
} from 'react-native';

import { useStore } from '../../src/store';
import { useTheme, space, radius } from '../../src/theme';
import { ScreenBackdrop } from '../../src/ui';

export default function Liste() {
  const c = useTheme();
  const { state, dispatch } = useStore();
  const english = state.langIndex === 1;

  const items = useMemo(
    () => Object.values(state.shoppingList || {}),
    [state.shoppingList]
  );

  const checkedCount = items.filter(x => x.checked).length;

  const qtyText = (item) => {
    if (item.quantity == null && !item.unit) return '';
    if (item.quantity == null) return String(item.unit || '');
    return `${item.quantity}${item.unit ? ` ${item.unit}` : ''}`;
  };

  return (
    <ScreenBackdrop source={require('../../assets/onboarding/market-sofra.png')}>
    <ScrollView
      style={{ backgroundColor:'transparent' }}
      contentContainerStyle={{
        padding: space.l,
        paddingBottom: space.xl * 2,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontSize: 28,
          fontWeight: '800',
          marginBottom: 6,
        }}
      >
        {english ? 'Shopping list' : 'Liste'}
      </Text>

      <Text
        style={{
          color: c.ink3,
          fontSize: 14,
          marginBottom: 22,
        }}
      >
        {items.length
          ? english
            ? `${items.length} items · ${checkedCount} completed`
            : `${items.length} malzeme · ${checkedCount} tamamlandı`
          : english
            ? 'Your shopping list is empty.'
            : 'Alışveriş listen henüz boş.'}
      </Text>

      {items.map((item) => (
        <View
          key={String(item.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: c.line,
            paddingVertical: 12,
          }}
        >
          <Pressable
            onPress={() =>
              dispatch({
                type: 'toggleShoppingItem',
                id: item.id,
              })
            }
            style={{
              width: 26,
              height: 26,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: item.checked ? c.accent : c.line,
              backgroundColor: item.checked ? c.accent : c.surface,
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12,
            }}
          >
            {item.checked ? (
              <Text
                style={{
                  color: c.onAccent,
                  fontWeight: '800',
                }}
              >
                ✓
              </Text>
            ) : null}
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text
              style={{
                color: c.ink,
                fontSize: 15,
                fontWeight: '600',
                textDecorationLine: item.checked ? 'line-through' : 'none',
              }}
            >
              {item.name}
            </Text>

            {qtyText(item) ? (
              <Text
                style={{
                  color: c.ink3,
                  fontSize: 13,
                  marginTop: 3,
                }}
              >
                {qtyText(item)}
              </Text>
            ) : null}
          </View>

          <Pressable
            onPress={() =>
              dispatch({
                type: 'removeShoppingItem',
                id: item.id,
              })
            }
            style={({ pressed }) => ({
              paddingHorizontal: 10,
              paddingVertical: 7,
              opacity: pressed ? 0.5 : 1,
            })}
          >
            <Text
              style={{
                color: c.ink3,
                fontSize: 18,
                fontWeight: '700',
              }}
            >
              ×
            </Text>
          </Pressable>
        </View>
      ))}

      {items.length ? (
        <Pressable
          onPress={() => dispatch({ type: 'clearShoppingList' })}
          style={({ pressed }) => ({
            marginTop: 24,
            borderWidth: 1,
            borderColor: c.line,
            borderRadius: radius.s,
            paddingVertical: 11,
            alignItems: 'center',
            opacity: pressed ? 0.65 : 1,
          })}
        >
          <Text
            style={{
              color: c.ink,
              fontSize: 14,
              fontWeight: '700',
            }}
          >
            {english ? 'Clear list' : 'Listeyi temizle'}
          </Text>
        </Pressable>
      ) : null}
    </ScrollView>
    </ScreenBackdrop>
  );
}
