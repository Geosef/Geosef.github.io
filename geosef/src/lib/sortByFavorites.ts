export function sortByFavorites<T>(
  items: T[],
  favorites: string[],
  keyFn: (item: T) => string,
): T[] {
  if (!favorites.length) return items;
  const favSet = new Set(favorites);
  const favOrder = new Map(favorites.map((f, i) => [f, i]));
  const favItems = items
    .filter(item => favSet.has(keyFn(item)))
    .sort((a, b) => (favOrder.get(keyFn(a)) ?? 0) - (favOrder.get(keyFn(b)) ?? 0));
  const rest = items.filter(item => !favSet.has(keyFn(item)));
  return [...favItems, ...rest];
}
