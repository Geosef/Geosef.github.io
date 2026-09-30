import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
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
