import React from 'react';
import { Star } from 'lucide-react';

interface Props {
  isFavorite: boolean;
  onToggle: () => void;
  label?: string;
}

export default function FavoriteStar({ isFavorite, onToggle, label }: Props) {
  return (
    <button
      className={`fav-star${isFavorite ? ' fav-star--active' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle(); }}
      aria-label={isFavorite
        ? `Remove ${label ?? 'this'} from favorites`
        : `Add ${label ?? 'this'} to favorites`}
      aria-pressed={isFavorite}
    >
      <Star size={20} />
    </button>
  );
}
