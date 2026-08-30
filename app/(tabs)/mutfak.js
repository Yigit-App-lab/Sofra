import React, { useEffect, useMemo, useState } from 'react';
import {
  ScrollView,
  View,
  TextInput,
  Pressable,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';

import { useStore } from '../../src/store';
import { getKilerIngredients, getRecipesByKiler } from '../../src/api';
import { useTheme, space, radius } from '../../src/theme';


function Pill({ label, selected, onPress }) {
  const c = useTheme();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: selected ? c.accent : c.surface,
        borderColor: selected ? c.accent : c.line,
        borderWidth: 1,
        borderRadius: radius.s,
        paddingHorizontal: 11,
        paddingVertical: 8,
        opacity: pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={{
          color: selected ? c.onAccent : c.ink2,
          fontSize: 13.5,
          fontWeight: '500',
        }}
      >
        {selected ? `${label}  ×` : `+  ${label}`}
      </Text>
    </Pressable>
  );
}


function RecipeCard({ recipe, onPress }) {
  const c = useTheme();

  let status = 'Birkaç eksik';

  if (recipe.missing_count === 0) {
    status = 'Hazır';
  } else if (recipe.missing_count === 1) {
    status = '1 eksik';
  }

  const coreReady =
    recipe.core_count > 0 &&
    recipe.core_missing_count === 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: c.surface,
        borderColor: c.line,
        borderWidth: 1,
        borderRadius: radius.m,
        padding: space.m,
        marginBottom: 10,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text
        style={{
          color: c.ink,
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 5,
        }}
      >
        {recipe.title}
      </Text>

      <Text
        style={{
          color: c.ink3,
          fontSize: 12.5,
          marginBottom: 9,
        }}
      >
        {recipe.category || 'Tarif'}
        {recipe.total_minutes != null
          ? `  ·  ${recipe.total_minutes} dk`
          : ''}
      </Text>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <View
          style={{
            backgroundColor: c.ground,
            borderRadius: radius.s,
            paddingHorizontal: 8,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: c.ink2, fontSize: 12 }}>
            %{Math.round(recipe.match_percent || 0)} eşleşme
          </Text>
        </View>

        <View
          style={{
            backgroundColor: c.ground,
            borderRadius: radius.s,
            paddingHorizontal: 8,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: c.ink2, fontSize: 12 }}>
            ✓ {recipe.matched_count} sende
          </Text>
        </View>

        <View
          style={{
            backgroundColor: c.ground,
            borderRadius: radius.s,
            paddingHorizontal: 8,
            paddingVertical: 5,
          }}
        >
          <Text style={{ color: c.ink2, fontSize: 12 }}>
            {status}
          </Text>
        </View>
      </View>

      {coreReady ? (
        <Text
          style={{
            color: c.accent,
            fontSize: 12.5,
            fontWeight: '700',
            marginTop: 9,
          }}
        >
          Ana malzemeler tamam
        </Text>
      ) : recipe.core_missing_count > 0 ? (
        <Text
          style={{
            color: c.ink3,
            fontSize: 12.5,
            marginTop: 9,
          }}
        >
          {recipe.core_missing_count} ana malzeme eksik
        </Text>
      ) : null}
    </Pressable>
  );
}


