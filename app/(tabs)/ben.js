// "Ben" — what the app has learned, plus every setting. Showing people the model
// is what makes personalisation feel like a service rather than surveillance, and
// it is also the best debugging tool you will have.
import React, { useMemo, useState } from 'react';
import { Linking, ScrollView, View, Text, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebaseConfig';
import Engine from '../../src/engine';
import { REC, recById } from '../../src/data';
import { useStore, useEngineCtx, today } from '../../src/store';
import { useAuth } from '../../src/auth';
import { makeT, tl, LANGS, cleanRecipeTitle } from '../../src/i18n';
import { useTheme, space } from '../../src/theme';
import { Label, Body, Button, Card, LineItem, Choice, Chip, Divider } from '../../src/ui';

function Stat({ label, value }) {
  const c = useTheme();
  return (
    <View>
      <View style={{ flexDirection:'row', justifyContent:'space-between',
                     alignItems:'baseline', paddingVertical:9 }}>
        <Text style={{ color:c.ink, fontSize:15 }}>{label}</Text>
        <Text style={{ color:c.ink2, fontSize:15, fontWeight:'700' }}>{value}</Text>
      </View>
      <Divider />
    </View>
  );
}

function Weights({ title, bucket, limit, labelOf }) {
  const c = useTheme();
  const keys = Object.keys(bucket).sort((a, b) => bucket[b].w - bucket[a].w).slice(0, limit);
  if (!keys.length) return null;
  return (
    <>
      <Label>{title}</Label>
      <View style={{ gap:space.s }}>
        {keys.map((k) => (
          <View key={k}>
            <View style={{ flexDirection:'row', justifyContent:'space-between', marginBottom:4 }}>
              <Text style={{ color:c.ink, fontSize:13.5 }}>{labelOf(k)}</Text>
              <Text style={{ color:c.ink3, fontSize:12, fontVariant:['tabular-nums'] }}>
                {bucket[k].w.toFixed(2)}
              </Text>
            </View>
            <View style={{ height:6, borderRadius:3, backgroundColor:c.surface2 }}>
              <View style={{ height:6, borderRadius:3, backgroundColor:c.accent,
                             width:`${Math.round(bucket[k].w*100)}%` }} />
            </View>
          </View>
        ))}
      </View>
    </>
  );
}

export default function Ben() {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const { user } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [signOutError, setSignOutError] = useState('');
  const t = makeT(state.langIndex);
  const ctx = useEngineCtx();
  const p = state.profile;
  const set = (key, value) => dispatch({ type:'set', key, value });

  const cooked = Object.keys(p.cooked);
  const likedCount = Object.keys(p.liked || {}).length;
  const profileRecipeTitle = (id) => recById[id]
    ? t.title(recById[id])
    : cleanRecipeTitle(p.apiRecipes?.[id]?.title || id);
  const fav = useMemo(() => {
    let best = null, bw = 0;
    Object.keys(p.cuisines).forEach((k) => { if (p.cuisines[k].w > bw) { bw = p.cuisines[k].w; best = k; } });
    return best ? `${t.cat(best)} · ${bw.toFixed(2)}` : '—';
  }, [p.cuisines, t.code]);
  const avg = useMemo(() => {
    const all = Engine.recommend(REC, ctx);
    return all.length ? all.reduce((s, x) => s + x.cost.perPortion, 0) / all.length : 0;
  }, [ctx]);

  async function performSignOut() {
    try {
      setSigningOut(true);
      setSignOutError('');
      await signOut(auth);
    } catch (error) {
      setSigningOut(false);
      setSignOutError(t.code === 'en' ? 'Could not log out. Please try again.' : 'Çıkış yapılamadı. Lütfen tekrar deneyin.');
    }
  }

  function leaveGuestMode() {
    dispatch({ type:'set', key:'guestMode', value:false });
    router.replace('/login');
  }

  return (
    <ScrollView contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
      <Card style={{ marginBottom:space.m }}>
        <Body size={13}>{user?.email || (t.code === 'en' ? 'Guest access' : 'Misafir erişimi')}</Body>
        <View style={{ height:4 }} />
        <Body dim size={12}>
          {state.syncStatus === 'error'
            ? (t.code === 'en' ? 'Saved on this phone · cloud sync unavailable' : 'Bu telefona kaydedildi · bulut eşitleme kullanılamıyor')
            : !user
              ? (t.code === 'en' ? 'Your data is saved only on this phone' : 'Verilerin yalnızca bu telefonda saklanıyor')
              : state.syncStatus === 'syncing' || state.syncStatus === 'loading'
              ? (t.code === 'en' ? 'Syncing your profile…' : 'Profilin eşitleniyor…')
              : (t.code === 'en' ? 'Profile synced across your devices' : 'Profilin cihazların arasında eşitlendi')}
        </Body>
        {user?.providerData?.some((provider) => provider.providerId === 'password') && !user.emailVerified ? (
          <Text style={{ color:c.pricey, fontSize:12.5, marginTop:space.s }}>
            {t.code === 'en' ? 'Your email address is not verified.' : 'E-posta adresin henüz doğrulanmadı.'}
          </Text>
        ) : null}
        {user ? <Pressable onPress={() => router.push('/account')} style={{ marginTop:space.m }}
          accessibilityRole="button" accessibilityLabel={t.code === 'en' ? 'Account and security' : 'Hesap ve güvenlik'}>
          <Text style={{ color:c.accent, fontSize:13.5, fontWeight:'700' }}>
            {t.code === 'en' ? 'Account & security' : 'Hesap ve güvenlik'}
          </Text>
        </Pressable> : <Pressable onPress={() => { dispatch({ type:'set', key:'guestMode', value:false }); router.replace('/login'); }}
          style={{ marginTop:space.m }} accessibilityRole="button">
          <Text style={{ color:c.accent, fontSize:13.5, fontWeight:'700' }}>
            {t.code === 'en' ? 'Sign in to sync your data' : 'Verilerini eşitlemek için giriş yap'}
          </Text>
        </Pressable>}
      </Card>
      <Card>
        <Stat label={t('cookedN')} value={cooked.length} />
        <Stat label={t('signalsN')} value={likedCount} />
        <Stat label={t('pantryN')}
              value={Object.keys(state.kiler || {}).length} />
        <Stat label={t('favCat')} value={fav} />
        <Stat label={t('avgCost')} value={`${tl(avg)} ₺`} />
      </Card>

      {likedCount === 0 && (
        <View style={{ marginTop:space.l }}><Body dim size={13.5}>{t('nothingYet')}</Body></View>
      )}

      {cooked.length > 0 && (
        <>
          <Label>{t('history')}</Label>
          {cooked.sort((a, b) => p.cooked[b] - p.cooked[a]).slice(0, 10).map((id) => (
            <LineItem key={id} name={profileRecipeTitle(id)}
              chips={<Chip>{today() - p.cooked[id]}{t.code === 'en' ? 'd' : ' gün'}</Chip>} />
          ))}
        </>
      )}

      <View style={{ height:space.l }} />
      <Button kind="ghost" onPress={() => router.push('/begendiklerim')}>
        {t('likedRecipes')} · {likedCount}
      </Button>

      <View style={{ height:space.s }} />
      <Button kind="ghost" onPress={() => set('onboardingComplete', false)}>
        {t.code === 'en' ? 'What can Sofra do?' : 'Sofra ile neler yapabilirim?'}
      </Button>

      <Label>{t('settings')}</Label>
      <Body dim size={12}>{t('timeBudget')} · {state.timeBudget} {t('min')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={[20,30,45,60,90].map((m) => ({ value:m, label:`${m}` }))}
              value={state.timeBudget} onChange={(v) => set('timeBudget', v)} />

      <Card style={{ marginTop:space.l }}>
        <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
          <View style={{ flex:1, paddingRight:space.m }}>
            <Body size={15}>{t.code === 'en' ? 'Daily dinner reminder' : 'Günlük yemek hatırlatması'}</Body>
            <Body dim size={12} style={{ marginTop:3 }}>
              {t.code === 'en'
                ? 'Your recommendations and shopping list, at the right time.'
                : 'Önerilerin ve alışveriş listen, doğru zamanda yanında.'}
            </Body>
          </View>
          <Choice
            options={[
              { value:false, label:t.code === 'en' ? 'Off' : 'Kapalı' },
              { value:true, label:t.code === 'en' ? 'On' : 'Açık' },
            ]}
            value={Boolean(state.dailyReminder)}
            onChange={(v) => set('dailyReminder', v)}
          />
        </View>
        {state.dailyReminder ? (
          <View style={{ marginTop:space.m }}>
            <Body dim size={12}>{t.code === 'en' ? 'Reminder time' : 'Hatırlatma saati'}</Body>
            <View style={{ height:space.s }} />
            <Choice options={[11,17,19].map((hour) => ({ value:hour, label:`${String(hour).padStart(2, '0')}:00` }))}
              value={state.reminderHour || 17} onChange={(value) => set('reminderHour', value)} />
          </View>
        ) : null}
        {['denied', 'blocked'].includes(state.reminderStatus) ? (
          <View style={{ marginTop:space.m }}>
            <Text style={{ color:c.pricey, fontSize:12.5 }}>
              {t.code === 'en' ? 'Notifications are disabled in device settings.' : 'Bildirim izni cihaz ayarlarında kapalı.'}
            </Text>
            <Pressable onPress={() => Linking.openSettings()} style={{ marginTop:space.s }}>
              <Text style={{ color:c.accent, fontSize:13, fontWeight:'700' }}>
                {t.code === 'en' ? 'Open settings' : 'Ayarları aç'}
              </Text>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('budget')} · {state.maxPerPortion} ₺</Body>
      <View style={{ height:space.s }} />
      <Choice options={[15,25,40,60,120].map((m) => ({ value:m, label:`${m} ₺` }))}
              value={state.maxPerPortion} onChange={(v) => set('maxPerPortion', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('meatless')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={[{ value:false, label:t.code === 'en' ? 'Off' : 'Kapalı' },
                        { value:true, label:t.code === 'en' ? 'On' : 'Açık' }]}
              value={state.meatless} onChange={(v) => set('meatless', v)} />

      <View style={{ height:space.l }} />
      <Body dim size={12}>
        {t.code === 'en' ? 'Diet preference' : 'Beslenme tercihi'}
      </Body>
      <View style={{ height:space.s }} />
      <Choice
        options={[
          {
            value:'standard',
            label:t.code === 'en' ? 'Standard' : 'Standart'
          },
          {
            value:'vegetarian',
            label:t.code === 'en' ? 'Vegetarian' : 'Vejetaryen'
          },
          {
            value:'vegan',
            label:'Vegan'
          },
        ]}
        value={state.dietPreference || 'standard'}
        onChange={(v) => set('dietPreference', v)}
      />

      <View style={{ height:space.m }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Gluten' : 'Gluten'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Gluten-free' : 'Glutensiz'
          },
        ]}
        value={Boolean(state.glutenFree)}
        onChange={(v) => set('glutenFree', v)}
      />

      <View style={{ height:space.s }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Lactose' : 'Laktoz'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Lactose-free' : 'Laktozsuz'
          },
        ]}
        value={Boolean(state.lactoseFree)}
        onChange={(v) => set('lactoseFree', v)}
      />

      <View style={{ height:space.s }} />

      <Choice
        options={[
          {
            value:false,
            label:t.code === 'en' ? 'Glycemic' : 'Glisemik'
          },
          {
            value:true,
            label:t.code === 'en' ? 'Low glycemic' : 'Düşük Glisemik'
          },
        ]}
        value={Boolean(state.lowGlycemic)}
        onChange={(v) => set('lowGlycemic', v)}
      />

      <View style={{ height:space.l }} />
      <Body dim size={12}>{t('language')}</Body>
      <View style={{ height:space.s }} />
      <Choice options={LANGS.map((l, i) => ({ value:i, label:l.label }))}
              value={state.langIndex} onChange={(v) => set('langIndex', v)} />

      <View style={{ height:space.xl }} />
      <Pressable onPress={() => dispatch({ type:'resetProfile' })}>
        <Text style={{ color:c.ink3, fontSize:13, textDecorationLine:'underline' }}>
          {t('resetProfile')}
        </Text>
      </Pressable>

      <View style={{ height:space.xl }} />
      <Button kind="ghost" disabled={signingOut} loading={signingOut}
        accessibilityLabel={t.code === 'en' ? 'Log out' : 'Çıkış yap'}
        onPress={() => user ? (setSignOutError(''), setShowSignOutConfirm(true)) : leaveGuestMode()}>
        {user ? (t.code === 'en' ? 'Log Out' : 'Çıkış Yap') : (t.code === 'en' ? 'Return to sign in' : 'Giriş ekranına dön')}
      </Button>
      {user && showSignOutConfirm ? (
        <Card style={{ marginTop:space.m }}>
          <Body>{t.code === 'en' ? 'Log out?' : 'Çıkış yapılsın mı?'}</Body>
          <Body dim size={13} style={{ marginTop:space.xs }}>
            {t.code === 'en'
              ? 'Your synced profile will be available when you log in again.'
              : 'Eşitlenen profilin tekrar giriş yaptığında hazır olacak.'}
          </Body>
          {signOutError ? <Text style={{ color:c.pricey, fontSize:13, marginTop:space.s }}>{signOutError}</Text> : null}
          <View style={{ flexDirection:'row', gap:space.s, marginTop:space.m }}>
            <Button kind="ghost" style={{ flex:1 }} disabled={signingOut}
              onPress={() => setShowSignOutConfirm(false)}>
              {t.code === 'en' ? 'Cancel' : 'Vazgeç'}
            </Button>
            <Button style={{ flex:1 }} disabled={signingOut} loading={signingOut}
              onPress={performSignOut}>
              {t.code === 'en' ? 'Log Out' : 'Çıkış Yap'}
            </Button>
          </View>
        </Card>
      ) : null}
    </ScrollView>
  );
}
