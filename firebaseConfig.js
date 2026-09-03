import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import {
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

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
  '167919551577-nolrtu7oi0oqsv2n02mo76ais9rjcvss.apps.googleusercontent.com';

// Native OAuth clients registered for Sofra. Android is matched by package name
// and signing-certificate SHA-1; iOS must also be supplied to Google Sign-In.
export const GOOGLE_ANDROID_CLIENT_ID =
  '167919551577-ki40qf7ng3853ms7ci8ah1plc1l8gk6a.apps.googleusercontent.com';
export const GOOGLE_IOS_CLIENT_ID =
  '167919551577-qfj5eq2dou44st2tjlfnb68lod059305.apps.googleusercontent.com';

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
export const db = getFirestore(firebaseApp);
