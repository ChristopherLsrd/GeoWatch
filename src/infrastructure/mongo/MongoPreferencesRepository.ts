import type { Collection, Db } from "mongodb";
import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import { DEFAULT_NOTIFICATIONS, type Preferences } from "@/domain/Preferences";
import { DEFAULT_PRICE_THRESHOLD } from "@/domain/PriceHistory";

// Un seul utilisateur : un seul document.
// Seuil et notifications absents des préférences enregistrées avant leur ajout.
type PreferencesDocument = Omit<Preferences, "priceDropThreshold" | "notifications"> & {
  priceDropThreshold?: Preferences["priceDropThreshold"];
  notifications?: Partial<Preferences["notifications"]>;
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
          notifications: { ...DEFAULT_NOTIFICATIONS, ...doc.notifications },
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
        notifications: preferences.notifications,
      },
      { upsert: true },
    );
  }

  private async collection(): Promise<Collection<PreferencesDocument>> {
    return (await this.db()).collection<PreferencesDocument>("preferences");
  }
}
