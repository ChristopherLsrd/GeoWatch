import type { Collection, Db } from "mongodb";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { WatchStatus } from "@/domain/WatchStatus";

type WatchStatusDocument = Omit<WatchStatus, "titleId"> & { _id: string };

export class MongoWatchStatusRepository implements WatchStatusRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async get(titleId: string): Promise<WatchStatus | null> {
    const doc = await (await this.collection()).findOne({ _id: titleId });
    return doc ? toStatus(doc) : null;
  }

  async getMany(titleIds: string[]): Promise<WatchStatus[]> {
    return (await (await this.collection()).find({ _id: { $in: titleIds } }).toArray()).map(toStatus);
  }

  async save(status: WatchStatus): Promise<void> {
    await (await this.collection()).replaceOne(
      { _id: status.titleId },
      {
        atHome: status.atHome,
        flatrate: status.flatrate ?? [],
        frenchAudio: status.frenchAudio,
        checkedAt: status.checkedAt,
      },
      { upsert: true },
    );
  }

  private async collection(): Promise<Collection<WatchStatusDocument>> {
    return (await this.db()).collection<WatchStatusDocument>("watchStatus");
  }
}

function toStatus({ _id, atHome, flatrate, frenchAudio, checkedAt }: WatchStatusDocument): WatchStatus {
  return { titleId: _id, atHome, flatrate: flatrate ?? [], frenchAudio, checkedAt };
}
