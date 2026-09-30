import React from 'react';
import { LOGO_FILES, type LogoName } from './brand';

/**
 * A club logo painted in `currentColor` through its SVG as a mask, so CSS can
 * recolor it and effects (like the gleam) stay inside the logo's shape.
 */
export default function Logo({ name, className = '', label, animKey }: {
  name: LogoName;
  className?: string;
  /** Accessible name; omit for decorative use. */
  label?: string;
  /** Changing this replays the logo's animation. */
  animKey?: string | number;
}) {
  const { src, aspect } = LOGO_FILES[name];
  return (
    <span
      key={animKey}
      className={`hd-logo hd-logo-${name} ${className}`}
      style={{ ['--logo' as string]: `url(${src})`, aspectRatio: String(aspect) }}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
