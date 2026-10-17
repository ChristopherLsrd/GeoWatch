import type { Preferences } from "../Preferences";

export interface PreferencesRepository {
  // null si jamais enregistrées.
  get(): Promise<Preferences | null>;
  save(preferences: Preferences): Promise<void>;
}
