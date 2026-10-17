import type { LanguageCode } from "./Language";

// Langues par défaut des filtres sur la page d'un titre. null : pas de filtre.
// audioLanguage peut valoir ORIGINAL_LANGUAGE : la langue originale de chaque titre.
export type Preferences = {
  audioLanguage: LanguageCode | typeof ORIGINAL_LANGUAGE | null;
  subtitleLanguage: LanguageCode | null;
};

export const ORIGINAL_LANGUAGE = "original";

export const DEFAULT_PREFERENCES: Preferences = { audioLanguage: null, subtitleLanguage: null };

// « fr », « pt-BR »…
export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(value);
}
