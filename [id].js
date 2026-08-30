import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';

import { getRecipe } from '../../src/api';
import { useTheme, space, radius } from '../../src/theme';


export default function Tarif() {
  const c = useTheme();
  const { id } = useLocalSearchParams();

  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const data = await getRecipe(id);

        if (!cancelled) {
          setRecipe(data);
        }
      } catch (e) {
        console.error(e);

        if (!cancelled) {
          setError('Tarif yüklenemedi.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (id) {
      load();
    }

    return () => {
      cancelled = true;
    };
  }, [id]);


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


  const instructions = (recipe.instructions || '')
    .split('\n')
    .map(x => x.trim())
    .filter(Boolean);


  return (
    <ScrollView
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


      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 7,
          marginTop: 12,
        }}
      >
        {recipe.category ? (
          <InfoChip text={recipe.category} />
        ) : null}

        {recipe.prep_minutes != null ? (
          <InfoChip text={`Hazırlık ${recipe.prep_minutes} dk`} />
        ) : null}

        {recipe.cook_minutes != null ? (
          <InfoChip text={`Pişirme ${recipe.cook_minutes} dk`} />
        ) : null}

        {recipe.total_minutes != null ? (
          <InfoChip text={`Toplam ${recipe.total_minutes} dk`} />
        ) : null}

        {recipe.servings ? (
          <InfoChip text={`${recipe.servings} porsiyon`} />
        ) : null}
      </View>


      {recipe.description ? (
        <Text
          style={{
            color: c.ink2,
            fontSize: 14,
            lineHeight: 21,
            marginTop: 18,
          }}
        >
          {recipe.description}
        </Text>
      ) : null}


      <SectionTitle>Malzemeler</SectionTitle>

      {(recipe.ingredients || []).map((item, index) => (
        <View
          key={`${item.name}-${index}`}
          style={{
            borderBottomWidth: 1,
            borderBottomColor: c.line,
            paddingVertical: 11,
          }}
        >
          <Text
            style={{
              color: c.ink,
              fontSize: 15,
              lineHeight: 21,
            }}
          >
            {item.display_text || item.original_text || item.name}
          </Text>
        </View>
      ))}


      <SectionTitle>Hazırlanışı</SectionTitle>

      {instructions.length ? (
        instructions.map((step, index) => (
          <View
            key={index}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              marginBottom: 14,
            }}
          >
            <View
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: c.accent,
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 11,
              }}
            >
              <Text
                style={{
                  color: c.onAccent,
                  fontSize: 12,
                  fontWeight: '700',
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
                lineHeight: 22,
                paddingTop: 2,
              }}
            >
              {step}
            </Text>
          </View>
        ))
      ) : (
        <Text style={{ color: c.ink3 }}>
          Hazırlanış bilgisi bulunmuyor.
        </Text>
      )}
    </ScrollView>
  );


  function InfoChip({ text }) {
    return (
      <View
        style={{
          backgroundColor: c.surface,
          borderColor: c.line,
          borderWidth: 1,
          borderRadius: radius.s,
          paddingHorizontal: 9,
          paddingVertical: 6,
        }}
      >
        <Text
          style={{
            color: c.ink2,
            fontSize: 12.5,
          }}
        >
          {text}
        </Text>
      </View>
    );
  }


  function SectionTitle({ children }) {
    return (
      <Text
        style={{
          color: c.ink,
          fontSize: 18,
          fontWeight: '800',
          marginTop: 30,
          marginBottom: 8,
        }}
      >
        {children}
      </Text>
    );
  }
}
