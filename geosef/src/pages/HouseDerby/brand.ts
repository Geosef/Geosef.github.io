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

/** Points a <link rel> at `href` (creating it if needed); returns an undo. */
function swapLink(rel: string, href: string, type?: string): () => void {
  let link = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  const created = !link;
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    document.head.appendChild(link);
  }
  const prev = { href: link.href, type: link.type };
  link.href = href;
  if (type) link.type = type;
  return () => {
    if (created) link!.remove();
    else Object.assign(link!, prev);
  };
}

/**
 * Tab title, favicon and home-screen icon for /cup pages (so a marshal who
 * adds the page to their iPhone home screen gets the Derby horseshoe),
 * restoring the site's on leave.
 */
export function useCupChrome(title = 'House Derby') {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = title;
    const undoIcon = swapLink('icon', '/cup/favicon.svg', 'image/svg+xml');
    const undoTouch = swapLink('apple-touch-icon', '/cup/apple-touch-icon.png');
    return () => {
      document.title = prevTitle;
      undoIcon();
      undoTouch();
    };
  }, [title]);
}
