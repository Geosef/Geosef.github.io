import { useEffect } from 'react';
import type { TeamId } from './scoring';

// Two-tone crest (white art, gold lettering and crown, navy fill); the
// single-color crest.svg is kept for the gleam mask.
import crestSvg from './logos/crest-color.svg?raw';
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
  crest: { svg: crestSvg, url: crestUrl, aspect: 0.7822 },
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

/** Page color behind a view, and whether it's a fixed full-screen board. */
export interface CupSurface {
  background: string;
  /** Full-screen boards: no page scroll or rubber-band overscroll. */
  lock?: boolean;
}

// Hex values mirror the CSS tokens (--hd-cream etc.); Safari reads them off
// html/body directly, so they're set inline rather than through CSS vars.
export const SURFACES = {
  page: { background: '#f8f6ea' },
  tv: { background: '#3f4463', lock: true },
  vertical: { background: '#1d1f2b', lock: true },
} satisfies Record<string, CupSurface>;

/**
 * Tab title, favicon, home-screen icon and page surface for /cup pages,
 * restoring the site's on leave. iOS Safari (26+) ignores theme-color and
 * tints its floating toolbars and overscroll from the html/body background,
 * so each view paints those to match itself.
 */
export function useCupChrome(title = 'House Derby', surface: CupSurface = SURFACES.page) {
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

  useEffect(() => {
    const roots = [document.documentElement, document.body];
    const prev = roots.map(el => ({ bg: el.style.backgroundColor, overflow: el.style.overflow, overscroll: el.style.overscrollBehavior }));
    for (const el of roots) {
      el.style.backgroundColor = surface.background;
      if (surface.lock) {
        el.style.overflow = 'hidden';
        el.style.overscrollBehavior = 'none';
      }
    }
    return () => roots.forEach((el, i) => {
      el.style.backgroundColor = prev[i].bg;
      el.style.overflow = prev[i].overflow;
      el.style.overscrollBehavior = prev[i].overscroll;
    });
  }, [surface.background, surface.lock]);
}
