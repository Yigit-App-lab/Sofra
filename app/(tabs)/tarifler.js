import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';

import {
  searchRecipes,
  getRecipes,
  getCategories,
} from '../../src/api';

import { useTheme, space, radius } from '../../src/theme';
import { useStore } from '../../src/store';

const PAGE_SIZE = 30;

export default function Tarifler() {
  const c = useTheme();
  const router = useRouter();
  const { state } = useStore();

  const [q, setQ] = useState('');
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadCategories();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!q.trim()) {
        setOffset(0);
        loadCatalogue(true, selectedCategory);
      }
    }, [
      state.dietPreference,
      state.glutenFree,
      state.lactoseFree,
      selectedCategory
    ])
  );

  useEffect(() => {
    if (!q.trim()) return;

    const timer = setTimeout(() => {
      runSearch(q.trim());
    }, 350);

    return () => clearTimeout(timer);
  }, [
    q,
    state.dietPreference,
    state.glutenFree,
    state.lactoseFree
  ]);

  async function loadCategories() {
    try {
      const data = await getCategories();
      setCategories((data.categories || []).slice(0, 20));
    } catch (e) {
      console.error(e);
    }
  }

  async function loadCatalogue(reset = false, category = selectedCategory) {
    try {
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      setError(null);

      const nextOffset = reset ? 0 : offset;

      const data = await getRecipes({
        limit: PAGE_SIZE,
        offset: nextOffset,
        category,
        diet: state.dietPreference,
        glutenFree: state.glutenFree,
        lactoseFree: state.lactoseFree,
      });

      setRecipes(prev =>
        reset ? data.recipes : [...prev, ...(data.recipes || [])]
      );

      setTotal(data.total || 0);
      setHasMore(Boolean(data.has_more));
      setOffset(nextOffset + (data.recipes?.length || 0));
    } catch (e) {
      console.error(e);
      setError('Tarifler yüklenemedi.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }

  async function runSearch(query) {
    try {
      setLoading(true);
      setError(null);

      const data = await searchRecipes(
        query,
        50,
        state.dietPreference,
        state.glutenFree,
        state.lactoseFree
      );

      setRecipes(data.recipes || []);
      setTotal(data.count || 0);
      setHasMore(false);
    } catch (e) {
      console.error(e);
      setError('Arama yapılamadı.');
    } finally {
      setLoading(false);
    }
  }

  function selectCategory(category) {
    setQ('');
    setSelectedCategory(category);
    setOffset(0);

    loadCatalogue(true, category);
  }

  function showAll() {
    setQ('');
    setSelectedCategory(null);
    setOffset(0);

    loadCatalogue(true, null);
  }

  function clearSearch() {
    setQ('');

    if (selectedCategory) {
      loadCatalogue(true, selectedCategory);
    } else {
      loadCatalogue(true, null);
    }
  }

  function loadMore() {
    if (
      loading ||
      loadingMore ||
      !hasMore ||
      q.trim()
    ) {
      return;
    }

    loadCatalogue(false, selectedCategory);
  }

  function renderRecipe({ item }) {
    const minutes =
      item.total_minutes ||
      ((item.prep_minutes || 0) + (item.cook_minutes || 0));

    return (
      <Pressable
        onPress={() => router.push(`/api-tarif/${item.id}`)}
        style={({ pressed }) => ({
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: radius.m,
          padding: space.m,
          marginBottom: 9,
          opacity: pressed ? 0.65 : 1,
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
          {item.title}
        </Text>

        <Text
          style={{
            color: c.ink3,
            fontSize: 13,
          }}
        >
          {item.category || 'Tarif'}
          {minutes ? ` · ${minutes} dk` : ''}
          {item.servings ? ` · ${item.servings} kişilik` : ''}
        </Text>
      </Pressable>
    );
  }

  const header = (
    <View>
      <Text
        style={{
          color: c.ink,
          fontSize: 26,
          fontWeight: '800',
          marginBottom: 4,
        }}
      >
        Tarifler
      </Text>

      <Text
        style={{
          color: c.ink3,
          fontSize: 13,
          marginBottom: space.m,
        }}
      >
        {total.toLocaleString('tr-TR')} tarif
      </Text>

      {state.dietPreference !== 'standard' ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginBottom: space.m,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor:
              state.dietPreference === 'vegan'
                ? '#16A34A'
                : '#FACC15',
            borderWidth: 1,
            borderColor:
              state.dietPreference === 'vegan'
                ? '#15803D'
                : '#CA8A04',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color:
                state.dietPreference === 'vegan'
                  ? '#FFFFFF'
                  : '#422006',
            }}
          >
            {state.dietPreference === 'vegan'
              ? '✓ Vegan filtresi aktif'
              : '✓ Vejetaryen filtresi aktif'}
          </Text>
        </View>
      ) : null}

      {state.glutenFree ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginBottom: space.s,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: '#60A5FA',
            borderWidth: 1,
            borderColor: '#2563EB',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: '#FFFFFF',
            }}
          >
            ✓ Glutensiz filtresi aktif
          </Text>
        </View>
      ) : null}

      {state.lactoseFree ? (
        <View
          style={{
            alignSelf: 'flex-start',
            marginBottom: space.m,
            borderRadius: 8,
            paddingHorizontal: 14,
            paddingVertical: 8,
            backgroundColor: '#C084FC',
            borderWidth: 1,
            borderColor: '#9333EA',
          }}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: '800',
              color: '#FFFFFF',
            }}
          >
            ✓ Laktozsuz filtresi aktif
          </Text>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginBottom: space.m,
        }}
      >
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Tarif ara..."
          placeholderTextColor={c.ink3}
          returnKeyType="search"
          autoCorrect={false}
          onSubmitEditing={() => {
            if (q.trim()) runSearch(q.trim());
          }}
          style={{
            flex: 1,
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

        {q ? (
          <Pressable
            onPress={clearSearch}
            style={{
              paddingLeft: 12,
              paddingVertical: 10,
            }}
          >
            <Text
              style={{
                color: c.accent,
                fontWeight: '600',
              }}
            >
              Temizle
            </Text>
          </Pressable>
        ) : null}
      </View>

      <Text
        style={{
          color: c.ink,
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 8,
        }}
      >
        Kategoriler
      </Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{
          gap: 8,
          paddingBottom: space.m,
        }}
      >
        <Pressable
          onPress={showAll}
          style={{
            backgroundColor:
              selectedCategory === null ? c.accent : c.surface,
            borderColor:
              selectedCategory === null ? c.accent : c.line,
            borderWidth: 1,
            borderRadius: radius.s,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <Text
            style={{
              color:
                selectedCategory === null ? c.onAccent : c.ink,
              fontWeight: '600',
            }}
          >
            Tümü
          </Text>
        </Pressable>

        {categories.map((item) => (
          <Pressable
            key={item.category}
            onPress={() => selectCategory(item.category)}
            style={{
              backgroundColor:
                selectedCategory === item.category
                  ? c.accent
                  : c.surface,
              borderColor:
                selectedCategory === item.category
                  ? c.accent
                  : c.line,
              borderWidth: 1,
              borderRadius: radius.s,
              paddingHorizontal: 12,
              paddingVertical: 8,
            }}
          >
            <Text
              style={{
                color:
                  selectedCategory === item.category
                    ? c.onAccent
                    : c.ink,
                fontWeight: '600',
              }}
            >
              {item.category}
            </Text>
          </Pressable>
        ))}
      </ScrollView>



      <Text
        style={{
          color: c.ink,
          fontSize: 16,
          fontWeight: '700',
          marginBottom: 10,
        }}
      >
        {selectedCategory || 'Tüm Tarifler'}
      </Text>
    </View>
  );

  if (loading && recipes.length === 0) {
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

  return (
    <FlatList
      style={{ backgroundColor: c.ground }}
      contentContainerStyle={{
        padding: space.l,
        paddingBottom: space.xl * 2,
      }}
      ListHeaderComponent={header}
      data={recipes}
      keyExtractor={(item) => String(item.id)}
      renderItem={renderRecipe}
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      ListFooterComponent={
        loadingMore ? (
          <ActivityIndicator
            size="small"
            color={c.accent}
            style={{ marginVertical: 20 }}
          />
        ) : null
      }
      ListEmptyComponent={
        error ? (
          <Text style={{ color: c.ink }}>{error}</Text>
        ) : (
          <Text style={{ color: c.ink3 }}>
            Tarif bulunamadı.
          </Text>
        )
      }
    />
  );
}
