// Adaptateur PersonCatalog : fiche d'une personne et filmographie, depuis l'API GraphQL de JustWatch.
// Une requête pour la fiche (texte français et anglais) et six listes (réalisation, interprétation, tous rôles × FR, US),
// puis les offres en abonnement des titres uniques dans les pays d'abonnement, par lots.

import { JUSTWATCH_COUNTRIES } from "@/config/countries";
import { isCountryCode, type CountryCode } from "@/domain/Country";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { CatalogPerson, PersonCatalog, RawFilmography } from "@/domain/ports/PersonCatalog";
import { imageUrl, JustWatchClient } from "./JustWatchClient";
import { CARD_CONTENT_FIELDS, flatrateOffers, toCardEntry, type JustWatchCardTitle } from "./titleCards";

const LIST_COUNTRIES = ["FR", "US"] as const;
const LIST_SIZE = 100;
const LISTS = [
  { key: "DIRECTOR", filter: "$directorFilter" },
  { key: "ACTOR", filter: "$actorFilter" },
  { key: "ALL", filter: "$allFilter" },
] as const;

type PersonResponse = {
  node: {
    id: string;
    fr?: { fullName: string; portraitUrl: string | null; dateOfBirth: string | null; shortDescription: string | null } | null;
    en?: { shortDescription: string | null } | null;
  } | null;
} & Record<string, { edges: { node: JustWatchCardTitle }[] } | null>;

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
        .map((edge) => toCardEntry(edge.node))
        .filter((entry) => entry !== null);
    const filmography: RawFilmography = { DIRECTOR: list("DIRECTOR"), ACTOR: list("ACTOR"), ALL: list("ALL") };

    const offers = await flatrateOffers(
      this.client,
      [...new Set([...filmography.DIRECTOR, ...filmography.ACTOR, ...filmography.ALL].map((e) => e.id))],
      countries,
    );
    for (const entry of [...filmography.DIRECTOR, ...filmography.ACTOR, ...filmography.ALL]) {
      entry.flatrate = offers.get(entry.id) ?? Object.fromEntries(countries.map((code) => [code, []]));
    }
    return { person, filmography };
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
      content(country: ${country}, language: "fr") {${CARD_CONTENT_FIELDS}
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
