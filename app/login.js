import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable,
  ScrollView, Text, TextInput, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider, OAuthProvider, sendPasswordResetEmail,
  signInWithCredential, signInWithEmailAndPassword,
} from 'firebase/auth';
import { auth, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../firebaseConfig';
import { friendlyAuthError } from '../src/auth';
import { useStore } from '../src/store';
import { useTheme, radius, space } from '../src/theme';
import { Button, Card, Divider, Title } from '../src/ui';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const GoogleNativeButton = React.lazy(async () => {
  const module = await import('@react-native-google-signin/google-signin');
  return {
    default: function BrandedGoogleButton({ onPress, disabled }) {
      return <module.GoogleSigninButton size={module.GoogleSigninButton.Size.Wide}
        color={module.GoogleSigninButton.Color.Light} onPress={onPress} disabled={disabled} />;
    },
  };
});

function Field({ label, error, secure, visible, onToggle, ...props }) {
  const c = useTheme();
  return (
    <View style={{ marginBottom:space.m }}>
      <Text style={{ color:c.ink2, fontSize:12.5, fontWeight:'600', marginBottom:6 }}>{label}</Text>
      <View style={{ flexDirection:'row', alignItems:'center', backgroundColor:c.surface,
        borderColor:error ? c.pricey : c.line, borderWidth:1, borderRadius:radius.m }}>
        <TextInput {...props} secureTextEntry={secure && !visible}
          placeholderTextColor={c.ink3}
          style={{ flex:1, color:c.ink, fontSize:15, paddingHorizontal:space.m, paddingVertical:12 }} />
        {secure ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Şifreyi gizle' : 'Şifreyi göster'}
          onPress={onToggle} style={{ padding:12 }}>
          <Ionicons name={visible ? 'eye-off-outline' : 'eye-outline'} size={21} color={c.ink2} />
        </Pressable> : null}
      </View>
      {error ? <Text style={{ color:c.pricey, fontSize:12, marginTop:5 }}>{error}</Text> : null}
    </View>
  );
}

export default function LoginScreen() {
  const c = useTheme();
  const router = useRouter();
  const { state, dispatch } = useStore();
  const english = state.langIndex === 1;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [visible, setVisible] = useState(false);
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = Constants.appOwnership !== 'expo';

  useEffect(() => {
    AppleAuthentication.isAvailableAsync().then(setAppleAvailable).catch(() => setAppleAvailable(false));
  }, []);

  const emailError = emailTouched && !EMAIL.test(email.trim())
    ? (english ? 'Enter a valid email address.' : 'Geçerli bir e-posta girin.') : '';
  const passwordError = passwordTouched && password.length < 8
    ? (english ? 'Use at least 8 characters.' : 'En az 8 karakter kullanın.') : '';
  const valid = EMAIL.test(email.trim()) && password.length >= 8;

  async function run(action) {
    try { setBusy(true); setMessage(''); await action(); router.replace('/(tabs)'); }
    catch (error) {
      if (error?.code !== 'ERR_REQUEST_CANCELED' && error?.code !== '1001') setMessage(friendlyAuthError(error, english));
    } finally { setBusy(false); }
  }

  function submit() {
    setEmailTouched(true); setPasswordTouched(true);
    if (!valid) return;
    run(() => signInWithEmailAndPassword(auth, email.trim(), password));
  }

  function continueAsGuest() {
    dispatch({ type:'set', key:'guestMode', value:true });
    router.replace('/(tabs)');
  }

  async function resetPassword() {
    setEmailTouched(true);
    if (!EMAIL.test(email.trim())) return;
    try {
      setBusy(true); setMessage('');
      await sendPasswordResetEmail(auth, email.trim());
      setMessage(english ? 'Password reset email sent.' : 'Şifre yenileme e-postası gönderildi.');
    } catch (error) { setMessage(friendlyAuthError(error, english)); }
    finally { setBusy(false); }
  }

  function googleLogin() {
    run(async () => {
      const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
      GoogleSignin.configure({
        webClientId: GOOGLE_WEB_CLIENT_ID,
        iosClientId: GOOGLE_IOS_CLIENT_ID,
      });
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog:true });
      const response = await GoogleSignin.signIn();
      const idToken = response?.data?.idToken || response?.idToken;
      if (!idToken) throw new Error('Google did not return an ID token');
      await signInWithCredential(auth, GoogleAuthProvider.credential(idToken));
    });
  }

  function appleLogin() {
    run(async () => {
      const bytes = await Crypto.getRandomBytesAsync(32);
      const rawNonce = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
      const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const result = await AppleAuthentication.signInAsync({
        requestedScopes:[AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
        nonce,
      });
      const credential = new OAuthProvider('apple.com').credential({ idToken:result.identityToken, rawNonce });
      await signInWithCredential(auth, credential);
    });
  }

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:c.ground }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow:1, justifyContent:'center', padding:space.l }}>
        <View style={{ marginBottom:space.l }}><Title size={32}>Sofra</Title>
          <Text style={{ color:c.ink2, fontSize:15, marginTop:5 }}>{english ? 'Welcome back' : 'Tekrar hoş geldin'}</Text></View>
        <Card>
          <Field label={english ? 'Email' : 'E-posta'} value={email} onChangeText={setEmail}
            onBlur={() => setEmailTouched(true)}
            error={emailError} autoCapitalize="none" autoCorrect={false} keyboardType="email-address"
            textContentType="emailAddress" accessibilityLabel={english ? 'Email address' : 'E-posta adresi'} />
          <Field label={english ? 'Password' : 'Şifre'} value={password} onChangeText={setPassword}
            onBlur={() => setPasswordTouched(true)}
            error={passwordError} secure visible={visible} onToggle={() => setVisible(v => !v)}
            textContentType="password" accessibilityLabel={english ? 'Password' : 'Şifre'} />
          <Pressable accessibilityRole="button" accessibilityLabel={english ? 'Forgot password' : 'Şifremi unuttum'}
            onPress={resetPassword} style={{ alignSelf:'flex-end', marginBottom:space.m }}>
            <Text style={{ color:c.accent, fontWeight:'600' }}>{english ? 'Forgot password?' : 'Şifremi unuttum'}</Text>
          </Pressable>
          {message ? <Text style={{ color:message.includes('gönderildi') || message.includes('sent') ? c.cheap : c.pricey,
            fontSize:13, marginBottom:space.m }}>{message}</Text> : null}
          <Button disabled={!valid || busy} loading={busy} onPress={submit} accessibilityLabel={english ? 'Log in' : 'Giriş yap'}>
            {english ? 'Log In' : 'Giriş Yap'}
          </Button>
          <Button kind="ghost" style={{ marginTop:space.s }} disabled={busy} onPress={continueAsGuest}
            accessibilityLabel={english ? 'Continue as guest' : 'Misafir olarak devam et'}>
            {english ? 'Continue as guest' : 'Misafir olarak devam et'}
          </Button>
          <View style={{ flexDirection:'row', alignItems:'center', gap:space.s, marginVertical:space.l }}>
            <View style={{ flex:1 }}><Divider /></View><Text style={{ color:c.ink3, fontSize:12 }}>{english ? 'or continue with' : 'veya şununla devam et'}</Text><View style={{ flex:1 }}><Divider /></View>
          </View>
          <View accessible accessibilityRole="button"
            accessibilityLabel={english ? 'Continue with Google' : 'Google ile devam et'}
            style={{ alignItems:'center', marginBottom:space.s }}>
            {googleAvailable ? <React.Suspense fallback={<View style={{ height:48 }} />}>
              <GoogleNativeButton onPress={googleLogin} disabled={busy} />
            </React.Suspense>
              : <Button kind="ghost" style={{ width:'100%' }} disabled>
                  {english ? 'Google · development build required' : 'Google · development build gerekli'}
                </Button>}
          </View>
          {appleAvailable ? <View accessible accessibilityRole="button"
            accessibilityLabel={english ? 'Continue with Apple' : 'Apple ile devam et'}>
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.m} style={{ height:48, width:'100%' }} onPress={appleLogin} />
          </View> : null}
        </Card>
        <Pressable accessibilityRole="button" accessibilityLabel={english ? 'Sign up' : 'Kayıt ol'}
          onPress={() => router.push('/signup')} style={{ alignSelf:'center', padding:space.l }}>
          <Text style={{ color:c.ink2 }}>{english ? "Don't have an account? " : 'Hesabın yok mu? '}<Text style={{ color:c.accent, fontWeight:'700' }}>{english ? 'Sign up' : 'Kayıt ol'}</Text></Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
