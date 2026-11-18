import { getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { getFirestore, initializeFirestore, memoryLocalCache } from 'firebase/firestore';

export function getFirebase(config) {
  const name = `nc-mobile-${config.firebase.projectId}`;
  const app = getApps().find(item => item.name === name) || initializeApp(config.firebase, name);
  let auth; let db;
  try { auth = initializeAuth(app, { persistence: inMemoryPersistence }); }
  catch (error) { if (error.code !== 'auth/already-initialized') throw error; auth = getAuth(app); }
  try { db = initializeFirestore(app, { localCache: memoryLocalCache() }); }
  catch { db = getFirestore(app); }
  return { auth, db };
}
