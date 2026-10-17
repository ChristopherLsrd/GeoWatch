import type { Collection, Db } from "mongodb";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import type { Title } from "@/domain/Title";
import type { WatchlistDetails, WatchlistItem } from "@/domain/WatchlistItem";

type WatchlistDocument = {
  // Identifiant JustWatch du titre.
  _id: string;
  title: Title;
  // Absent des documents enregistrés avant l'ajout du résumé.
  details?: WatchlistDetails | null;
  note: string;
  addedAt: Date;
};

export class MongoWatchlistRepository implements WatchlistRepository {
  private collectionReady: Promise<Collection<WatchlistDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async list(): Promise<WatchlistItem[]> {
    const docs = await (await this.collection()).find().sort({ addedAt: -1 }).toArray();
    return docs.map(toItem);
  }

  async get(titleId: string): Promise<WatchlistItem | null> {
    const doc = await (await this.collection()).findOne({ _id: titleId });
    return doc ? toItem(doc) : null;
  }

  async add(item: WatchlistItem): Promise<void> {
    await (await this.collection()).updateOne(
      { _id: item.title.id },
      { $setOnInsert: { title: item.title, details: item.details, note: item.note, addedAt: item.addedAt } },
      { upsert: true },
    );
  }

  async updateNote(titleId: string, note: string): Promise<boolean> {
    const result = await (await this.collection()).updateOne({ _id: titleId }, { $set: { note } });
    return result.matchedCount > 0;
  }

  async updateDetails(titleId: string, details: WatchlistDetails): Promise<void> {
    await (await this.collection()).updateOne({ _id: titleId }, { $set: { details } });
  }

  async remove(titleId: string): Promise<void> {
    await (await this.collection()).deleteOne({ _id: titleId });
  }

  private collection(): Promise<Collection<WatchlistDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<WatchlistDocument>("watchlist");
      await collection.createIndex({ addedAt: -1 });
      return collection;
    })();
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}

function toItem({ title, details, note, addedAt }: WatchlistDocument): WatchlistItem {
  return { title, details: details ?? null, note, addedAt };
}
