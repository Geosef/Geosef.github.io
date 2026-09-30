import { useEffect } from 'react';
import type { TeamId } from './scoring';

import crestSvg from './logos/crest.svg?raw';
import crestUrl from './logos/crest.svg';
import markSvg from './logos/mark.svg?raw';
import markUrl from './logos/mark.svg';
import ggcSvg from './logos/ggc.svg?raw';
import ggcUrl from './logos/ggc.svg';
import ogSvg from './logos/og.svg?raw';
import ogUrl from './logos/og.svg';
import southSvg from './logos/south.svg?raw';
import southUrl from './logos/south.svg';

// Single-color traced logos. They render as inline SVG painted in
// currentColor (so CSS can recolor them); the file URL is only used to mask
// the gleam effect to the logo's shape.
export type LogoName = 'crest' | 'mark' | 'ggc' | TeamId;

const inline = (svg: string) => svg.replace('fill="#000000"', 'fill="currentColor"');

export const LOGO_FILES: Record<LogoName, { svg: string; url: string; aspect: number }> = {
  crest: { svg: inline(crestSvg), url: crestUrl, aspect: 0.7822 },
  mark: { svg: inline(markSvg), url: markUrl, aspect: 1 },
  ggc: { svg: inline(ggcSvg), url: ggcUrl, aspect: 1.1703 },
  og: { svg: inline(ogSvg), url: ogUrl, aspect: 1 },
  south: { svg: inline(southSvg), url: southUrl, aspect: 1 },
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
