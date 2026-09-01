import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../firebaseConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, (nextUser) => {
    setUser(nextUser);
    setReady(true);
  }), []);

  return (
    <AuthContext.Provider value={{ user, ready }}>
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
  };
  const pair = messages[code];
  return pair ? pair[english ? 1 : 0] : (english ? 'Sign-in failed. Please try again.' : 'Giriş yapılamadı. Lütfen tekrar deneyin.');
}
