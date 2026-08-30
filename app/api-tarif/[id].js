import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getRecipe } from '../../src/api';
import { useStore } from '../../src/store';
import { useTheme, space, radius } from '../../src/theme';


function IngredientRow({ item, checked, onToggle, c }) {
  const hasGluten =
    item.contains_gluten === 1 ||
    item.contains_gluten === true;

  const hasLactose =
    item.contains_lactose === 1 ||
    item.contains_lactose === true;

  return (
    <Pressable
      onPress={onToggle}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderBottomColor: c.line,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 7,
          borderWidth: 1.5,
          borderColor: checked ? c.accent : c.line,
          backgroundColor: checked ? c.accent : c.surface,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        {checked ? (
          <Text
            style={{
              color: c.onAccent,
              fontSize: 15,
              fontWeight: '800',
            }}
          >
            ✓
          </Text>
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            color: c.ink,
            fontSize: 15,
            lineHeight: 21,
            textDecorationLine: checked ? 'line-through' : 'none',
          }}
        >
          {item.display_text || item.original_text || item.name}
        </Text>

        {(hasGluten || hasLactose) ? (
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              marginTop: 5,
              gap: 6,
            }}
          >
            {hasGluten ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.surface,
                }}
              >
                <Text
                  style={{
                    color: c.ink2 || c.ink,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 0.4,
                  }}
                >
                  GLUTEN
                </Text>
              </View>
            ) : null}

            {hasLactose ? (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: c.line,
                  backgroundColor: c.surface,
                }}
              >
                <Text
                  style={{
                    color: c.ink2 || c.ink,
                    fontSize: 10,
                    fontWeight: '800',
                    letterSpacing: 0.4,
                  }}
                >
                  LAKTOZ
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}


