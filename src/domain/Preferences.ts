import type { LanguageCode } from "./Language";
import { DEFAULT_PRICE_THRESHOLD, type PriceThreshold } from "./PriceHistory";

// Langues par défaut des filtres sur la page d'un titre. null : pas de filtre.
// audioLanguage peut valoir ORIGINAL_LANGUAGE : la langue originale de chaque titre.
// priceDropThreshold : seuil des alertes de baisse de prix.
export type Preferences = {
  audioLanguage: LanguageCode | typeof ORIGINAL_LANGUAGE | null;
  subtitleLanguage: LanguageCode | null;
  priceDropThreshold: PriceThreshold;
};

export const ORIGINAL_LANGUAGE = "original";

export const DEFAULT_PREFERENCES: Preferences = {
  audioLanguage: null,
  subtitleLanguage: null,
  priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
};

// « fr », « pt-BR »…
export function isLanguageCode(value: string): boolean {
  return /^[a-z]{2,3}(-[A-Z]{2})?$/.test(value);
}