export default function Kiler() {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();

  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [recipes, setRecipes] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState(null);

  const kiler = state.kiler || {};

  const mine = useMemo(() => {
    return Object.values(kiler).sort((a, b) =>
      a.name.localeCompare(b.name, 'tr')
    );
  }, [kiler]);

  const kilerIds = useMemo(
    () => mine.map(item => Number(item.id)),
    [mine]
  );


  useEffect(() => {
    const timer = setTimeout(() => {
      loadIngredients(q);
    }, q.trim() ? 250 : 0);

    return () => clearTimeout(timer);
  }, [q]);


  useEffect(() => {
    let cancelled = false;

    async function loadRecipes() {
      if (!kilerIds.length) {
        setRecipes([]);
        setRecipeError(null);
        return;
      }

      try {
        setRecipeLoading(true);
        setRecipeError(null);

        const data = await getRecipesByKiler(kilerIds, 20);

        if (!cancelled) {
          setRecipes(data.recipes || []);
        }
      } catch (e) {
        console.error(e);

        if (!cancelled) {
          setRecipeError('Tarif önerileri yüklenemedi.');
        }
      } finally {
        if (!cancelled) {
          setRecipeLoading(false);
        }
      }
    }

    loadRecipes();

    return () => {
      cancelled = true;
    };
  }, [kilerIds]);


  async function loadIngredients(query) {
    try {
      setLoading(true);
      setError(null);

      const data = await getKilerIngredients(
        query,
        query.trim() ? 50 : 40
      );

      setSuggestions(data.ingredients || []);
    } catch (e) {
      console.error(e);
      setError('Malzemeler yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }


  function toggle(item) {
    dispatch({
      type: 'toggleKiler',
      id: item.id,
      name: item.name,
    });
  }


  return (
    <ScrollView
      contentContainerStyle={{
        padding: space.l,
        paddingBottom: space.xl * 2,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Text
        style={{
          color: c.ink,
          fontSize: 27,
          fontWeight: '800',
          marginBottom: 4,
        }}
      >
        Kiler
      </Text>

      <Text
        style={{
          color: c.ink3,
          fontSize: 13,
          marginBottom: space.m,
        }}
      >
        Evde bulunan malzemeleri ekle
      </Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder="Malzeme ara..."
        placeholderTextColor={c.ink3}
        autoCorrect={false}
        style={{
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: radius.m,
          paddingHorizontal: space.m,
          paddingVertical: 11,
          color: c.ink,
          fontSize: 15,
        }}
      />

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginTop: 26,
          marginBottom: 10,
        }}
      >
        <Text
          style={{
            color: c.ink,
            fontSize: 17,
            fontWeight: '700',
          }}
        >
          Kilerimde
        </Text>

        <Text style={{ color: c.ink3, fontSize: 13 }}>
          {mine.length} malzeme
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 7,
        }}
      >
        {mine.length === 0 ? (
          <Text style={{ color: c.ink3, fontSize: 13 }}>
            Henüz malzeme eklenmedi.
          </Text>
        ) : (
          mine.map(item => (
            <Pill
              key={item.id}
              label={item.name}
              selected
              onPress={() => toggle(item)}
            />
          ))
        )}
      </View>

      <Text
        style={{
          color: c.ink,
          fontSize: 17,
          fontWeight: '700',
          marginTop: 30,
          marginBottom: 10,
        }}
      >
        {q.trim() ? 'Arama Sonuçları' : 'Sık Kullanılanlar'}
      </Text>

      {loading ? (
        <ActivityIndicator
          size="small"
          color={c.accent}
          style={{ marginVertical: 20 }}
        />
      ) : error ? (
        <Text style={{ color: c.ink }}>{error}</Text>
      ) : (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: 7,
          }}
        >
          {suggestions
            .filter(item => !kiler[String(item.id)])
            .map(item => (
              <Pill
                key={item.id}
                label={item.name}
                onPress={() => toggle(item)}
              />
            ))}
        </View>
      )}

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: c.line,
          marginTop: 34,
          paddingTop: 24,
        }}
      >
        <Text
          style={{
            color: c.ink,
            fontSize: 21,
            fontWeight: '800',
          }}
        >
          Kilerimle Ne Yapabilirim?
        </Text>

        <Text
          style={{
            color: c.ink3,
            fontSize: 13,
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          Elindeki malzemelere göre en uygun tarifler
        </Text>

        {!kilerIds.length ? (
          <Text style={{ color: c.ink3, fontSize: 13 }}>
            Tarif önermek için Kiler'e birkaç malzeme ekle.
          </Text>
        ) : recipeLoading ? (
          <ActivityIndicator
            size="small"
            color={c.accent}
            style={{ marginVertical: 20 }}
          />
        ) : recipeError ? (
          <Text style={{ color: c.ink }}>
            {recipeError}
          </Text>
        ) : recipes.length === 0 ? (
          <Text style={{ color: c.ink3, fontSize: 13 }}>
            Uygun tarif bulunamadı.
          </Text>
        ) : (
          recipes.map(recipe => (
            <RecipeCard
              key={recipe.id}
              recipe={recipe}
              onPress={() => router.push(`/api-tarif/${recipe.id}`)}
            />
          ))
        )}
      </View>
    </ScrollView>
  );
}
