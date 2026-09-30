import React, { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Match } from './data';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { SCENARIOS, buildScenario, type Scenario } from './demo';

const FLAG = 'hd-demo';

/** Overwrites every match's scores with the scenario. Marshal-only by rules. */
async function applyScenario(scenario: Scenario, matches: Match[], email: string) {
  const holes = buildScenario(scenario, matches);
  const batch = writeBatch(db);
  for (const m of matches) {
    batch.update(doc(db, 'matches', m.id), {
      holes: holes[m.id] ?? {},
      concededBy: null,
      updatedAt: serverTimestamp(),
      updatedBy: `${email} (demo)`,
    });
  }
  await batch.commit();
}


/**
 * Prototype-only controls that rewrite every match to a demo state. Shown in
 * local dev, or on the live site with ?demo (remembered for the tab). Writes
 * still need a marshal, so the flag only reveals the buttons.
 */
export function useDemoMode(): boolean {
  const [params] = useSearchParams();
  let on = import.meta.env.DEV || params.has('demo');
  try {
    if (params.has('demo')) sessionStorage.setItem(FLAG, '1');
    on = on || sessionStorage.getItem(FLAG) === '1';
  } catch {
    // Storage blocked (private mode): fall back to the URL flag alone.
  }
  return on;
}

export default function DemoPanel({ matches, email }: { matches: Match[]; email: string }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  async function run(id: string) {
    const scenario = SCENARIOS.find(s => s.id === id)!;
    setBusy(id);
    setMessage('');
    try {
      await applyScenario(scenario, matches, email);
      setMessage(`Loaded “${scenario.label}”. Tap again to re-roll.`);
    } catch (e) {
      setMessage(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  return (
    <details className="hd-demo" open>
      <summary>Demo states <span className="hd-muted">(overwrites all scores)</span></summary>
      <div className="hd-demo-buttons">
        {SCENARIOS.map(s => (
          <button key={s.id} disabled={busy !== null} onClick={() => run(s.id)}>
            {busy === s.id ? '…' : s.label}
          </button>
        ))}
      </div>
      {message && <p className="hd-muted">{message}</p>}
      <div className="hd-demo-links">
        Open:
        <a href="/cup" target="_blank" rel="noreferrer">Board</a>
        <a href="/cup?tv" target="_blank" rel="noreferrer">TV</a>
        <a href="/cup?tv=vertical" target="_blank" rel="noreferrer">Vertical</a>
      </div>
    </details>
  );
}
