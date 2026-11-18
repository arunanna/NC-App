import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';
import * as SecureStore from 'expo-secure-store';
import { createSecureStorage } from './secureStorage';

export function getFirebase(config) {
  const name = `nc-mobile-${config.firebase.projectId}`;
  const app = getApps().find(item => item.name === name) || initializeApp(config.firebase, name);
  let auth; let db;
  const secureStorage = createSecureStorage({
    getItemAsync: key => SecureStore.getItemAsync(key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    setItemAsync: (key, value) => SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    deleteItemAsync: key => SecureStore.deleteItemAsync(key),
  });
  try { auth = initializeAuth(app, { persistence: getReactNativePersistence(secureStorage) }); }
  catch (error) { if (error.code !== 'auth/already-initialized') throw error; auth = getAuth(app); }
  try { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
  catch { db = getFirestore(app); }
  return { auth, db };
}
