// Préférences de langue audio et sous-titres, appliquées par défaut aux filtres.

import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import { DEFAULT_PREFERENCES, isLanguageCode, type Preferences } from "@/domain/Preferences";

export class InvalidPreferencesError extends Error {
  constructor() {
    super("Langue invalide.");
  }
}

export class UserPreferences {
  constructor(private readonly repository: PreferencesRepository) {}

  async get(): Promise<Preferences> {
    return (await this.repository.get()) ?? DEFAULT_PREFERENCES;
  }

  async update(input: { audioLanguage: unknown; subtitleLanguage: unknown }): Promise<Preferences> {
    const preferences = { audioLanguage: parse(input.audioLanguage), subtitleLanguage: parse(input.subtitleLanguage) };
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
