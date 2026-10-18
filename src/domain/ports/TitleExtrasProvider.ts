import type { LanguageCode } from "../Language";
import type { Title } from "../Title";
import type { Trailer } from "../TitleDetails";

// Ce que JustWatch ne fournit pas sur un titre : sa langue originale et sa bande-annonce.
export type TitleExtras = { originalLanguage: LanguageCode | null; trailer: Trailer | null };

// Ne lève jamais : champs à null si inconnus.
export interface TitleExtrasProvider {
  extras(title: Pick<Title, "type" | "tmdbId">): Promise<TitleExtras>;
}
