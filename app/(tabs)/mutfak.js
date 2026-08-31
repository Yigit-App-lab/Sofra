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
import { getKilerIngredients, getTonightRecipes } from '../../src/api';
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


function RecipeCard({ recipe, onPress, english }) {
  const c = useTheme();

  let status = english ? 'A few missing' : 'Birkaç eksik';

  if (recipe.missing_count === 0) {
    status = english ? 'Ready' : 'Hazır';
  } else if (recipe.missing_count === 1) {
    status = english ? '1 missing' : '1 eksik';
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
        {recipe.category || (english ? 'Recipe' : 'Tarif')}
        {recipe.total_minutes != null
          ? `  ·  ${recipe.total_minutes} ${english ? 'min' : 'dk'}`
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
            %{Math.round(recipe.match_percent || 0)} {english ? 'match' : 'eşleşme'}
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
            ✓ {recipe.matched_count} {english ? 'on hand' : 'sende'}
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
          {english ? 'Main ingredients ready' : 'Ana malzemeler tamam'}
        </Text>
      ) : recipe.core_missing_count > 0 ? (
        <Text
          style={{
            color: c.ink3,
            fontSize: 12.5,
            marginTop: 9,
          }}
        >
          {recipe.core_missing_count} {english ? 'main ingredients missing' : 'ana malzeme eksik'}
        </Text>
      ) : null}
    </Pressable>
  );
}


