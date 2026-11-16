// SIA: "Le Mur" as a grid of trades. Pure logic, no imports (unit-tested).
// Each tile is one trade (métier): how many providers are available, how many clients are asking.

export type MetierItem = {
  role: 'prestataire' | 'client';
  categorie: string;
};

export type MetierTile = {
  /** Lower-case key used to match announcements to a tile. */
  key: string;
  label: string;
  dispo: number;
  demandes: number;
};

export const AUTRE_METIER = 'autre';

/** "  Plombier " and "plombier" are the same tile; an empty trade goes to "Autre". */
export const metierKey = (categorie: string): string =>
  categorie.trim().toLowerCase() || AUTRE_METIER;

const labelOf = (categorie: string): string => {
  const c = categorie.trim();
  return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Autre';
};

/** One tile per trade, busiest first, then in alphabetical order. */
export function metierTiles(items: MetierItem[]): MetierTile[] {
  const tiles = new Map<string, MetierTile>();
  items.forEach((item) => {
    const key = metierKey(item.categorie);
    const tile = tiles.get(key) ?? { key, label: labelOf(item.categorie), dispo: 0, demandes: 0 };
    tiles.set(key, {
      ...tile,
      dispo: tile.dispo + (item.role === 'prestataire' ? 1 : 0),
      demandes: tile.demandes + (item.role === 'client' ? 1 : 0),
    });
  });
  return [...tiles.values()].sort(
    (a, b) => b.dispo + b.demandes - (a.dispo + a.demandes) || a.label.localeCompare(b.label, 'fr')
  );
}
