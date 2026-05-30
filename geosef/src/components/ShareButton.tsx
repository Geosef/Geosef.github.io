import React, { useState } from 'react';
import { Share2, Check } from 'lucide-react';

/**
 * Share the current detail-page URL. Uses the native share sheet on mobile,
 * falls back to copy-to-clipboard with brief "copied" feedback on desktop.
 * Relies on the app's deep-linkable routes + OG tags (links render a preview).
 */
export default function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title, url }); } catch { /* user dismissed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked — nothing graceful to do */ }
  }

  return (
    <button
      className="gl-share-btn"
      onClick={share}
      aria-label={copied ? 'Link copied' : `Share ${title}`}
      title={copied ? 'Link copied' : 'Share'}
    >
      {copied ? <Check size={18} /> : <Share2 size={18} />}
    </button>
  );
}
