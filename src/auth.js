import React, { createContext, useContext, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { onAuthStateChanged, reload } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const [, setRevision] = useState(0);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    if (nextUser) AsyncStorage.removeItem('sofra.tr.v2.guest').catch(() => {});
    setUser(nextUser);
    setReady(true);
  }), []);

  async function refreshUser() {
    if (!auth.currentUser) return null;
    await reload(auth.currentUser);
    setUser(auth.currentUser);
    setRevision((value) => value + 1);
    return auth.currentUser;
  }

  return (
    <AuthContext.Provider value={{ user, ready, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside AuthProvider');
  return value;
}

export function friendlyAuthError(error, english = false) {
  const code = error?.code || '';
  const messages = {
    'auth/invalid-credential': ['E-posta veya şifre hatalı.', 'Incorrect email or password.'],
    'auth/user-not-found': ['E-posta veya şifre hatalı.', 'Incorrect email or password.'],
    'auth/wrong-password': ['E-posta veya şifre hatalı.', 'Incorrect email or password.'],
    'auth/email-already-in-use': ['Bu e-posta zaten kayıtlı.', 'This email is already registered.'],
    'auth/invalid-email': ['Geçerli bir e-posta girin.', 'Enter a valid email address.'],
    'auth/weak-password': ['Şifre en az 8 karakter olmalı.', 'Password must be at least 8 characters.'],
    'auth/network-request-failed': ['İnternet bağlantınızı kontrol edin.', 'Check your internet connection.'],
    'auth/operation-not-allowed': ['Bu giriş yöntemi Firebase’de etkin değil.', 'This sign-in method is not enabled in Firebase.'],
    'auth/configuration-not-found': ['Firebase Authentication henüz etkinleştirilmemiş.', 'Firebase Authentication has not been enabled yet.'],
    'auth/too-many-requests': ['Çok fazla deneme yapıldı. Biraz bekleyip tekrar deneyin.', 'Too many attempts. Wait a moment and try again.'],
    'auth/requires-recent-login': ['Güvenlik için çıkış yapıp tekrar giriş yaptıktan sonra yeniden deneyin.', 'For security, log out, sign in again, and retry.'],
  };
  const pair = messages[code];
  return pair ? pair[english ? 1 : 0] : (english ? 'Sign-in failed. Please try again.' : 'Giriş yapılamadı. Lütfen tekrar deneyin.');
}
