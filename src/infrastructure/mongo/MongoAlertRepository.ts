import type { Collection, Db } from "mongodb";
import type { AlertRepository } from "@/domain/ports/AlertRepository";
import type { Alert } from "@/domain/WatchStatus";

type AlertDocument = Omit<Alert, "id"> & { _id: string };

// Les alertes non masquées disparaissent d'elles-mêmes au bout de 30 jours.
const TTL_SECONDS = 30 * 24 * 3600;

export class MongoAlertRepository implements AlertRepository {
  private collectionReady: Promise<Collection<AlertDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async list(): Promise<Alert[]> {
    const docs = await (await this.collection()).find().sort({ createdAt: -1 }).toArray();
    return docs.map(({ _id, ...alert }) => ({ id: _id, ...alert }));
  }

  async add(alerts: Alert[]): Promise<void> {
    if (alerts.length === 0) return;
    await (await this.collection()).bulkWrite(
      alerts.map(({ id, ...alert }) => ({ replaceOne: { filter: { _id: id }, replacement: alert, upsert: true } })),
    );
  }

  async remove(id: string): Promise<void> {
    await (await this.collection()).deleteOne({ _id: id });
  }

  async clear(): Promise<void> {
    await (await this.collection()).deleteMany({});
  }

  private collection(): Promise<Collection<AlertDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<AlertDocument>("alerts");
      await collection.createIndex({ createdAt: 1 }, { expireAfterSeconds: TTL_SECONDS });
      return collection;
    })();
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}
