import type { AnyBulkWriteOperation, Collection, Db } from "mongodb";
import type { Availability } from "@/domain/Availability";
import { parisDay } from "@/domain/CalendarDay";
import type { CountryCode } from "@/domain/Country";
import type { Offer } from "@/domain/Offer";
import type { AvailabilityCache } from "@/domain/ports/AvailabilityCache";

type AvailabilityDocument = {
  // « tm92641:FR » : une seule disponibilité par titre et par pays, la plus récente.
  _id: string;
  titleId: string;
  country: CountryCode;
  offers: Offer[];
  fetchedAt: Date;
  // Jour de Paris de la vérification, pour la validité du cache.
  day: string;
};

// Purge des données anciennes (offre gratuite d'Atlas limitée à 512 Mo).
// Les titres de la liste à voir sont revérifiés chaque jour par le cron.
const RETENTION_SECONDS = 7 * 24 * 3600;

export class MongoAvailabilityCache implements AvailabilityCache {
  private collectionReady: Promise<Collection<AvailabilityDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async find(titleId: string, countries: CountryCode[], day: string): Promise<Availability[]> {
    const collection = await this.collection();
    const docs = await collection.find({ _id: { $in: countries.map((c) => documentId(titleId, c)) }, day }).toArray();
    return docs.map(({ titleId, country, offers, fetchedAt }) => ({ titleId, country, offers, fetchedAt }));
  }

  async save(availabilities: Availability[]): Promise<void> {
    if (availabilities.length === 0) return;
    const collection = await this.collection();
    const operations: AnyBulkWriteOperation<AvailabilityDocument>[] = availabilities.map((a) => ({
      replaceOne: {
        filter: { _id: documentId(a.titleId, a.country) },
        replacement: { titleId: a.titleId, country: a.country, offers: a.offers, fetchedAt: a.fetchedAt, day: parisDay(a.fetchedAt) },
        upsert: true,
      },
    }));
    await collection.bulkWrite(operations, { ordered: false });
  }

  private collection(): Promise<Collection<AvailabilityDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<AvailabilityDocument>("availabilities");
      await collection.createIndex({ fetchedAt: 1 }, { expireAfterSeconds: RETENTION_SECONDS });
      return collection;
    })();
    // En cas d'échec (Mongo injoignable), on réessaiera au prochain appel.
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}

function documentId(titleId: string, country: CountryCode): string {
  return `${titleId}:${country}`;
}
