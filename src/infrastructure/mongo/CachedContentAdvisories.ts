// Cache Mongo du guide parental, valable 30 jours par identifiant IMDb : il change peu,
// et chaque titre trouvé dans le cache évite une requête à IMDb.
// Un titre sans guide parental est gardé aussi (guide vide). Une panne de Mongo n'empêche pas la lecture.

import type { Collection, Db } from "mongodb";
import type { ContentAdvisory } from "@/domain/ContentAdvisory";
import type { ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import { measure } from "../timing/requestTiming";

export const ADVISORY_TTL_MS = 30 * 24 * 3600 * 1000;

type AdvisoryDocument = {
  // Identifiant IMDb (« tt1375666 »).
  _id: string;
  advisory: ContentAdvisory;
  fetchedAt: Date;
};

export class CachedContentAdvisories implements ContentAdvisoryProvider {
  private collectionReady: Promise<Collection<AdvisoryDocument>> | null = null;

  constructor(
    private readonly source: ContentAdvisoryProvider,
    private readonly db: () => Promise<Db>,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async advisories(imdbIds: string[]): Promise<Map<string, ContentAdvisory>> {
    const ids = [...new Set(imdbIds)];
    const result = new Map<string, ContentAdvisory>();
    if (ids.length === 0) return result;

    const since = new Date(this.now().getTime() - ADVISORY_TTL_MS);
    const cached = await measure("mongo", async () =>
      (await this.collection()).find({ _id: { $in: ids }, fetchedAt: { $gt: since } }).toArray(),
    ).catch((error) => {
      console.error("Lecture du cache du guide parental impossible", error);
      return [] as AdvisoryDocument[];
    });
    for (const doc of cached) if (Object.keys(doc.advisory).length > 0) result.set(doc._id, doc.advisory);

    const known = new Set(cached.map((doc) => doc._id));
    const missing = ids.filter((id) => !known.has(id));
    if (missing.length === 0) return result;

    const fetched = await this.source.advisories(missing);
    for (const [id, advisory] of fetched) result.set(id, advisory);
    const fetchedAt = this.now();
    await measure("mongo", async () =>
      (await this.collection()).bulkWrite(
        missing.map((id) => ({
          replaceOne: { filter: { _id: id }, replacement: { advisory: fetched.get(id) ?? {}, fetchedAt }, upsert: true },
        })),
      ),
    ).catch((error) => {
      console.error("Écriture du cache du guide parental impossible", error);
    });
    return result;
  }

  private collection(): Promise<Collection<AdvisoryDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<AdvisoryDocument>("advisories");
      // Purge des guides périmés (offre gratuite d'Atlas limitée à 512 Mo).
      await collection.createIndex({ fetchedAt: 1 }, { expireAfterSeconds: ADVISORY_TTL_MS / 1000 });
      return collection;
    })();
    // En cas d'échec (Mongo injoignable), on réessaiera au prochain appel.
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}
