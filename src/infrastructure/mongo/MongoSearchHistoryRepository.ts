import type { Collection, Db } from "mongodb";
import type { SearchHistoryRepository } from "@/domain/ports/SearchHistoryRepository";
import type { SearchHistoryEntry } from "@/domain/SearchHistoryEntry";

type SearchHistoryDocument = {
  // Recherche en minuscules : une même recherche n'est enregistrée qu'une fois.
  _id: string;
  query: string;
  searchedAt: Date;
};

export class MongoSearchHistoryRepository implements SearchHistoryRepository {
  private collectionReady: Promise<Collection<SearchHistoryDocument>> | null = null;

  constructor(private readonly db: () => Promise<Db>) {}

  async record(entry: SearchHistoryEntry, keep: number): Promise<void> {
    const collection = await this.collection();
    await collection.replaceOne(
      { _id: entry.query.toLocaleLowerCase("fr") },
      { query: entry.query, searchedAt: entry.searchedAt },
      { upsert: true },
    );
    const overflow = await collection.find({}, { projection: { _id: 1 } }).sort({ searchedAt: -1 }).skip(keep).toArray();
    if (overflow.length > 0) await collection.deleteMany({ _id: { $in: overflow.map((doc) => doc._id) } });
  }

  async list(): Promise<SearchHistoryEntry[]> {
    const docs = await (await this.collection()).find().sort({ searchedAt: -1 }).toArray();
    return docs.map(({ query, searchedAt }) => ({ query, searchedAt }));
  }

  async clear(): Promise<void> {
    await (await this.collection()).deleteMany({});
  }

  private collection(): Promise<Collection<SearchHistoryDocument>> {
    this.collectionReady ??= (async () => {
      const collection = (await this.db()).collection<SearchHistoryDocument>("searchHistory");
      await collection.createIndex({ searchedAt: -1 });
      return collection;
    })();
    this.collectionReady.catch(() => (this.collectionReady = null));
    return this.collectionReady;
  }
}
