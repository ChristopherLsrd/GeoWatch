import type { Collection, Db } from "mongodb";
import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import type { Preferences } from "@/domain/Preferences";

// Un seul utilisateur : un seul document.
type PreferencesDocument = Preferences & { _id: "user" };

export class MongoPreferencesRepository implements PreferencesRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async get(): Promise<Preferences | null> {
    const doc = await (await this.collection()).findOne({ _id: "user" });
    return doc ? { audioLanguage: doc.audioLanguage, subtitleLanguage: doc.subtitleLanguage } : null;
  }

  async save(preferences: Preferences): Promise<void> {
    await (await this.collection()).replaceOne(
      { _id: "user" },
      { audioLanguage: preferences.audioLanguage, subtitleLanguage: preferences.subtitleLanguage },
      { upsert: true },
    );
  }

  private async collection(): Promise<Collection<PreferencesDocument>> {
    return (await this.db()).collection<PreferencesDocument>("preferences");
  }
}
