// Copie locale de la liste à voir (localStorage), affichée tout de suite à l'ouverture de l'accueil
// et de « Ma liste », puis remplacée par la réponse du serveur. C'est un confort : chaque accès
// est protégé, et une copie absente, illisible ou d'un autre format est ignorée.

import type { OverviewItem } from "./HomeBadge";

export const WATCHLIST_STORAGE_KEY = "geowatch:watchlist:v1";

// Plafonds par affichage, repris de l'ancienne lecture : 10 vérifications et 20 compléments de fiche.
export const CHECK_CAPS = { checked: 10, completed: 20 } as const;

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

// Remplace les éléments mis à jour par la vérification ; un élément absent de la liste courante est ignoré.
export function mergeItems(current: OverviewItem[], updates: OverviewItem[]): OverviewItem[] {
  const byId = new Map(updates.map((u) => [u.title.id, u]));
  return current.map((item) => byId.get(item.title.id) ?? item);
}

export function nextCheckAllowed(totals: { checked: number; completed: number }, pending: number): boolean {
  return pending > 0 && totals.checked < CHECK_CAPS.checked && totals.completed < CHECK_CAPS.completed;
}

// localStorage, ou null s'il est inaccessible (navigation privée stricte, rendu serveur).
export function browserStorage(): StorageLike | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}
