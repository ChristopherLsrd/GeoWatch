// Filtres de la page d'une classification, dans l'URL de la page et dans celle de l'API.
// Pur (sans dépendance serveur) : partagé par la route et par le navigateur.
// Une valeur invalide est ignorée, remplacée par sa valeur par défaut.

import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { isKnownAgeRating } from "@/config/ageRatings";
import { ADVISORY_CATEGORIES, isSeverity, type ContentAdvisory } from "@/domain/ContentAdvisory";
import { RATING_SORTS, type RatingQuery, type RatingSort } from "@/domain/ports/RatingCatalog";

export type RatingFilters = Omit<RatingQuery, "country" | "code" | "after"> & { advisory: ContentAdvisory };

export const DEFAULT_RATING_FILTERS: RatingFilters = {
  type: null,
  search: null,
  genre: null,
  yearFrom: null,
  yearTo: null,
  imdbMin: null,
  homeOnly: false,
  sort: "popular",
  advisory: {},
};

const IMDB_MINIMUMS = [6, 7, 8];
const MAX_SEARCH_LENGTH = 100;

export function isRatingListKnown(country: string, code: string): boolean {
  return JUSTWATCH_COUNTRIES.includes(country) && isKnownAgeRating(country, code);
}

function year(value: string | null): number | null {
  if (!value || !/^\d{4}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1880 && n <= 2100 ? n : null;
}

export function parseRatingParams(params: URLSearchParams): { filters: RatingFilters; after: string | null } {
  const type = params.get("type");
  const search = params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH) || null;
  const genre = params.get("genre");
  const imdb = Number(params.get("imdb"));
  const sort = params.get("sort");
  const after = params.get("after");
  const advisory: ContentAdvisory = {};
  for (const category of ADVISORY_CATEGORIES) {
    const value = params.get(category);
    if (isSeverity(value)) advisory[category] = value;
  }
  return {
    filters: {
      type: type === "MOVIE" || type === "SHOW" ? type : null,
      search,
      genre: genre && /^[a-z]{3}$/.test(genre) ? genre : null,
      yearFrom: year(params.get("from")),
      yearTo: year(params.get("to")),
      imdbMin: IMDB_MINIMUMS.includes(imdb) ? imdb : null,
      homeOnly: params.get("home") === "1",
      sort: RATING_SORTS.includes(sort as RatingSort) ? (sort as RatingSort) : "popular",
      advisory,
    },
    after: after && after.length <= 200 && /^[A-Za-z0-9+/=_-]+$/.test(after) ? after : null,
  };
}

export function ratingSearchParams(filters: RatingFilters, after: string | null = null): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.search) params.set("q", filters.search);
  if (filters.genre) params.set("genre", filters.genre);
  if (filters.yearFrom !== null) params.set("from", String(filters.yearFrom));
  if (filters.yearTo !== null) params.set("to", String(filters.yearTo));
  if (filters.imdbMin !== null) params.set("imdb", String(filters.imdbMin));
  if (filters.homeOnly) params.set("home", "1");
  if (filters.sort !== "popular") params.set("sort", filters.sort);
  for (const category of ADVISORY_CATEGORIES) {
    const value = filters.advisory[category];
    if (value) params.set(category, value);
  }
  if (after) params.set("after", after);
  return params;
}
