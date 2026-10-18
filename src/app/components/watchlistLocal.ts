// Copie locale de la liste à voir (localStorage), affichée tout de suite à l'ouverture de l'accueil
// et de « Ma liste », puis remplacée par la réponse du serveur. C'est un confort : chaque accès
// est protégé, et une copie absente, illisible ou d'un autre format est ignorée.

import type { OverviewItem } from "./HomeBadge";

export const WATCHLIST_STORAGE_KEY = "geowatch:watchlist:v1";

// Plafonds par affichage, repris de l'ancienne lecture : 10 vérifications et 20 compléments de fiche.
// Ce sont des maximums stricts : un appel n'est lancé que si son pire cas (CHECK_BATCH) les respecte.
export const CHECK_CAPS = { checked: 10, completed: 20 } as const;

// Titres traités au plus par appel (vérifications, et compléments), comme côté serveur.
export const CHECK_BATCH = 3;

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function readLocalWatchlist(storage: StorageLike | null): OverviewItem[] | null {
  try {
    const raw = storage?.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: unknown; items?: unknown };
    return parsed?.v === 1 && Array.isArray(parsed.items) ? (parsed.items as OverviewItem[]) : null;
  } catch {
    return null;
  }
}

export function writeLocalWatchlist(storage: StorageLike | null, items: OverviewItem[]): void {
  try {
    storage?.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify({ v: 1, items }));
  } catch {
    // Stockage plein ou refusé : la copie est un confort, on s'en passe.
  }
}

export function clearLocalWatchlist(storage: StorageLike | null): void {
  try {
    storage?.removeItem(WATCHLIST_STORAGE_KEY);
  } catch {
    // Rien à faire.
  }
}

// La vérification n'apporte que `details` et `availableAtHome` : le reste de l'élément local (note,
// date d'ajout…) est conservé, pour ne pas écraser une note enregistrée pendant l'appel.
// Un élément absent de la liste courante est ignoré.
export function mergeItems(current: OverviewItem[], updates: OverviewItem[]): OverviewItem[] {
  const byId = new Map(updates.map((u) => [u.title.id, u]));
  return current.map((item) => {
    const u = byId.get(item.title.id);
    return u ? { ...item, details: u.details, availableAtHome: u.availableAtHome } : item;
  });
}

export function nextCheckAllowed(totals: { checked: number; completed: number }, pending: number): boolean {
  return (
    pending > 0 &&
    totals.checked + CHECK_BATCH <= CHECK_CAPS.checked &&
    totals.completed + CHECK_BATCH <= CHECK_CAPS.completed
  );
}

// localStorage, ou null s'il est inaccessible (navigation privée stricte, rendu serveur).
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
