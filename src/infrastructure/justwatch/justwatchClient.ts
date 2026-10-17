// Client minimal de l'API GraphQL non officielle de JustWatch.
// Requêtes reprises de simple-justwatch-python-api (graphql.py, query.py).

const JUSTWATCH_GRAPHQL_URL = "https://apis.justwatch.com/graphql";

const OFFER_FRAGMENT = `
fragment TitleOffer on Offer {
  monetizationType
  presentationType
  retailPrice(language: $language)
  retailPriceValue
  currency
  package {
    packageId
    clearName
    technicalName
    icon(profile: S100, format: $formatOfferIcon)
  }
  standardWebURL
  audioLanguages
  subtitleLanguages
}
`;

const SEARCH_QUERY = `
query GetSearchTitles(
  $searchTitlesFilter: TitleFilter!,
  $country: Country!,
  $language: Language!,
  $first: Int!
) {
  popularTitles(
    country: $country
    filter: $searchTitlesFilter
    first: $first
    sortBy: POPULAR
    sortRandomSeed: 0
  ) {
    edges {
      node {
        id
        objectType
        content(country: $country, language: $language) {
          title
          originalReleaseYear
          externalIds { imdbId tmdbId }
        }
      }
    }
  }
}
`;

export type JustWatchOffer = {
  monetizationType: string;
  presentationType: string;
  retailPrice: string | null;
  retailPriceValue: number | null;
  currency: string | null;
  package: {
    packageId: number;
    clearName: string;
    technicalName: string;
    icon: string | null;
  };
  standardWebURL: string | null;
  audioLanguages: string[] | null;
  subtitleLanguages: string[] | null;
};

export type JustWatchSearchResult = {
  id: string;
  objectType: string;
  content: {
    title: string;
    originalReleaseYear: number | null;
    externalIds: { imdbId: string | null; tmdbId: string | null };
  };
};

export class JustWatchError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly body?: string,
  ) {
    super(message);
  }
}

async function postGraphql<T>(body: object): Promise<T> {
  const response = await fetch(JUSTWATCH_GRAPHQL_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await response.text();
  if (!response.ok) {
    throw new JustWatchError(`HTTP ${response.status}`, response.status, text.slice(0, 500));
  }
  const json = JSON.parse(text);
  if (json.errors) {
    throw new JustWatchError("Erreur GraphQL", response.status, JSON.stringify(json.errors).slice(0, 500));
  }
  return json.data as T;
}

export async function searchTitles(
  query: string,
  country: string,
  language: string,
  count = 5,
): Promise<JustWatchSearchResult[]> {
  const data = await postGraphql<{ popularTitles: { edges: { node: JustWatchSearchResult }[] } }>({
    operationName: "GetSearchTitles",
    variables: {
      first: count,
      searchTitlesFilter: { searchQuery: query, includeTitlesWithoutUrl: true },
      country: country.toUpperCase(),
      language,
    },
    query: SEARCH_QUERY,
  });
  return data.popularTitles.edges.map((edge) => edge.node);
}

// Une seule requête pour plusieurs pays, grâce à un alias GraphQL par pays.
export async function offersForCountries(
  nodeId: string,
  countries: string[],
  language: string,
): Promise<Record<string, JustWatchOffer[]>> {
  const codes = countries.map((c) => c.toUpperCase()).filter((c) => /^[A-Z]{2}$/.test(c));
  const entries = codes
    .map((code) => `${code}: offers(country: ${code}, platform: WEB, filter: $filter) { ...TitleOffer }`)
    .join("\n");
  const query = `
query GetTitleOffers($nodeId: ID!, $language: Language!, $formatOfferIcon: ImageFormat, $filter: OfferFilter!) {
  node(id: $nodeId) {
    ... on MovieOrShowOrSeasonOrEpisode {
      ${entries}
    }
  }
}
${OFFER_FRAGMENT}`;
  const data = await postGraphql<{ node: Record<string, JustWatchOffer[]> | null }>({
    operationName: "GetTitleOffers",
    variables: { nodeId, language, formatOfferIcon: "PNG", filter: { bestOnly: false } },
    query,
  });
  return Object.fromEntries(codes.map((code) => [code, data.node?.[code] ?? []]));
}
