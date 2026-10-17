import type { LanguageCode } from "../Language";
import type { Title } from "../Title";

// Langue originale d'un titre (JustWatch ne la fournit pas). null si inconnue.
export interface OriginalLanguageProvider {
  originalLanguage(title: Pick<Title, "type" | "tmdbId">): Promise<LanguageCode | null>;
}
