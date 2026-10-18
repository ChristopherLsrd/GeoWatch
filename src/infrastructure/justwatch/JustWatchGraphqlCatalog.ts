// Adaptateur CatalogProvider pour l'API GraphQL non officielle de JustWatch.
// Requêtes reprises de simple-justwatch-python-api (graphql.py, query.py).

import { isCountryCode, type CountryCode } from "@/domain/Country";
import { isMonetizationType } from "@/domain/MonetizationType";
import type { Offer, Platform } from "@/domain/Offer";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { PersonRef } from "@/domain/PersonRef";
import type { Title } from "@/domain/Title";
import { MAX_CAST, type TitleDetails } from "@/domain/TitleDetails";
import { JustWatchClient, imageUrl } from "./JustWatchClient";

// La liste des plateformes d'un pays change rarement.
const PLATFORMS_TTL_MS = 24 * 3600 * 1000;

const TITLE_FIELDS = `
  id
  objectType
  content(country: $country, language: $language) {
    title
    originalTitle
    originalReleaseYear
    posterUrl(profile: S332, format: JPG)
    externalIds { imdbId tmdbId }
    directors: credits(role: DIRECTOR) { name personId }
  }
`;

const SEARCH_QUERY = `
query GetSearchTitles($searchTitlesFilter: TitleFilter!, $country: Country!, $language: Language!, $first: Int!) {
  popularTitles(country: $country, filter: $searchTitlesFilter, first: $first, sortBy: POPULAR, sortRandomSeed: 0) {
    edges { node { ${TITLE_FIELDS} } }
  }
}`;

const TITLE_QUERY = `
query GetTitleNode($nodeId: ID!, $country: Country!, $language: Language!) {
  node(id: $nodeId) {
    ... on MovieOrShow { ${TITLE_FIELDS} }
  }
}`;

const TITLE_DETAILS_QUERY = `
query GetTitleDetails($nodeId: ID!, $country: Country!, $language: Language!) {
  node(id: $nodeId) {
    ... on MovieOrShow {
      ${TITLE_FIELDS}
      details: content(country: $country, language: $language) {
        originalTitle
        shortDescription
        runtime
        originalReleaseDate
        genres { translation(language: $language) }
        scoring { imdbScore imdbVotes tmdbScore }
        credits { role name characterName personId }
      }
    }
  }
}`;

const PACKAGES_QUERY = `
query GetProviders($country: Country!) {
  packages(country: $country, platform: WEB, includeAddons: true) {
    packageId
    clearName
    monetizationTypes
    icon(profile: S100, format: PNG)
  }
}`;

const OFFER_FRAGMENT = `
fragment TitleOffer on Offer {
  monetizationType
  presentationType
  retailPrice(language: $language)
  retailPriceValue
  currency
  package { packageId clearName icon(profile: S100, format: PNG) }
  standardWebURL
  deeplinkURL(platform: WEB)
  audioLanguages
  subtitleLanguages
}`;

type JustWatchTitle = {
  id: string;
  objectType: string;
  content: {
    title: string;
    originalTitle?: string | null;
    originalReleaseYear: number | null;
    posterUrl: string | null;
    externalIds: { imdbId: string | null; tmdbId: string | null } | null;
    directors?: { name: string; personId?: number | null }[] | null;
  };
};

type JustWatchTitleDetails = JustWatchTitle & {
  details: {
    originalTitle: string | null;
    shortDescription: string | null;
    runtime: number | null;
    originalReleaseDate: string | null;
    genres: { translation: string | null }[] | null;
    scoring: { imdbScore: number | null; imdbVotes: number | null; tmdbScore: number | null } | null;
    credits: { role: string; name: string; characterName: string | null; personId?: number | null }[] | null;
  } | null;
};

type JustWatchOffer = {
  monetizationType: string;
  presentationType: string;
  retailPrice: string | null;
  retailPriceValue: number | null;
  currency: string | null;
  package: { packageId: number; clearName: string; icon: string | null };
  standardWebURL: string | null;
  deeplinkURL: string | null;
  audioLanguages: string[] | null;
  subtitleLanguages: string[] | null;
};

export type JustWatchOptions = {
  // Pays et langue utilisés pour la recherche et les noms des titres.
  country?: CountryCode;
  language?: string;
  searchResultCount?: number;
  fetch?: typeof fetch;
};

export class JustWatchGraphqlCatalog implements CatalogProvider {
  private readonly country: CountryCode;
  private readonly language: string;
  private readonly searchResultCount: number;
  private readonly client: JustWatchClient;
  private readonly platformsCache = new Map<CountryCode, { platforms: Platform[]; expiresAt: number }>();

  constructor(options: JustWatchOptions = {}) {
    this.country = options.country ?? "FR";
    this.language = options.language ?? "fr";
    this.searchResultCount = options.searchResultCount ?? 10;
    this.client = new JustWatchClient(options.fetch ?? fetch);
  }

  async searchTitles(query: string): Promise<Title[]> {
    const data = await this.client.post<{ popularTitles: { edges: { node: JustWatchTitle }[] } }>({
      operationName: "GetSearchTitles",
      variables: {
        first: this.searchResultCount,
        searchTitlesFilter: { searchQuery: query, includeTitlesWithoutUrl: true, objectTypes: ["MOVIE", "SHOW"] },
        country: this.country,
        language: this.language,
      },
      query: SEARCH_QUERY,
    });
    return data.popularTitles.edges.map((edge) => toTitle(edge.node)).filter((title) => title !== null);
  }

  async getTitle(titleId: string): Promise<Title | null> {
    const data = await this.client.post<{ node: JustWatchTitle | null }>({
      operationName: "GetTitleNode",
      variables: { nodeId: titleId, country: this.country, language: this.language },
      query: TITLE_QUERY,
    });
    return data.node?.content ? toTitle(data.node) : null;
  }