export default function Kiler() {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const english = state.langIndex === 1;

  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionLimit, setSuggestionLimit] = useState(40);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [recipes, setRecipes] = useState([]);
  const [recipeLoading, setRecipeLoading] = useState(false);
  const [recipeError, setRecipeError] = useState(null);
  const [recipeLimit, setRecipeLimit] = useState(20);
  const [hasMoreRecipes, setHasMoreRecipes] = useState(false);

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
  }, [q, state.langIndex, suggestionLimit]);


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

        const data = await getTonightRecipes(kilerIds, {
          limit: recipeLimit,
          timeBudget: state.timeBudget,
          meatless: state.meatless,
          diet: state.dietPreference,
          glutenFree: state.glutenFree,
          lactoseFree: state.lactoseFree,
          lowGlycemic: state.lowGlycemic,
        });

        if (!cancelled) {
          setRecipes(data.recipes || []);
          setHasMoreRecipes(Boolean(data.has_more));
        }
      } catch (e) {
        console.error(e);

        if (!cancelled) {
          setRecipeError(english ? 'Recipe suggestions could not be loaded.' : 'Tarif önerileri yüklenemedi.');
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
  }, [kilerIds, recipeLimit, state.timeBudget, state.langIndex,
      state.meatless, state.dietPreference, state.glutenFree,
      state.lactoseFree, state.lowGlycemic]);

  useEffect(() => {
    setRecipeLimit(20);
  }, [kilerIds, state.timeBudget, state.meatless, state.dietPreference,
      state.glutenFree, state.lactoseFree, state.lowGlycemic]);


  async function loadIngredients(query) {
    try {
      setLoading(true);
      setError(null);

      const data = await getKilerIngredients(
        query,
        query.trim() ? 50 : suggestionLimit
      );

      setSuggestions(data.ingredients || []);
    } catch (e) {
      console.error(e);
      setError(english ? 'Ingredients could not be loaded.' : 'Malzemeler yüklenemedi.');
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

  const suggestionGroups = [
    { key:'vegetable', tr:'Sebzeler', en:'Vegetables' },
    { key:'protein', tr:'Et ve Proteinler', en:'Meat and Proteins' },
    { key:'grain', tr:'Hububat ve Bakliyat', en:'Grains and Pulses' },
    { key:'fruit', tr:'Meyveler', en:'Fruits' },
    { key:'other', tr:'Diğer', en:'Other' },
  ].map(group => ({
    ...group,
    items: suggestions.filter(item =>
      !kiler[String(item.id)] &&
      (item.ingredient_class || 'other') === group.key
    ),
  })).filter(group => group.items.length > 0);


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
        {english ? 'Pantry' : 'Kiler'}
      </Text>

      <Text
        style={{
          color: c.ink3,
          fontSize: 13,
          marginBottom: space.m,
        }}
      >
        {english ? 'Add ingredients you have at home' : 'Evde bulunan malzemeleri ekle'}
      </Text>

      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={english ? 'Search ingredients...' : 'Malzeme ara...'}
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
          {english ? 'In my pantry' : 'Kilerimde'}
        </Text>

        <Text style={{ color: c.ink3, fontSize: 13 }}>
          {mine.length} {english ? 'ingredients' : 'malzeme'}
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
            {english ? 'No ingredients added yet.' : 'Henüz malzeme eklenmedi.'}
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
        {q.trim()
          ? english ? 'Search results' : 'Arama Sonuçları'
          : english ? 'Frequently used' : 'Sık Kullanılanlar'}
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
        <View>
          {suggestionGroups.map(group => (
            <View key={group.key} style={{ marginBottom:16 }}>
              <Text style={{ color:c.ink3, fontSize:11, fontWeight:'700',
                letterSpacing:0.8, textTransform:'uppercase', marginBottom:7 }}>
                {english ? group.en : group.tr}
              </Text>
              <View style={{ flexDirection:'row', flexWrap:'wrap', gap:7 }}>
                {group.items.map(item => (
                  <Pill key={item.id} label={item.name} onPress={() => toggle(item)} />
                ))}
              </View>
            </View>
          ))}

          {!q.trim() && suggestions.length >= suggestionLimit && suggestionLimit < 200 ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setSuggestionLimit(limit => Math.min(limit + 40, 200))}
              style={({ pressed }) => ({ alignSelf:'flex-start', backgroundColor:c.surface,
                borderColor:c.line, borderWidth:1, borderRadius:radius.s,
                paddingHorizontal:14, paddingVertical:9, opacity:pressed ? 0.65 : 1 })}
            >
              <Text style={{ color:c.accent, fontSize:13.5, fontWeight:'700' }}>
                {english ? 'Show more ingredients' : 'Daha fazla malzeme göster'}
              </Text>
            </Pressable>
          ) : null}
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
          {english ? 'What can I make with my pantry?' : 'Kilerimle Ne Yapabilirim?'}
        </Text>

        <Text
          style={{
            color: c.ink3,
            fontSize: 13,
            marginTop: 4,
            marginBottom: 14,
          }}
        >
          {english ? 'Best recipes for what you have' : 'Elindeki malzemelere göre en uygun tarifler'}
        </Text>

        <View
          style={{
            alignSelf: 'flex-start',
            marginBottom: 14,
            borderRadius: 8,
            paddingHorizontal: 12,
            paddingVertical: 7,
            backgroundColor: c.surface,
            borderWidth: 1,
            borderColor: c.line,
          }}
        >
          <Text
            style={{
              color: c.ink2,
              fontSize: 12.5,
              fontWeight: '700',
            }}
          >
            {english ? `✓ Up to ${state.timeBudget} min` : `✓ En fazla ${state.timeBudget} dk`}
          </Text>
        </View>

        {!kilerIds.length ? (
          <Text style={{ color: c.ink3, fontSize: 13 }}>
            {english
              ? 'Add a few pantry ingredients to get recipe suggestions.'
              : "Tarif önermek için Kiler'e birkaç malzeme ekle."}
          </Text>
        ) : recipeLoading && recipes.length === 0 ? (
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
            {english ? 'No suitable recipes found.' : 'Uygun tarif bulunamadı.'}
          </Text>
        ) : (
          <>
            {recipes.map(recipe => (
              <RecipeCard
                key={recipe.id}
                recipe={recipe}
                english={english}
                onPress={() => router.push(`/api-tarif/${recipe.id}`)}
              />
            ))}
            {hasMoreRecipes ? (
              <Pressable
                disabled={recipeLoading}
                onPress={() => setRecipeLimit(limit => limit + 20)}
                style={({ pressed }) => ({
                  borderColor: c.line,
                  borderWidth: 1,
                  borderRadius: radius.m,
                  paddingVertical: 13,
                  alignItems: 'center',
                  marginTop: 4,
                  opacity: recipeLoading ? 0.55 : pressed ? 0.65 : 1,
                })}
              >
                {recipeLoading ? (
                  <ActivityIndicator size="small" color={c.accent} />
                ) : (
                  <Text style={{ color: c.accent, fontWeight: '700' }}>
                    {english ? 'Show 20 more' : '20 tarif daha göster'}
                  </Text>
                )}
              </Pressable>
            ) : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}
