import { useEffect, useState } from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, type User } from 'firebase/auth';
import { auth, googleProvider } from './firebase';

// Marshals sign in with Firebase's own Google popup rather than the site's
// One Tap flow: One Tap is often suppressed on iOS Safari, and Firebase keeps
// its session alive across the round without the ~1h Google token expiry.
// Whether the signed-in user may actually write is decided by firestore.rules.
export function useMarshal() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => onAuthStateChanged(auth, u => {
    setUser(u);
    setReady(true);
  }), []);

  return {
    user,
    ready,
    signIn: () => signInWithPopup(auth, googleProvider),
    signOut: () => signOut(auth),
  };
}
