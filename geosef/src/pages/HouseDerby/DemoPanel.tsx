import React, { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Match } from './data';
import type { HoleOutcome } from './scoring';
import { doc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { FLOW_START, OUTCOMES, PHASES, buildScenario, flowStep, pickNextHole, scenario, type FlowState, type Outcome, type Scenario } from './demo';
import { saveHole } from './writes';

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

const SPEEDS = [{ label: 'Fast', ms: 1000 }, { label: 'Normal', ms: 2500 }];
const DEAD_TIMES = [{ label: '30s', ms: 30_000 }, { label: '70s (one TV cycle)', ms: 70_000 }];
/** Ticks between outdoor tee times in tournament flow (a hole goes in per tick). */
const STAGGER = 3;

type AutoPlay = null | 'random' | 'flow';

export default function DemoPanel({ matches, email, sessionOrder }: {
  matches: Match[]; email: string; sessionOrder: string[];
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [outcome, setOutcome] = useState<Outcome>(OUTCOMES[0]);
  const [autoPlay, setAutoPlay] = useState<AutoPlay>(null);
  const [speed, setSpeed] = useState(SPEEDS[1].ms);
  const [deadMs, setDeadMs] = useState(DEAD_TIMES[1].ms);
  // Latest matches for the auto-play timer, which outlives renders.
  const latest = useRef(matches);
  latest.current = matches;
  const flow = useRef<FlowState>(FLOW_START);

  // Plays one hole through the normal marshal save path (edit log included),
  // so the boards animate exactly as they would on the day.
  function save(play: { matchId: string; hole: number; result: HoleOutcome }) {
    const m = latest.current.find(x => x.id === play.matchId)!;
    saveHole(m.id, email, play.hole, m.holes[play.hole], { result: play.result })
      .catch(e => setMessage(`Failed: ${(e as Error).message}`));
  }

  function playHole() {
    const next = pickNextHole(latest.current, sessionOrder, outcome.lean);
    if (!next) {
      setAutoPlay(null);
      setMessage('Every match is finished.');
      return;
    }
    save(next);
  }

  function flowTick() {
    const step = flowStep(latest.current, sessionOrder, flow.current, { now: Date.now(), stagger: STAGGER, deadMs, lean: outcome.lean });
    flow.current = step.state;
    if (step.kind === 'done') {
      setAutoPlay(null);
      setMessage('Tournament flow: every match is finished.');
    } else if (step.kind === 'dead') {
      setMessage(`Dead time: ${step.next} tees off in ${Math.ceil(step.msLeft / 1000)}s`);
    } else if (step.kind === 'hole') {
      setMessage(`Tournament flow: ${step.state.stage} in play`);
      save(step.play);
    }
  }

  useEffect(() => {
    if (!autoPlay) return;
    if (autoPlay === 'flow') flow.current = FLOW_START;
    const t = setInterval(autoPlay === 'flow' ? flowTick : playHole, speed);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, speed, deadMs, outcome]);

  async function run(s: Scenario) {
    setBusy(s.id);
    setAutoPlay(null);
    setMessage('');
    try {
      await applyScenario(s, matches, email);
      setMessage(`Loaded “${s.label}”. Tap again to re-roll.`);
    } catch (e) {
      setMessage(`Failed: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  }

  const toggle = (mode: Exclude<AutoPlay, null>) => setAutoPlay(a => (a === mode ? null : mode));

  return (
    <details className="hd-demo" open>
      <summary>Demo states <span className="hd-muted">(overwrites all scores)</span></summary>
      <div className="hd-demo-label">Heading for</div>
      <div className="hd-demo-buttons">
        {OUTCOMES.map(o => (
          <button key={o.id} className={o.id === outcome.id ? 'on' : ''} onClick={() => setOutcome(o)}>{o.label}</button>
        ))}
      </div>
      <div className="hd-demo-label">Jump to</div>
      <div className="hd-demo-buttons">
        {PHASES.map(p => {
          const s = scenario(p, outcome);
          return (
            <button key={p.id} disabled={busy !== null} onClick={() => run(s)}>
              {busy === s.id ? '…' : p.label}
            </button>
          );
        })}
      </div>
      <div className="hd-demo-label">Auto-play <span className="hd-muted">(leans toward the outcome above)</span></div>
      <div className="hd-demo-buttons">
        <button onClick={playHole} disabled={busy !== null}>Simulate a hole</button>
        <button className={autoPlay === 'random' ? 'on' : ''} onClick={() => toggle('random')} disabled={busy !== null}>
          {autoPlay === 'random' ? 'Stop' : 'Hole by hole'}
        </button>
        <button className={autoPlay === 'flow' ? 'on' : ''} onClick={() => toggle('flow')} disabled={busy !== null}>
          {autoPlay === 'flow' ? 'Stop' : 'Tournament flow'}
        </button>
      </div>
      <div className="hd-demo-buttons">
        {SPEEDS.map(o => (
          <button key={o.ms} className={speed === o.ms ? 'on' : ''} onClick={() => setSpeed(o.ms)}>{o.label}</button>
        ))}
        <span className="hd-muted">Dead time</span>
        {DEAD_TIMES.map(o => (
          <button key={o.ms} className={deadMs === o.ms ? 'on' : ''} onClick={() => setDeadMs(o.ms)}>{o.label}</button>
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
