import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';

// Firebase Web app configuration for the Sofra project.
export const firebaseConfig = {
  apiKey: 'AIzaSyBxILIOMXjMbGDz7z-7syVfaxFmt4HZ8D0',
  authDomain: 'sofra-a8a90.firebaseapp.com',
  projectId: 'sofra-a8a90',
  storageBucket: 'sofra-a8a90.firebasestorage.app',
  messagingSenderId: '167919551577',
  appId: '1:167919551577:web:e882906622fddbb628dd48',
  measurementId: 'G-XF9Q1P13M3',
};

// Firebase uses the Web OAuth client ID when exchanging a Google ID token.
export const GOOGLE_WEB_CLIENT_ID =
  'REPLACE_WITH_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com';

export const firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);

let firebaseAuth;
try {
  firebaseAuth = initializeAuth(firebaseApp, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch (error) {
  // Fast Refresh can evaluate this module after Auth is already initialized.
  firebaseAuth = getAuth(firebaseApp);
}

export const auth = firebaseAuth;
