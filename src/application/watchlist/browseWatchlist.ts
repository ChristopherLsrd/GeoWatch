// Tri, filtres et recherche de la liste à voir (accueil et « Ma liste »). Fonctions pures,
// utilisables côté client.

import type { TitleType } from "@/domain/Title";
import type { WatchlistOverviewItem } from "./WatchlistOverview";

// Les dates peuvent arriver en chaînes (JSON) côté client.
type Browsable = Pick<WatchlistOverviewItem, "title" | "details" | "note" | "availableAtHome"> & {
  addedAt: Date | string;
};

export const WATCHLIST_SORTS = {
  added: "Date d'ajout",
  release: "Date de sortie",
  imdb: "Note IMDb",
  tmdb: "Note TMDB",
  title: "Titre",
  runtime: "Durée",
} as const;

export type WatchlistSort = keyof typeof WATCHLIST_SORTS;

export type WatchlistFilters = {
  // Cherche dans le titre, les réalisateurs et la note perso (casse et accents ignorés).
  query?: string;
  type?: TitleType;
  directors?: string[];
  genres?: string[];
  atHomeOnly?: boolean;
};

function normalize(text: string): string {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
}

export function filterWatchlist<T extends Browsable>(items: T[], filters: WatchlistFilters): T[] {
  const query = normalize(filters.query ?? "");
  return items.filter((item) => {
    const directors = item.details?.directors ?? [];
    const genres = item.details?.genres ?? [];
    return (
      (!query || [item.title.name, ...directors, item.note].some((text) => normalize(text).includes(query))) &&
      (!filters.type || item.title.type === filters.type) &&
      (!filters.directors?.length || directors.some((d) => filters.directors!.includes(d))) &&
      (!filters.genres?.length || genres.some((g) => filters.genres!.includes(g))) &&
      (!filters.atHomeOnly || (item.availableAtHome?.length ?? 0) > 0)
    );
  });
}

// Valeur de tri dans le sens naturel : les plus récents et les mieux notés d'abord, les titres
// de A à Z, les plus courts d'abord. null : valeur inconnue, toujours à la fin.
function sortKey(item: Browsable, sort: WatchlistSort): number | string | null {
  switch (sort) {
    case "added":
      return -new Date(item.addedAt).getTime();
    case "release": {
      const date = item.details?.releaseDate ?? (item.title.year ? `${item.title.year}-01-01` : null);
      return date ? -new Date(date).getTime() : null;
    }
    case "imdb":
      return item.details?.imdbScore != null ? -item.details.imdbScore : null;
    case "tmdb":
      return item.details?.tmdbScore != null ? -item.details.tmdbScore : null;
    case "title":
      return item.title.name;
    case "runtime":
      return item.details?.runtime ?? null;
  }
}

export function sortWatchlist<T extends Browsable>(items: T[], sort: WatchlistSort, reverse = false): T[] {
  return [...items].sort((a, b) => {
    const ka = sortKey(a, sort);
    const kb = sortKey(b, sort);
    if (ka === null || kb === null) return ka === kb ? 0 : ka === null ? 1 : -1;
    const order = typeof ka === "string" ? ka.localeCompare(String(kb), "fr") : ka - (kb as number);
    return reverse ? -order : order;
  });
}

// Valeurs proposées dans les filtres, par ordre alphabétique.
export function watchlistFacets(items: Browsable[]): { directors: string[]; genres: string[] } {
  const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "fr"));
  return {
    directors: sorted(items.flatMap((i) => i.details?.directors ?? [])),
    genres: sorted(items.flatMap((i) => i.details?.genres ?? [])),
  };
}

// Filtres de l'accueil mémorisés d'une visite à l'autre (la recherche texte n'en fait pas partie).
export type SavedWatchlistFilters = {
  type: TitleType | "";
  director: string;
  genre: string;
  atHomeOnly: boolean;
};

export const NO_SAVED_FILTERS: SavedWatchlistFilters = { type: "", director: "", genre: "", atHomeOnly: false };

// Relit une valeur enregistrée ; chaque champ invalide reprend sa valeur par défaut.
export function parseSavedFilters(raw: string | null): SavedWatchlistFilters {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw ?? "null");
  } catch {
    return NO_SAVED_FILTERS;
  }
  if (!parsed || typeof parsed !== "object") return NO_SAVED_FILTERS;
  const value = parsed as Record<string, unknown>;
  return {
    type: value.type === "MOVIE" || value.type === "SHOW" ? value.type : "",
    director: typeof value.director === "string" ? value.director : "",
    genre: typeof value.genre === "string" ? value.genre : "",
    atHomeOnly: value.atHomeOnly === true,
  };
}

// Un réalisateur ou un genre absent de la liste (titre retiré, fiche pas encore chargée) est mis
// de côté : sinon la liste serait vide alors que le menu afficherait « Tous ».
export function applicableFilters(
  filters: SavedWatchlistFilters,
  facets: { directors: string[]; genres: string[] },
): SavedWatchlistFilters {
  return {
    ...filters,
    director: facets.directors.includes(filters.director) ? filters.director : "",
    genre: facets.genres.includes(filters.genre) ? filters.genre : "",
  };
}
