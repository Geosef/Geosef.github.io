import { useEffect } from 'react';
import type { TeamId } from './scoring';

// Single-color SVG logos in public/cup, drawn as CSS masks (see <Logo>) so
// they take any color and can be animated.
export type LogoName = 'crest' | 'mark' | 'ggc' | TeamId;

export const LOGO_FILES: Record<LogoName, { src: string; aspect: number }> = {
  crest: { src: '/cup/crest.svg', aspect: 0.7822 },
  mark: { src: '/cup/mark.svg', aspect: 1 },
  ggc: { src: '/cup/ggc.svg', aspect: 1.1703 },
  og: { src: '/cup/og.svg', aspect: 1 },
  south: { src: '/cup/south.svg', aspect: 1 },
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