export default function ApiTarif() {
  const c = useTheme();
  const { id } = useLocalSearchParams();
  const { state } = useStore();
  const kiler = state.kiler || {};

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [owned, setOwned] = useState({});


  useEffect(() => {
    loadRecipe();
  }, [id]);


  async function loadRecipe() {
    try {
      setLoading(true);
      setError(null);

      const data = await getRecipe(id);

      const initialOwned = {};

      (data.ingredients || []).forEach((ingredient, index) => {
        if (
          ingredient.kiler_id != null &&
          kiler[String(ingredient.kiler_id)]
        ) {
          initialOwned[index] = true;
        }
      });

      setRecipe(data);
      setOwned(initialOwned);
    } catch (e) {
      console.error(e);
      setError('Tarif yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }


  const ingredients = recipe?.ingredients || [];


  const ownedCount = useMemo(() => {
    return ingredients.reduce((sum, _, index) => {
      return sum + (owned[index] ? 1 : 0);
    }, 0);
  }, [owned, ingredients]);


  const missingCount = ingredients.length - ownedCount;


  const matchPercent = ingredients.length
    ? Math.round((ownedCount / ingredients.length) * 100)
    : 0;


  function toggleIngredient(index) {
    setOwned(prev => ({
      ...prev,
      [index]: !prev[index],
    }));
  }


  function markAll() {
    const all = {};

    ingredients.forEach((_, index) => {
      all[index] = true;
    });

    setOwned(all);
  }


  function clearAll() {
    setOwned({});
  }


  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: c.ground,
        }}
      >
        <ActivityIndicator size="large" color={c.accent} />
      </View>
    );
  }


  if (error || !recipe) {
    return (
      <View
        style={{
          flex: 1,
          padding: space.l,
          backgroundColor: c.ground,
        }}
      >
        <Text style={{ color: c.ink }}>
          {error || 'Tarif bulunamadı.'}
        </Text>
      </View>
    );
  }


  const minutes =
    recipe.total_minutes ||
    ((recipe.prep_minutes || 0) + (recipe.cook_minutes || 0));


  const steps = recipe.instructions
    ? String(recipe.instructions)
        .split(/\n+/)
        .map(x => x.trim())
        .filter(Boolean)
    : [];


  return (
    <ScrollView
      style={{ backgroundColor: c.ground }}
      contentContainerStyle={{
        padding: space.l,
        paddingBottom: space.xl * 2,
      }}
    >
      <Text
        style={{
          color: c.ink,
          fontSize: 28,
          lineHeight: 34,
          fontWeight: '800',
        }}
      >
        {recipe.title}
      </Text>

{(recipe.is_vegan === 1 ||
        recipe.is_vegan === true ||
        recipe.is_vegetarian === 1 ||
        recipe.is_vegetarian === true) ? (
        <View
          style={{
            flexDirection: 'row',
            marginTop: 10,
          }}
        >
          <View
            style={{
              borderWidth: 1,
              borderColor: recipe.is_vegan === 1 || recipe.is_vegan === true
                ? '#86EFAC'
                : '#FCD34D',
              backgroundColor: recipe.is_vegan === 1 || recipe.is_vegan === true
                ? '#DCFCE7'
                : '#FEF3C7',
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 5,
            }}
          >
            <Text
              style={{
                color: recipe.is_vegan === 1 || recipe.is_vegan === true
                  ? '#166534'
                  : '#92400E',
                fontSize: 11,
                fontWeight: '800',
                letterSpacing: 0.5,
              }}
            >
              {recipe.is_vegan === 1 || recipe.is_vegan === true
                ? 'VEGAN'
                : 'VEJETARYEN'}
            </Text>
          </View>
        </View>
      ) : null}

      <Text
        style={{
          color: c.ink3,
          fontSize: 14,
          marginTop: 8,
        }}
      >
        {recipe.category || 'Tarif'}
        {minutes ? ` · ${minutes} dk` : ''}
        {recipe.servings ? ` · ${recipe.servings} kişilik` : ''}
      </Text>


      {recipe.description ? (
        <Text
          style={{
            color: c.ink2,
            fontSize: 15,
            lineHeight: 22,
            marginTop: 18,
          }}
        >
          {recipe.description}
        </Text>
      ) : null}


      <View
        style={{
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: radius.m,
          padding: space.m,
          marginTop: 24,
        }}
      >
        <Text
          style={{
            color: c.ink,
            fontSize: 16,
            fontWeight: '700',
          }}
        >
          Evde olan malzemeler
        </Text>

        <Text
          style={{
            color: c.ink3,
            fontSize: 13,
            marginTop: 6,
          }}
        >
          {ownedCount}/{ingredients.length} sende var · %{matchPercent} eşleşme
        </Text>

        <Text
          style={{
            color: missingCount === 0 ? c.accent : c.ink2,
            fontSize: 13,
            marginTop: 3,
          }}
        >
          {missingCount === 0
            ? 'Tüm malzemeler hazır.'
            : `${missingCount} malzeme eksik`}
        </Text>

        <View
          style={{
            flexDirection: 'row',
            gap: 10,
            marginTop: 14,
          }}
        >
          <Pressable
            onPress={markAll}
            style={({ pressed }) => ({
              backgroundColor: c.accent,
              borderRadius: radius.s,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: c.onAccent,
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              Hepsi Var
            </Text>
          </Pressable>

          <Pressable
            onPress={clearAll}
            style={({ pressed }) => ({
              backgroundColor: c.surface,
              borderColor: c.line,
              borderWidth: 1,
              borderRadius: radius.s,
              paddingHorizontal: 12,
              paddingVertical: 8,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              style={{
                color: c.ink,
                fontWeight: '600',
                fontSize: 13,
              }}
            >
              Temizle
            </Text>
          </Pressable>
        </View>
      </View>


      <Text
        style={{
          color: c.ink,
          fontSize: 18,
          fontWeight: '700',
          marginTop: 30,
          marginBottom: 5,
        }}
      >
        Malzemeler
      </Text>


      {ingredients.map((ingredient, index) => (
        <IngredientRow
          key={`${index}-${ingredient.name}`}
          item={ingredient}
          checked={Boolean(owned[index])}
          onToggle={() => toggleIngredient(index)}
          c={c}
        />
      ))}


      <Text
        style={{
          color: c.ink,
          fontSize: 18,
          fontWeight: '700',
          marginTop: 34,
          marginBottom: 14,
        }}
      >
        Hazırlanışı
      </Text>


      {steps.length ? (
        steps.map((step, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: 16,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c.surface,
                borderColor: c.line,
                borderWidth: 1,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 10,
              }}
            >
              <Text
                style={{
                  color: c.accent,
                  fontWeight: '800',
                  fontSize: 13,
                }}
              >
                {index + 1}
              </Text>
            </View>

            <Text
              style={{
                flex: 1,
                color: c.ink,
                fontSize: 15,
                lineHeight: 23,
              }}
            >
              {step}
            </Text>
          </View>
        ))
      ) : (
        <Text style={{ color: c.ink3 }}>
          Hazırlanış bilgisi bulunamadı.
        </Text>
      )}
    </ScrollView>
  );
}
