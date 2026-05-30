import React from 'react';
import { Star } from 'lucide-react';

interface Props {
  isFavorite: boolean;
  onToggle: () => void;
  label?: string;
  /** Logged-out affordance: render a muted star whose click should prompt sign-in. */
  promptSignIn?: boolean;
}

export default function FavoriteStar({ isFavorite, onToggle, label, promptSignIn }: Props) {
  const ariaLabel = promptSignIn
    ? 'Sign in to save favorites'
    : isFavorite
      ? `Remove ${label ?? 'this'} from favorites`
      : `Add ${label ?? 'this'} to favorites`;
  return (
    <button
      className={`fav-star${isFavorite ? ' fav-star--active' : ''}${promptSignIn ? ' fav-star--prompt' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      aria-label={ariaLabel}
      title={ariaLabel}
      aria-pressed={promptSignIn ? undefined : isFavorite}
    >
      <Star size={20} />
    </button>
  );
}
