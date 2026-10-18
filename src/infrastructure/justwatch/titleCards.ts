// Cartes de titres JustWatch (filmographie d'une personne, titres d'une classification) :
// champs demandés, conversion, et plateformes en abonnement par pays pour le badge « Chez moi ».

import type { CountryCode } from "@/domain/Country";
import type { FilmographyEntry } from "@/domain/Person";
import { imageUrl, type JustWatchClient } from "./JustWatchClient";

// Champs d'une carte, à placer dans content(country: …, language: "fr") { … }.
export const CARD_CONTENT_FIELDS = `
        title
        originalTitle
        originalReleaseYear
        runtime
        posterUrl(profile: S332, format: JPG)
        externalIds { imdbId tmdbId }
        scoring { imdbScore tmdbScore }`;

// JustWatch refuse une requête de complexité supérieure à 350 000. Mesure du 2026-10-18 pour la requête
// des offres : environ 20 par titre, plus 150 par pays et par titre. On garde une marge.
const OFFERS_COMPLEXITY_BUDGET = 300_000;

export function offersBatchSize(countryCount: number): number {
  return Math.max(1, Math.floor(OFFERS_COMPLEXITY_BUDGET / (20 + 150 * countryCount)));
}

type FlatrateOffers = { package: { packageId: number } }[] | null | undefined;

export type JustWatchCardTitle = {
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

// Les plateformes en abonnement sont ajoutées ensuite (flatrateOffers).
export function toCardEntry(node: JustWatchCardTitle): FilmographyEntry | null {
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

// Plateformes en abonnement par titre et par pays, en lots qui restent sous la limite de complexité.
export async function flatrateOffers(
  client: JustWatchClient,
  titleIds: string[],
  countries: CountryCode[],
): Promise<Map<string, FilmographyEntry["flatrate"]>> {
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
    const data = await client.post<Record<string, Record<string, FlatrateOffers> | null>>({
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
