import React, { useEffect } from 'react';

/**
 * Lightweight aria-live toast shown when a favorite fails to save.
 * Fixed-position so it never shifts page layout; auto-dismisses.
 */
export default function FavoritesToast({
  show,
  onDismiss,
}: { show: boolean; onDismiss: () => void }) {
  useEffect(() => {
    if (!show) return;
    const t = setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [show, onDismiss]);

  if (!show) return null;

  return (
    <div className="gl-toast" role="alert">
      <span>Couldn’t save your favorite. Check your connection and try again.</span>
      <button className="gl-toast-close" onClick={onDismiss} aria-label="Dismiss">✕</button>
    </div>
  );
}
