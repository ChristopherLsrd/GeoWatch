// Adaptateur PersonCatalog : fiche d'une personne et filmographie, depuis l'API GraphQL de JustWatch.
// Une seule requête : la fiche (texte français et anglais) et six listes (réalisation, interprétation, tous rôles × FR, US).

import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { isCountryCode, type CountryCode } from "@/domain/Country";
import type { FilmographyEntry } from "@/domain/Person";
import type { CatalogPerson, PersonCatalog, RawFilmography } from "@/domain/ports/PersonCatalog";
import { imageUrl, JustWatchClient } from "./JustWatchClient";

const LIST_COUNTRIES = ["FR", "US"] as const;
const LIST_SIZE = 100;
const LISTS = [
  { key: "DIRECTOR", filter: "$directorFilter" },
  { key: "ACTOR", filter: "$actorFilter" },
  { key: "ALL", filter: "$allFilter" },
] as const;

type JustWatchPersonTitle = {
  id: string;
  objectType: string;
  content: {
    title: string;
    originalTitle: string | null;
    originalReleaseYear: number | null;
    runtime: number | null;
    posterUrl: string | null;
    externalIds: { imdbId: string | null; tmdbId: string | null } | null;
    scoring: { imdbScore: number | null; tmdbScore: number | null } | null;
  } | null;
  [flatrate: `flatrate_${string}`]: { package: { packageId: number } }[] | null | undefined;
};

type PersonResponse = {
  node: {
    id: string;
    fr?: { fullName: string; portraitUrl: string | null; dateOfBirth: string | null; shortDescription: string | null } | null;
    en?: { shortDescription: string | null } | null;
  } | null;
} & Record<string, { edges: { node: JustWatchPersonTitle }[] } | null>;

export class JustWatchPersonCatalog implements PersonCatalog {
  private readonly client: JustWatchClient;

  constructor(options: { fetch?: typeof fetch } = {}) {
    this.client = new JustWatchClient(options.fetch ?? fetch);
  }

  async getPerson(personId: string, flatrateCountries: CountryCode[]) {
    // isCountryCode ne vérifie que la forme (« XX » passe) : on garde les seuls pays couverts par JustWatch.
    const countries = flatrateCountries.filter((code) => isCountryCode(code) && JUSTWATCH_COUNTRIES.includes(code));
    const data = await this.client.post<PersonResponse>({
      operationName: "GetPerson",
      variables: {
        nodeId: personId,
        directorFilter: { personId, personRole: "DIRECTOR" },
        actorFilter: { personId, personRole: "ACTOR" },
        allFilter: { personId },
      },
      query: personQuery(countries),
    });
    const content = data.node?.fr;
    if (!content?.fullName) return null;

    const person: CatalogPerson = {
      id: personId,
      name: content.fullName,
      birthDate: content.dateOfBirth || null,
      photoUrl: imageUrl(content.portraitUrl),
      biographyFr: content.shortDescription || null,
      biographyEn: data.node?.en?.shortDescription || null,
    };
    const list = (key: string) =>
      LIST_COUNTRIES.flatMap((c) => data[`${key}_${c}`]?.edges ?? [])
        .map((edge) => toEntry(edge.node, countries))
        .filter((entry) => entry !== null);
    const filmography: RawFilmography = { DIRECTOR: list("DIRECTOR"), ACTOR: list("ACTOR"), ALL: list("ALL") };
    return { person, filmography };
  }
}

function personQuery(countries: CountryCode[]): string {
  const offers = countries
    .map((code) => `flatrate_${code}: offers(country: ${code}, platform: WEB, filter: { monetizationTypes: [FLATRATE] }) { package { packageId } }`)
    .join("\n");
  const lists = LISTS.flatMap(({ key, filter }) =>
    LIST_COUNTRIES.map(
      (country) => `
  ${key}_${country}: popularTitles(country: ${country}, first: ${LIST_SIZE}, sortBy: RELEASE_YEAR, filter: ${filter}) {
    edges { node {
      id
      objectType
      content(country: ${country}, language: "fr") {
        title
        originalTitle
        originalReleaseYear
        runtime
        posterUrl(profile: S332, format: JPG)
        externalIds { imdbId tmdbId }
        scoring { imdbScore tmdbScore }
      }
      ${offers}
    } }
  }`,
    ),
  ).join("\n");
  return `
query GetPerson($nodeId: ID!, $directorFilter: TitleFilter!, $actorFilter: TitleFilter!, $allFilter: TitleFilter!) {
  node(id: $nodeId) {
    id
    ... on Person {
      fr: content(country: FR, language: "fr") { fullName portraitUrl(profile: S332) dateOfBirth shortDescription }
      en: content(country: US, language: "en") { shortDescription }
    }
  }
  ${lists}
}`;
}

function toEntry(node: JustWatchPersonTitle, countries: CountryCode[]): FilmographyEntry | null {
  if ((node.objectType !== "MOVIE" && node.objectType !== "SHOW") || !node.content) return null;
  const { content } = node;
  return {
    id: node.id,
    type: node.objectType,
    name: content.title,
    originalTitle: content.originalTitle || null,
    year: content.originalReleaseYear ?? null,
    posterUrl: imageUrl(content.posterUrl),
    imdbId: content.externalIds?.imdbId ?? null,
    tmdbId: content.externalIds?.tmdbId ?? null,
    runtime: content.runtime || null,
    imdbScore: content.scoring?.imdbScore ?? null,
    tmdbScore: content.scoring?.tmdbScore ?? null,
    flatrate: Object.fromEntries(
      countries.map((code) => [code, [...new Set((node[`flatrate_${code}`] ?? []).map((o) => String(o.package.packageId)))]]),
    ),
  };
}
