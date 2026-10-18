// Adaptateur PersonCatalog : fiche d'une personne et filmographie, depuis l'API GraphQL de JustWatch.
// Une requête pour la fiche (texte français et anglais) et six listes (réalisation, interprétation, tous rôles × FR, US),
// puis les offres en abonnement des titres uniques dans les pays d'abonnement, par lots.

import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { isCountryCode, type CountryCode } from "@/domain/Country";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
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

// JustWatch refuse une requête de complexité supérieure à 350 000. Mesure du 2026-10-18 pour la requête
// des offres : environ 20 par titre, plus 150 par pays et par titre. On garde une marge.
const OFFERS_COMPLEXITY_BUDGET = 300_000;

export function offersBatchSize(countryCount: number): number {
  return Math.max(1, Math.floor(OFFERS_COMPLEXITY_BUDGET / (20 + 150 * countryCount)));
}

type FlatrateOffers = { package: { packageId: number } }[] | null | undefined;

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
    const { data, errors } = await this.client.postAllowingErrors<PersonResponse>({
      operationName: "GetPerson",
      variables: {
        nodeId: personId,
        directorFilter: { personId, personRole: "DIRECTOR" },
        actorFilter: { personId, personRole: "ACTOR" },
        allFilter: { personId },
      },
      query: PERSON_QUERY,
    });
    // Identifiant inconnu : JustWatch renvoie un nœud nul avec l'erreur « no merge target found ».
    // Toute autre erreur (même avec un nœud nul) est un échec passager : la page propose « Réessayer ».
    const unknownId = !errors || errors.every((e) => String((e as { message?: unknown })?.message ?? "").includes("no merge target found"));
    if (!data.node && unknownId) return null;
    if (errors || !data.node) {
      throw new CatalogUnavailableError(`Réponse JustWatch inattendue : ${JSON.stringify(errors).slice(0, 300)}`);
    }
    const content = data.node.fr;
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
        .map((edge) => toEntry(edge.node))
        .filter((entry) => entry !== null);
    const filmography: RawFilmography = { DIRECTOR: list("DIRECTOR"), ACTOR: list("ACTOR"), ALL: list("ALL") };

    const offers = await this.flatrateOffers(
      [...new Set([...filmography.DIRECTOR, ...filmography.ACTOR, ...filmography.ALL].map((e) => e.id))],
      countries,
    );
    for (const entry of [...filmography.DIRECTOR, ...filmography.ACTOR, ...filmography.ALL]) {
      entry.flatrate = offers.get(entry.id) ?? Object.fromEntries(countries.map((code) => [code, []]));
    }
    return { person, filmography };
  }

  // Plateformes en abonnement par titre et par pays, en lots qui restent sous la limite de complexité.
  private async flatrateOffers(titleIds: string[], countries: CountryCode[]): Promise<Map<string, FilmographyEntry["flatrate"]>> {
    const result = new Map<string, FilmographyEntry["flatrate"]>();
    if (countries.length === 0) return result;
    const offers = countries
      .map((code) => `flatrate_${code}: offers(country: ${code}, platform: WEB, filter: { monetizationTypes: [FLATRATE] }) { package { packageId } }`)
      .join("\n");
    const size = offersBatchSize(countries.length);
    for (let start = 0; start < titleIds.length; start += size) {
      const batch = titleIds.slice(start, start + size);
      const query = `
query GetPersonOffers(${batch.map((_, i) => `$id${i}: ID!`).join(", ")}) {
  ${batch.map((_, i) => `t${i}: node(id: $id${i}) { ... on MovieOrShow { ${offers} } }`).join("\n  ")}
}`;
      const data = await this.client.post<Record<string, Record<string, FlatrateOffers> | null>>({
        operationName: "GetPersonOffers",
        variables: Object.fromEntries(batch.map((id, i) => [`id${i}`, id])),
        query,
      });
      batch.forEach((id, i) => {
        const node = data[`t${i}`];
        result.set(
          id,
          Object.fromEntries(
            countries.map((code) => [code, [...new Set((node?.[`flatrate_${code}`] ?? []).map((o) => String(o.package.packageId)))]]),
          ),
        );
      });
    }
    return result;
  }
}

const PERSON_QUERY = (() => {
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
})();

// Les plateformes en abonnement sont ajoutées ensuite (flatrateOffers).
function toEntry(node: JustWatchPersonTitle): FilmographyEntry | null {
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
    flatrate: {},
  };
}
