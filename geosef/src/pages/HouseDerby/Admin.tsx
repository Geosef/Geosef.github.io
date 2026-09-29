import React, { useState } from 'react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { useMarshal } from './useMarshal';

// Scaffold marshal page: proves Google sign-in and that firestore.rules grant
// this account write access. Score entry replaces the probe once matches exist.
export default function Admin() {
  const { user, ready, signIn, signOut } = useMarshal();
  const [status, setStatus] = useState('');

  async function probeWrite() {
    setStatus('Writing…');
    try {
      await updateDoc(doc(db, 'matches', '_probe'), {
        updatedAt: serverTimestamp(),
        updatedBy: user?.email ?? '',
      });
      setStatus('Write OK — you are a marshal');
    } catch (e) {
      setStatus(`Write denied: ${(e as Error).message}`);
    }
  }

  if (!ready) return <p>Loading…</p>;

  return (
    <div style={{ padding: 16, fontFamily: 'system-ui' }}>
      <h1>House Derby — Marshal</h1>
      {user ? (
        <>
          <p>Signed in as {user.email}</p>
          <button onClick={probeWrite}>Test write</button>{' '}
          <button onClick={signOut}>Sign out</button>
          <p>{status}</p>
        </>
      ) : (
        <button onClick={() => signIn().catch(e => setStatus(e.message))}>Sign in with Google</button>
      )}
      {!user && <p>{status}</p>}
    </div>
  );
}