  async getTitleDetails(titleId: string): Promise<TitleDetails | null> {
    const data = await this.client.post<{ node: JustWatchTitleDetails | null }>({
      operationName: "GetTitleDetails",
      variables: { nodeId: titleId, country: this.country, language: this.language },
      query: TITLE_DETAILS_QUERY,
    });
    if (!data.node?.content) return null;
    const title = toTitle(data.node);
    return title ? toTitleDetails(title, data.node.details) : null;
  }

  // Une seule requête pour plusieurs pays, grâce à un alias GraphQL par pays.
  async getOffers(titleId: string, countries: CountryCode[]): Promise<Record<CountryCode, Offer[]>> {
    const codes = countries.filter(isCountryCode);
    const entries = codes
      .map((code) => `${code}: offers(country: ${code}, platform: WEB, filter: $filter) { ...TitleOffer }`)
      .join("\n");
    const query = `
query GetTitleOffers($nodeId: ID!, $language: Language!, $filter: OfferFilter!) {
  node(id: $nodeId) {
    ... on MovieOrShowOrSeasonOrEpisode { ${entries} }
  }
}
${OFFER_FRAGMENT}`;
    const data = await this.client.post<{ node: Record<string, JustWatchOffer[] | null> | null }>({
      operationName: "GetTitleOffers",
      variables: { nodeId: titleId, language: this.language, filter: { bestOnly: false } },
      query,
    });
    return Object.fromEntries(
      codes.map((code) => [code, (data.node?.[code] ?? []).map((offer) => toOffer(code, offer)).filter((o) => o !== null)]),
    );
  }

  async listSubscriptionPlatforms(country: CountryCode): Promise<Platform[]> {
    const cached = this.platformsCache.get(country);
    if (cached && cached.expiresAt > Date.now()) return cached.platforms;
    const data = await this.client.post<{
      packages: { packageId: number; clearName: string; monetizationTypes: string[] | null; icon: string | null }[];
    }>({ operationName: "GetProviders", variables: { country }, query: PACKAGES_QUERY });
    const platforms = data.packages
      .filter((p) => p.monetizationTypes?.includes("FLATRATE"))
      .map((p) => ({ id: String(p.packageId), name: p.clearName, iconUrl: imageUrl(p.icon) }))
      .sort((a, b) => a.name.localeCompare(b.name, "fr"));
    this.platformsCache.set(country, { platforms, expiresAt: Date.now() + PLATFORMS_TTL_MS });
    return platforms;
  }
}

function toTitle(node: JustWatchTitle): Title | null {
  if (node.objectType !== "MOVIE" && node.objectType !== "SHOW") return null;
  return {
    id: node.id,
    type: node.objectType,
    name: node.content.title,
    originalTitle: node.content.originalTitle || null,
    year: node.content.originalReleaseYear ?? null,
    posterUrl: imageUrl(node.content.posterUrl),
    imdbId: node.content.externalIds?.imdbId ?? null,
    tmdbId: node.content.externalIds?.tmdbId ?? null,
    directors: node.content.directors?.map((d) => d.name) ?? [],
    directorRefs: personRefs(node.content.directors),
  };
}

function personRefs(credits: { name: string; personId?: number | null }[] | null | undefined): PersonRef[] {
  return (credits ?? []).filter((c) => c.personId != null).map((c) => ({ id: `tp${c.personId}`, name: c.name }));
}

function toTitleDetails(title: Title, details: JustWatchTitleDetails["details"]): TitleDetails {
  const credits = details?.credits ?? [];
  return {
    ...title,
    originalTitle: details?.originalTitle || null,
    // JustWatch ne la fournit pas : complétée par GetTitle.
    originalLanguage: null,
    synopsis: details?.shortDescription?.trim() || null,
    runtime: details?.runtime || null,
    releaseDate: details?.originalReleaseDate ?? null,
    genres: (details?.genres ?? []).map((g) => g.translation).filter((g): g is string => !!g),
    imdbScore: details?.scoring?.imdbScore ?? null,
    imdbVotes: details?.scoring?.imdbVotes ?? null,
    tmdbScore: details?.scoring?.tmdbScore ?? null,
    directors: credits.filter((c) => c.role === "DIRECTOR").map((c) => c.name),
    cast: credits
      .filter((c) => c.role === "ACTOR")
      .slice(0, MAX_CAST)
      .map((c) => ({ name: c.name, character: c.characterName || null, personId: c.personId != null ? `tp${c.personId}` : null })),
  };
}

function cleanUrl(url: string | null | undefined): string | null {
  // Certaines URL arrivent échappées pour du HTML.
  return url?.replace(/&amp;/g, "&") ?? null;
}

function toOffer(country: CountryCode, offer: JustWatchOffer): Offer | null {
  if (!isMonetizationType(offer.monetizationType)) return null;
  return {
    country,
    platform: {
      id: String(offer.package.packageId),
      name: offer.package.clearName,
      iconUrl: imageUrl(offer.package.icon),
    },
    monetizationType: offer.monetizationType,
    // JustWatch préfixe les valeurs qui commencent par un chiffre (« _4K »).
    quality: offer.presentationType.replace(/^_/, ""),
    price: offer.retailPrice ?? null,
    priceValue: offer.retailPriceValue ?? null,
    currency: offer.currency ?? null,
    audioLanguages: offer.audioLanguages ?? [],
    subtitleLanguages: offer.subtitleLanguages ?? [],
    url: cleanUrl(offer.standardWebURL),
    // Lien qui ouvre directement la lecture sur la plateforme, quand JustWatch le connaît.
    deepLinkUrl: cleanUrl(offer.deeplinkURL),
  };
}
