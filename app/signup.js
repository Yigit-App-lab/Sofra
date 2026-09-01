import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebaseConfig';
import { friendlyAuthError } from '../src/auth';
import { useStore } from '../src/store';
import { useTheme, radius, space } from '../src/theme';
import { Button, Card, Title } from '../src/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignupScreen() {
  const c = useTheme();
  const router = useRouter();
  const { state } = useStore();
  const english = state.langIndex === 1;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const passwordsMatch = password === confirmPassword;
  const valid = EMAIL.test(email.trim()) && password.length >= 8 && passwordsMatch;

  async function signup() {
    setTouched(true);
    if (!valid) return;
    try {
      setBusy(true); setError('');
      await createUserWithEmailAndPassword(auth, email.trim(), password);
      router.replace('/(tabs)');
    } catch (nextError) { setError(friendlyAuthError(nextError, english)); }
    finally { setBusy(false); }
  }

  const inputStyle = { color:c.ink, backgroundColor:c.surface, borderColor:c.line,
    borderWidth:1, borderRadius:radius.m, paddingHorizontal:space.m, paddingVertical:12,
    fontSize:15, marginTop:space.s };

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:c.ground }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:space.l }}>
        <View style={{ marginBottom:space.l }}><Title size={30}>{english ? 'Create account' : 'Hesap oluştur'}</Title></View>
        <Card>
          <Text style={{ color:c.ink2, fontWeight:'600' }}>{english ? 'Email' : 'E-posta'}</Text>
          <TextInput value={email} onChangeText={setEmail} style={inputStyle} autoCapitalize="none"
            keyboardType="email-address" textContentType="emailAddress" accessibilityLabel={english ? 'Email address' : 'E-posta adresi'} />
          <Text style={{ color:c.ink2, fontWeight:'600', marginTop:space.m }}>{english ? 'Password' : 'Şifre'}</Text>
          <TextInput value={password} onChangeText={setPassword} onBlur={() => setTouched(true)} style={inputStyle} secureTextEntry
            textContentType="newPassword" accessibilityLabel={english ? 'Password, at least 8 characters' : 'Şifre, en az 8 karakter'} />
          <Text style={{ color:c.ink2, fontWeight:'600', marginTop:space.m }}>
            {english ? 'Confirm password' : 'Şifreyi tekrar yaz'}
          </Text>
          <TextInput value={confirmPassword} onChangeText={setConfirmPassword} onBlur={() => setTouched(true)} style={inputStyle} secureTextEntry
            textContentType="newPassword" accessibilityLabel={english ? 'Confirm password' : 'Şifreyi tekrar yaz'} />
          {touched && password.length < 8 ? (
            <Text style={{ color:c.pricey, fontSize:13, marginTop:space.s }}>
              {english ? 'Password must be at least 8 characters.' : 'Şifre en az 8 karakter olmalı.'}
            </Text>
          ) : null}
          {touched && password.length >= 8 && !passwordsMatch ? (
            <Text style={{ color:c.pricey, fontSize:13, marginTop:space.s }}>
              {english ? 'Passwords do not match.' : 'Şifreler aynı değil.'}
            </Text>
          ) : null}
          {error ? <Text style={{ color:c.pricey, fontSize:13, marginTop:space.m }}>{error}</Text> : null}
          <Button style={{ marginTop:space.l }} disabled={!valid || busy} loading={busy}
            accessibilityLabel={english ? 'Create account' : 'Hesap oluştur'} onPress={signup}>
            {english ? 'Create account' : 'Hesap oluştur'}
          </Button>
          <Button kind="ghost" style={{ marginTop:space.s }} onPress={() => router.back()}>
            {english ? 'Back to login' : 'Girişe dön'}
          </Button>
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
