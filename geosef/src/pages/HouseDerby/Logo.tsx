import React from 'react';
import { LOGO_FILES, type LogoName } from './brand';

/**
 * A club logo as inline SVG in `currentColor`, so CSS can recolor it. Inline
 * (not a CSS mask) because Chrome re-rasterizes SVG masks asynchronously on
 * repaint, which made logos blink on every live score update. The gleam layer
 * still uses the file as a mask, but it only exists while animating.
 */
export default function Logo({ name, className = '', label, animKey }: {
  name: LogoName;
  className?: string;
  /** Accessible name; omit for decorative use. */
  label?: string;
  /** Changing this replays the logo's animation. */
  animKey?: string | number;
}) {
  const { svg, url, aspect } = LOGO_FILES[name];
  return (
    <span
      key={animKey}
      className={`hd-logo hd-logo-${name} ${className}`}
      style={{ ['--logo' as string]: `url(${url})`, aspectRatio: String(aspect) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {/* Static, bundled club artwork. */}
      <span className="hd-logo-art" dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}
