import React, { useLayoutEffect, useRef } from 'react';
import crestUrl from './logos/crest-color.svg';
import crestMaskUrl from './logos/crest.svg';
import { LAYOUT_SURFACE, boardLayout } from './display';
import './CupSplash.css';

/**
 * Full-screen crest shown while /cup loads: first as the route's Suspense
 * fallback while the Firebase bundle downloads, then by the page until the
 * first data arrives, so the two read as one screen. Loaded eagerly with the
 * site, so it avoids the lazy bundle (inline SVG logos, fonts, Firebase) and
 * shows the crest as a plain image.
 */
// The Suspense fallback and the page each mount their own splash; only the
// first fades in, so the handoff between them doesn't blink.
let shown = false;

export default function CupSplash({ leaving = false }: {
  /** Data is in: hand off to the board rendered beneath. */
  leaving?: boolean;
}) {
  const intro = !shown;
  shown = true;
  const root = useRef<HTMLDivElement>(null);
  const crest = useRef<HTMLSpanElement>(null);

  // The handoff: the crest flies onto the board header's crest while the
  // splash closes around it, so the board is revealed fully drawn rather than
  // faded up through its colors. The two crests are the same art, so the
  // shrinking iris clips the flying one away on top of its twin.
  useLayoutEffect(() => {
    const el = root.current;
    const from = crest.current?.getBoundingClientRect();
    const to = document.querySelector('.hd-th-crest')?.getBoundingClientRect();
    if (!leaving || !el || !from) return;
    if (!to || !to.height) {
      el.classList.add('fade');
      return;
    }
    const cx = to.left + to.width / 2;
    const cy = to.top + to.height / 2;
    el.style.setProperty('--cx', `${cx}px`);
    el.style.setProperty('--cy', `${cy}px`);
    // Start at the farthest corner so the iris closes from the first frame.
    const r = Math.hypot(Math.max(cx, window.innerWidth - cx), Math.max(cy, window.innerHeight - cy));
    el.style.setProperty('--r', `${r}px`);
    el.style.setProperty('--tx', `${cx - (from.left + from.width / 2)}px`);
    el.style.setProperty('--ty', `${cy - (from.top + from.height / 2)}px`);
    el.style.setProperty('--s', String(to.height / from.height));
    el.classList.add('fly');
  }, [leaving]);

  const tv = new URLSearchParams(window.location.search).get('tv');
  const portrait = window.matchMedia('(orientation: portrait)').matches;
  const { background } = LAYOUT_SURFACE[boardLayout(tv, portrait)];
  return (
    <div ref={root} className={`hd-splash ${leaving ? 'leaving' : ''}`} style={{ background }} role="status" aria-label={leaving ? undefined : 'Loading House Derby'}>
      <span ref={crest} className={`hd-splash-crest ${intro ? 'intro' : ''}`} style={{ ['--mask' as string]: `url(${crestMaskUrl})` }}>
        <img src={crestUrl} alt="" />
      </span>
    </div>
  );
}
