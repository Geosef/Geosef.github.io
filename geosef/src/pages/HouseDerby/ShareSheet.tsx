import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Clapperboard, Download, Share2, X } from 'lucide-react';
import { cardFileName, renderCard, type CardSpec } from './shareCard';

export interface ShareOption {
  label: string;
  spec: CardSpec;
}

/**
 * Previews a share card and hands it to the system share sheet (Instagram
 * Stories, Messages...). The image is drawn when the sheet opens, before the
 * Share tap: iOS only opens the share sheet straight from a tap, so the file
 * has to be ready by then. Falls back to a download where files can't be
 * shared (desktop).
 */
export default function ShareSheet({ options, onClose, clipHref }: {
  options: ShareOption[];
  onClose: () => void;
  /** Replay view for recording a video clip, when there's a moment to replay. */
  clipHref?: string;
}) {
  const [picked, setPicked] = useState(0);
  const option = options[picked] ?? options[0];
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setFile(null);
    setUrl(null);
    setError(null);
    renderCard(option.spec).then(
      blob => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setFile(new File([blob], cardFileName(option.spec), { type: 'image/png' }));
        setUrl(objectUrl);
      },
      e => !cancelled && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // Redraw only when the choice changes, not on every live data tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);

  const canShareFiles = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });

  const share = () => {
    if (!file) return;
    // Dismissing the share sheet rejects; nothing to report.
    navigator.share({ files: [file] }).catch(() => {});
  };

  return (
    <div className="hd-share" role="dialog" aria-modal="true" aria-label="Share" onClick={onClose}>
      <div className="hd-share-panel" onClick={e => e.stopPropagation()}>
        <div className="hd-share-head">
          <span>Share</span>
          <button type="button" className="hd-share-close" onClick={onClose} aria-label="Close"><X aria-hidden /></button>
        </div>
        {options.length > 1 && (
          <div className="hd-share-options" role="tablist">
            {options.map((o, i) => (
              <button key={o.label} type="button" role="tab" aria-selected={i === picked} className={i === picked ? 'selected' : ''} onClick={() => setPicked(i)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        <div className="hd-share-preview">
          {url ? <img src={url} alt={`${option.label} card`} /> : error ? <p className="hd-error">{error}</p> : <span className="hd-share-drawing" />}
        </div>
        {canShareFiles ? (
          <button type="button" className="hd-primary hd-share-go" onClick={share}><Share2 aria-hidden /> Share</button>
        ) : (
          <a className={`hd-primary hd-share-go ${url ? '' : 'disabled'}`} href={url ?? undefined} download={cardFileName(option.spec)}>
            <Download aria-hidden /> Save image
          </a>
        )}
        {clipHref && (
          <Link to={clipHref} className="hd-share-clip">
            <Clapperboard aria-hidden />
            <span>Record a clip<small>Loops the moment full screen. Screen record it for a video Story.</small></span>
          </Link>
        )}
      </div>
    </div>
  );
}
