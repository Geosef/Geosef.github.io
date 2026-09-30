import { useEffect } from 'react';
import type { TeamId } from './scoring';

// Logos live in public/cup (trimmed and resized from the club's artwork).
export const LOGOS = {
  crest: '/cup/crest.webp',
  mark: '/cup/mark.webp',
  ggc: '/cup/ggc.webp',
  team: { og: '/cup/og.webp', south: '/cup/south.webp' } as Record<TeamId, string>,
};

/** Sets the tab title and favicon for /cup pages, restoring the site's on leave. */
export function useCupChrome(title = 'House Derby') {
  useEffect(() => {
    const prevTitle = document.title;
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    const prevIcon = link?.href;
    document.title = title;
    if (link) link.href = '/cup/favicon.png';
    return () => {
      document.title = prevTitle;
      if (link && prevIcon) link.href = prevIcon;
    };
  }, [title]);
}
