import type { Collection, Db } from "mongodb";
import { parisDay } from "@/domain/CalendarDay";
import type { CountryCode } from "@/domain/Country";
import type { Filmography, Person } from "@/domain/Person";
import type { CachedPerson, PersonCache } from "@/domain/ports/PersonCache";

type PersonDocument = {
  // « tp1725 » : une seule fiche par personne, la plus récente.
  _id: string;
  person: Person;
  filmography: Filmography;
  flatrateCountries: CountryCode[];
  fetchedAt: Date;
  // Jour de Paris de la lecture, pour la validité du cache.
  day: string;
};

// Purge des fiches anciennes (offre gratuite d'Atlas limitée à 512 Mo).
const RETENTION_SECONDS = 7 * 24 * 3600;

export class MongoPersonCache implements PersonCache {
  private collectionReady: Promise<Collection<PersonDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async find(personId: string, day: string): Promise<CachedPerson | null> {
    const doc = await (await this.collection()).findOne({ _id: personId, day });
    return doc ? { person: doc.person, filmography: doc.filmography, flatrateCountries: doc.flatrateCountries, fetchedAt: doc.fetchedAt } : null;
  }

  async save(entry: CachedPerson): Promise<void> {
    await (await this.collection()).replaceOne(
      { _id: entry.person.id },
      { ...entry, day: parisDay(entry.fetchedAt) },
      { upsert: true },
    );
  }

  private collection(): Promise<Collection<PersonDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<PersonDocument>("people");
      await collection.createIndex({ fetchedAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
      return collection;
    })();
    // En cas d'échec (Mongo injoignable), on réessaiera au prochain appel.
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}
