import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider, signInWithCredential } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';

// Firebase web config ships in the bundle regardless; it comes from env vars
// so the project can be swapped per deploy. Access is enforced by firestore.rules.
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID as string;
const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  projectId,
  authDomain: `${projectId}.firebaseapp.com`,
});

// Persistent cache queues marshal writes while offline on the course and
// replays them on reconnect.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Local testing against the emulators (`firebase emulators:start`, seeded
// with FIRESTORE_EMULATOR_HOST set). Dev builds only; `__hdSignIn(email)`
// signs in as anyone, since the emulator accepts unsigned Google tokens.
if (import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR) {
  connectFirestoreEmulator(db, '127.0.0.1', 8181);
  connectAuthEmulator(auth, 'http://127.0.0.1:9299', { disableWarnings: true });
  (window as unknown as Record<string, unknown>).__hdSignIn = (email: string) =>
    signInWithCredential(auth, GoogleAuthProvider.credential(JSON.stringify({ sub: email, email, email_verified: true })));
}
