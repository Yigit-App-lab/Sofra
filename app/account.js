import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, TextInput, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';
import {
  deleteUser, EmailAuthProvider, GoogleAuthProvider, OAuthProvider, reauthenticateWithCredential,
  sendEmailVerification, updatePassword,
} from 'firebase/auth';
import { auth, GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from '../firebaseConfig';
import { friendlyAuthError, useAuth } from '../src/auth';
import { deleteCloudUserState } from '../src/cloudStore';
import { useStore } from '../src/store';
import { useTheme, radius, space } from '../src/theme';
import { Body, Button, Card, Label } from '../src/ui';

function PasswordField({ label, value, onChangeText, accessibilityLabel }) {
  const c = useTheme();
  return (
    <View style={{ marginTop:space.m }}>
      <Body dim size={12}>{label}</Body>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="password"
        accessibilityLabel={accessibilityLabel || label}
        style={{ color:c.ink, backgroundColor:c.surface, borderColor:c.line, borderWidth:1,
          borderRadius:radius.m, paddingHorizontal:space.m, paddingVertical:12, fontSize:15,
          marginTop:space.s }}
      />
    </View>
  );
}

export default function AccountScreen() {
  const c = useTheme();
  const router = useRouter();
  const { state } = useStore();
  const { user, refreshUser } = useAuth();
  const english = state.langIndex === 1;
  const passwordAccount = user?.providerData?.some((provider) => provider.providerId === 'password');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [messageGood, setMessageGood] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function showMessage(value, good = false) {
    setMessage(value);
    setMessageGood(good);
  }

  async function resendVerification() {
    try {
      setBusy('verify'); showMessage('');
      await sendEmailVerification(auth.currentUser);
      showMessage(english ? 'Verification email sent. Check your inbox and spam folder.' : 'Doğrulama e-postası gönderildi. Gelen ve gereksiz klasörlerini kontrol et.', true);
    } catch (error) { showMessage(friendlyAuthError(error, english)); }
    finally { setBusy(''); }
  }

  async function checkVerification() {
    try {
      setBusy('check'); showMessage('');
      const refreshed = await refreshUser();
      showMessage(refreshed?.emailVerified
        ? (english ? 'Your email is verified.' : 'E-posta adresin doğrulandı.')
        : (english ? 'Not verified yet. Open the link in the email first.' : 'Henüz doğrulanmadı. Önce e-postadaki bağlantıyı aç.'),
      Boolean(refreshed?.emailVerified));
    } catch (error) { showMessage(friendlyAuthError(error, english)); }
    finally { setBusy(''); }
  }

  async function changePassword() {
    if (newPassword.length < 8) {
      showMessage(english ? 'New password must be at least 8 characters.' : 'Yeni şifre en az 8 karakter olmalı.'); return;
    }
    if (newPassword !== confirmPassword) {
      showMessage(english ? 'New passwords do not match.' : 'Yeni şifreler aynı değil.'); return;
    }
    try {
      setBusy('password'); showMessage('');
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      showMessage(english ? 'Your password has been changed.' : 'Şifren değiştirildi.', true);
    } catch (error) { showMessage(friendlyAuthError(error, english)); }
    finally { setBusy(''); }
  }

  async function removeAccount() {
    try {
      setBusy('delete'); showMessage('');
      if (passwordAccount) {
        const credential = EmailAuthProvider.credential(user.email, deletePassword);
        await reauthenticateWithCredential(auth.currentUser, credential);
      } else if (user.providerData.some((provider) => provider.providerId === 'google.com')) {
        const { GoogleSignin } = await import('@react-native-google-signin/google-signin');
        GoogleSignin.configure({ webClientId:GOOGLE_WEB_CLIENT_ID, iosClientId:GOOGLE_IOS_CLIENT_ID });
        await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog:true });
        const response = await GoogleSignin.signIn();
        const idToken = response?.data?.idToken || response?.idToken;
        if (!idToken) throw new Error('Google did not return an ID token');
        await reauthenticateWithCredential(auth.currentUser, GoogleAuthProvider.credential(idToken));
      } else if (user.providerData.some((provider) => provider.providerId === 'apple.com')) {
        const bytes = await Crypto.getRandomBytesAsync(32);
        const rawNonce = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
        const nonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
        const result = await AppleAuthentication.signInAsync({ nonce });
        const credential = new OAuthProvider('apple.com').credential({ idToken:result.identityToken, rawNonce });
        await reauthenticateWithCredential(auth.currentUser, credential);
      }
      const uid = user.uid;
      await deleteCloudUserState(uid);
      await deleteUser(auth.currentUser);
      await AsyncStorage.removeItem(`sofra.tr.v2.user.${uid}`);
      router.replace('/login');
    } catch (error) {
      showMessage(friendlyAuthError(error, english));
      setBusy('');
    }
  }

  if (!user) return null;

  return (
    <KeyboardAvoidingView style={{ flex:1, backgroundColor:c.ground }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding:space.l, paddingBottom:space.xl*2 }}>
        <Card>
          <Body size={15}>{user.email || (english ? 'Social account' : 'Sosyal hesap')}</Body>
          <Body dim size={12} style={{ marginTop:4 }}>
            {passwordAccount
              ? (user.emailVerified ? (english ? 'Email verified' : 'E-posta doğrulandı') : (english ? 'Email not verified' : 'E-posta doğrulanmadı'))
              : (english ? 'Signed in with Google or Apple' : 'Google veya Apple ile giriş yapıldı')}
          </Body>
        </Card>

        {passwordAccount && !user.emailVerified ? <>
          <Label>{english ? 'EMAIL VERIFICATION' : 'E-POSTA DOĞRULAMA'}</Label>
          <Card>
            <Body dim size={13}>{english ? 'Verify your address to secure your account.' : 'Hesabını güvenceye almak için adresini doğrula.'}</Body>
            <Button style={{ marginTop:space.m }} disabled={Boolean(busy)} loading={busy === 'verify'} onPress={resendVerification}>
              {english ? 'Send verification email' : 'Doğrulama e-postası gönder'}
            </Button>
            <Button kind="ghost" style={{ marginTop:space.s }} disabled={Boolean(busy)} loading={busy === 'check'} onPress={checkVerification}>
              {english ? 'I verified it, check again' : 'Doğruladım, tekrar kontrol et'}
            </Button>
          </Card>
        </> : null}

        {passwordAccount ? <>
          <Label>{english ? 'CHANGE PASSWORD' : 'ŞİFRE DEĞİŞTİR'}</Label>
          <Card>
            <PasswordField label={english ? 'Current password' : 'Mevcut şifre'} value={currentPassword} onChangeText={setCurrentPassword} />
            <PasswordField label={english ? 'New password' : 'Yeni şifre'} value={newPassword} onChangeText={setNewPassword} />
            <PasswordField label={english ? 'Repeat new password' : 'Yeni şifreyi tekrar yaz'} value={confirmPassword} onChangeText={setConfirmPassword} />
            <Button style={{ marginTop:space.l }} disabled={Boolean(busy) || !currentPassword || newPassword.length < 8 || !confirmPassword}
              loading={busy === 'password'} onPress={changePassword}>
              {english ? 'Change password' : 'Şifreyi değiştir'}
            </Button>
          </Card>
        </> : null}

        {message ? <Text style={{ color:messageGood ? c.cheap : c.pricey, fontSize:13, marginTop:space.m }}>{message}</Text> : null}

        <Label>{english ? 'DELETE ACCOUNT' : 'HESABI SİL'}</Label>
        <Card>
          <Body size={14}>{english ? 'Permanently delete your account' : 'Hesabını kalıcı olarak sil'}</Body>
          <Body dim size={12.5} style={{ marginTop:space.s }}>
            {english
              ? 'Your pantry, shopping list, preferences and recipe history will be deleted from the cloud. This cannot be undone.'
              : 'Kilerin, alışveriş listen, tercihlerin ve tarif geçmişin buluttan silinir. Bu işlem geri alınamaz.'}
          </Body>
          {!confirmDelete ? (
            <Button kind="ghost" style={{ marginTop:space.m }} disabled={Boolean(busy)} onPress={() => { setConfirmDelete(true); showMessage(''); }}>
              {english ? 'Delete my account…' : 'Hesabımı sil…'}
            </Button>
          ) : <>
            {passwordAccount ? <PasswordField label={english ? 'Enter your current password to confirm' : 'Onaylamak için mevcut şifreni yaz'}
              value={deletePassword} onChangeText={setDeletePassword} /> : null}
            {!passwordAccount ? <Body dim size={12} style={{ marginTop:space.m }}>
              {english ? 'For security, you may be asked to sign in again.' : 'Güvenlik için yeniden giriş yapman istenebilir.'}
            </Body> : null}
            <View style={{ flexDirection:'row', gap:space.s, marginTop:space.m }}>
              <Button kind="ghost" style={{ flex:1 }} disabled={Boolean(busy)} onPress={() => { setConfirmDelete(false); setDeletePassword(''); }}>
                {english ? 'Cancel' : 'Vazgeç'}
              </Button>
              <Button style={{ flex:1, backgroundColor:c.pricey }} disabled={Boolean(busy) || (passwordAccount && !deletePassword)}
                loading={busy === 'delete'} onPress={removeAccount}>
                {english ? 'Delete permanently' : 'Kalıcı olarak sil'}
              </Button>
            </View>
          </>}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
