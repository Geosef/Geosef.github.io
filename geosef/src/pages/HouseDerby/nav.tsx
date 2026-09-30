import React from 'react';
import { flushSync } from 'react-dom';
import { useNavigate } from 'react-router-dom';

type ViewTransitionDocument = Document & { startViewTransition?: (update: () => void) => unknown };

/**
 * Navigates inside /cup with a view transition where the browser has them:
 * elements sharing a `view-transition-name` on both pages (a match row and
 * the match hero, a team half and the team header, a portrait) morph from
 * one to the other. Elsewhere it's a plain navigation.
 */
export function useCupNavigate() {
  const navigate = useNavigate();
  return (to: string) => {
    // The board restores its own scroll; other pages open at the top.
    const go = () => { navigate(to); if (to !== '/cup') window.scrollTo(0, 0); };
    const d = document as ViewTransitionDocument;
    if (!d.startViewTransition || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { go(); return; }
    // flushSync renders the new page inside the transition's snapshot.
    d.startViewTransition(() => flushSync(go));
  };
}

/** A link that navigates with useCupNavigate (new-tab clicks behave normally). */
export function CupLink({ to, onClick, ...rest }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) {
  const go = useCupNavigate();
  return (
    <a
      {...rest}
      href={to}
      onClick={e => {
        onClick?.(e);
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        go(to);
      }}
    />
  );
}

/** Inline style naming an element for a shared-element transition. */
export const vtName = (name: string): React.CSSProperties => ({ viewTransitionName: name } as React.CSSProperties);
