// Préférences de langue audio et sous-titres, appliquées par défaut aux filtres, et seuil des alertes de prix.

import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import { DEFAULT_PREFERENCES, isLanguageCode, ORIGINAL_LANGUAGE, type Preferences } from "@/domain/Preferences";
import type { PriceThreshold } from "@/domain/PriceHistory";

export class InvalidPreferencesError extends Error {
  constructor(message = "Langue invalide.") {
    super(message);
  }
}

// Montant (dans la devise) et pourcentage.
const MAX_THRESHOLD = 100;

export class UserPreferences {
  constructor(private readonly repository: PreferencesRepository) {}

  async get(): Promise<Preferences> {
    return (await this.repository.get()) ?? DEFAULT_PREFERENCES;
  }

  // Un champ absent garde sa valeur enregistrée.
  async update(input: { audioLanguage?: unknown; subtitleLanguage?: unknown; priceDropThreshold?: unknown }): Promise<Preferences> {
    const current = await this.get();
    const preferences: Preferences = {
      audioLanguage:
        input.audioLanguage === undefined
          ? current.audioLanguage
          : input.audioLanguage === ORIGINAL_LANGUAGE
            ? ORIGINAL_LANGUAGE
            : parse(input.audioLanguage),
      subtitleLanguage: input.subtitleLanguage === undefined ? current.subtitleLanguage : parse(input.subtitleLanguage),
      priceDropThreshold:
        input.priceDropThreshold === undefined ? current.priceDropThreshold : parseThreshold(input.priceDropThreshold),
    };
    await this.repository.save(preferences);
    return preferences;
  }
}

// null ou "" : pas de préférence.
function parse(value: unknown): string | null {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || !isLanguageCode(value)) throw new InvalidPreferencesError();
  return value;
}

// Montant arrondi au centime.
function parseThreshold(value: unknown): PriceThreshold {
  const { amount, percent } = (value ?? {}) as Record<string, unknown>;
  if (!isBounded(amount) || !isBounded(percent)) throw new InvalidPreferencesError("Seuil de baisse invalide.");
  return { amount: Math.round(amount * 100) / 100, percent };
}

function isBounded(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= MAX_THRESHOLD;
}
