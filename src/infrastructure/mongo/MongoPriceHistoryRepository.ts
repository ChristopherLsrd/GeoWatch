import type { Collection, Db } from "mongodb";
import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import { priceHistoryId, type PriceHistory } from "@/domain/PriceHistory";

// « tm92641:FR:2:RENT » : un historique par titre, pays, plateforme et type.
type PriceHistoryDocument = PriceHistory & { _id: string };

export class MongoPriceHistoryRepository implements PriceHistoryRepository {
  private collectionReady: Promise<Collection<PriceHistoryDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async list(): Promise<PriceHistory[]> {
    return (await (await this.collection()).find().toArray()).map(toHistory);
  }

  async listForTitles(titleIds: string[]): Promise<PriceHistory[]> {
    if (titleIds.length === 0) return [];
    return (await (await this.collection()).find({ titleId: { $in: titleIds } }).toArray()).map(toHistory);
  }

  async save(histories: PriceHistory[]): Promise<void> {
    if (histories.length === 0) return;
    await (await this.collection()).bulkWrite(
      histories.map((history) => ({
        replaceOne: { filter: { _id: priceHistoryId(history) }, replacement: history, upsert: true },
      })),
      { ordered: false },
    );
  }

  private collection(): Promise<Collection<PriceHistoryDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<PriceHistoryDocument>("prices");
      await collection.createIndex({ titleId: 1 });
      return collection;
    })();
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}

function toHistory({ _id, ...history }: PriceHistoryDocument): PriceHistory {
  return history;
}
