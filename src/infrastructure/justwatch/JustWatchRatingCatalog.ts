// Adaptateur RatingCatalog : titres d'une classification d'âge, depuis l'API GraphQL de JustWatch.
// Filtres et tris faits par JustWatch (popularTitles) ; pagination par curseur.

import type { CountryCode } from "@/domain/Country";
import type { FilmographyEntry } from "@/domain/Person";
import { RATING_PAGE_SIZE, type Genre, type RatingCatalog, type RatingPage, type RatingQuery, type RatingSort } from "@/domain/ports/RatingCatalog";
import { JustWatchClient } from "./JustWatchClient";
import { CARD_CONTENT_FIELDS, flatrateOffers, toCardEntry, type JustWatchCardTitle } from "./titleCards";

// La liste des plateformes d'un pays change rarement.
const PACKAGES_TTL_MS = 24 * 3600 * 1000;

const SORTS: Record<RatingSort, string> = { popular: "POPULAR", imdb: "IMDB_SCORE", year: "RELEASE_YEAR", alpha: "ALPHABETICAL" };

const LIST_QUERY = `
query GetRatedTitles($country: Country!, $first: Int!, $after: String, $sortBy: PopularTitlesSorting!, $filter: TitleFilter!) {
  popularTitles(country: $country, first: $first, after: $after, sortBy: $sortBy, filter: $filter) {
    totalCount
    pageInfo { endCursor hasNextPage }
    edges { node {
      id
      objectType
      content(country: $country, language: "fr") {${CARD_CONTENT_FIELDS}
      }
    } }
  }
}`;

const PACKAGES_QUERY = `
query GetPackageCodes($country: Country!) {
  packages(country: $country, platform: WEB, includeAddons: true) { packageId shortName }
}`;

const GENRES_QUERY = `
query GetGenres {
  genres { shortName translation(language: "fr") }
}`;

type ListResponse = {
  popularTitles: { totalCount: number; pageInfo: { endCursor: string | null; hasNextPage: boolean }; edges: { node: JustWatchCardTitle }[] };
};

export class JustWatchRatingCatalog implements RatingCatalog {
  private readonly client: JustWatchClient;
  // Code court (« nfx ») par identifiant de plateforme (« 8 »), par pays : le filtre packages n'accepte que les codes courts.
  private readonly packageCodes = new Map<CountryCode, { codes: Map<string, string>; expiresAt: number }>();
  private genresCache: Genre[] | null = null;

  constructor(options: { fetch?: typeof fetch } = {}) {
    this.client = new JustWatchClient(options.fetch ?? fetch);
  }

  async list(query: RatingQuery, homePlatformIds: string[]): Promise<RatingPage> {
    let packages: string[] | null = null;
    if (query.homeOnly) {
      const codes = await this.codesFor(query.country);
      packages = [...new Set(homePlatformIds.map((id) => codes.get(id)).filter((code): code is string => !!code))];
      if (packages.length === 0) return { titles: [], total: 0, nextCursor: null };
    }
    const data = await this.client.post<ListResponse>({
      operationName: "GetRatedTitles",
      variables: {
        country: query.country,
        first: RATING_PAGE_SIZE,
        after: query.after,
        sortBy: SORTS[query.sort],
        filter: toFilter(query, packages),
      },
      query: LIST_QUERY,
    });
    const { totalCount, pageInfo, edges } = data.popularTitles;
    return {
      titles: edges
        .map((edge) => toCardEntry(edge.node))
        .filter((entry) => entry !== null)
        .map(({ flatrate: _flatrate, ...title }) => title),
      total: totalCount,
      nextCursor: pageInfo.hasNextPage ? pageInfo.endCursor : null,
    };
  }

  flatrate(titleIds: string[], countries: CountryCode[]): Promise<Map<string, FilmographyEntry["flatrate"]>> {
    return flatrateOffers(this.client, titleIds, countries);
  }

  async genres(): Promise<Genre[]> {
    if (this.genresCache) return this.genresCache;
    const data = await this.client.post<{ genres: { shortName: string; translation: string | null }[] }>({
      operationName: "GetGenres",
      variables: {},
      query: GENRES_QUERY,
    });
    this.genresCache = data.genres
      .filter((g) => g.shortName && g.translation)
      .map((g) => ({ code: g.shortName, label: g.translation! }))
      .sort((a, b) => a.label.localeCompare(b.label, "fr"));
    return this.genresCache;
  }

  private async codesFor(country: CountryCode): Promise<Map<string, string>> {
    const cached = this.packageCodes.get(country);
    if (cached && cached.expiresAt > Date.now()) return cached.codes;
    const data = await this.client.post<{ packages: { packageId: number; shortName: string }[] }>({
      operationName: "GetPackageCodes",
      variables: { country },
      query: PACKAGES_QUERY,
    });
    const codes = new Map(data.packages.map((p) => [String(p.packageId), p.shortName]));
    this.packageCodes.set(country, { codes, expiresAt: Date.now() + PACKAGES_TTL_MS });
    return codes;
  }
}

function toFilter(query: RatingQuery, packages: string[] | null): Record<string, unknown> {
  const filter: Record<string, unknown> = {
    ageCertifications: [query.code],
    objectTypes: query.type ? [query.type] : ["MOVIE", "SHOW"],
  };
  if (query.search) filter.searchQuery = query.search;
  if (query.genre) filter.genres = [query.genre];
  if (query.yearFrom !== null || query.yearTo !== null) {
    filter.releaseYear = {
      ...(query.yearFrom !== null ? { min: query.yearFrom } : {}),
      ...(query.yearTo !== null ? { max: query.yearTo } : {}),
    };
  }
  if (query.imdbMin !== null) filter.imdbScore = { min: query.imdbMin };
  if (packages) {
    filter.packages = packages;
    filter.monetizationTypes = ["FLATRATE"];
  }
  return filter;
}
