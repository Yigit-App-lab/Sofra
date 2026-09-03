import { deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

export const USER_FIELDS = [
  'timeBudget', 'maxPerPortion', 'meatless', 'dietPreference',
  'glutenFree', 'lactoseFree', 'lowGlycemic', 'skill',
  'pantry', 'kiler', 'shoppingList', 'profile',
];

export function userDataFromState(state) {
  return Object.fromEntries(USER_FIELDS.map((key) => [key, state[key]]));
}

export function userStateRef(uid) {
  return doc(db, 'users', uid, 'app', 'state');
}

export async function readCloudUserState(uid) {
  const snapshot = await getDoc(userStateRef(uid));
  if (!snapshot.exists()) return null;
  const value = snapshot.data();
  return {
    data: value.data || null,
    clientUpdatedAt: Number(value.clientUpdatedAt || 0),
  };
}

export async function writeCloudUserState(uid, data, clientUpdatedAt) {
  await setDoc(userStateRef(uid), {
    schemaVersion: 1,
    data,
    clientUpdatedAt,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteCloudUserState(uid) {
  await deleteDoc(userStateRef(uid));
}
