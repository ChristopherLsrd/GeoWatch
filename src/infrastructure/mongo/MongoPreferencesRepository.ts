import type { Collection, Db } from "mongodb";
import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import type { Preferences } from "@/domain/Preferences";
import { DEFAULT_PRICE_THRESHOLD } from "@/domain/PriceHistory";

// Un seul utilisateur : un seul document.
// Seuil absent des préférences enregistrées avant son ajout.
type PreferencesDocument = Omit<Preferences, "priceDropThreshold"> & {
  priceDropThreshold?: Preferences["priceDropThreshold"];
  _id: "user";
};

export class MongoPreferencesRepository implements PreferencesRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async get(): Promise<Preferences | null> {
    const doc = await (await this.collection()).findOne({ _id: "user" });
    return doc
      ? {
          audioLanguage: doc.audioLanguage,
          subtitleLanguage: doc.subtitleLanguage,
          priceDropThreshold: doc.priceDropThreshold ?? DEFAULT_PRICE_THRESHOLD,
        }
      : null;
  }

  async save(preferences: Preferences): Promise<void> {
    await (await this.collection()).replaceOne(
      { _id: "user" },
      {
        audioLanguage: preferences.audioLanguage,
        subtitleLanguage: preferences.subtitleLanguage,
        priceDropThreshold: preferences.priceDropThreshold,
      },
      { upsert: true },
    );
  }

  private async collection(): Promise<Collection<PreferencesDocument>> {
    return (await this.db()).collection<PreferencesDocument>("preferences");
  }
}
