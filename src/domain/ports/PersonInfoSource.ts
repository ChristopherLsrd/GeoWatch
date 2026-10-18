import type { Title } from "../Title";

// De quoi retrouver la personne ailleurs : son nom et des titres de sa filmographie.
export type PersonInfoHint = { name: string; titles: Pick<Title, "type" | "tmdbId">[] };

export type ExternalPersonInfo = {
  biography: string | null;
  photoUrl: string | null;
  deathDate: string | null;
  sourceUrl: string;
};

// Source complémentaire (TMDB, Wikipédia). Ne lève jamais : null si rien de fiable.
export interface PersonInfoSource {
  readonly source: "tmdb" | "wikipedia";
  find(hint: PersonInfoHint): Promise<ExternalPersonInfo | null>;
}
