import type { Collection, Db } from "mongodb";
import type { PushSubscription } from "@/domain/Push";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";

type PushSubscriptionDocument = Omit<PushSubscription, "endpoint"> & { _id: string };

export class MongoPushSubscriptionRepository implements PushSubscriptionRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async list(): Promise<PushSubscription[]> {
    const docs = await (await this.collection()).find().sort({ createdAt: 1 }).toArray();
    return docs.map(({ _id, keys, device, createdAt }) => ({ endpoint: _id, keys, device, createdAt }));
  }

  async save({ endpoint, ...subscription }: PushSubscription): Promise<void> {
    await (await this.collection()).replaceOne({ _id: endpoint }, subscription, { upsert: true });
  }

  async remove(endpoint: string): Promise<void> {
    await (await this.collection()).deleteOne({ _id: endpoint });
  }

  private async collection(): Promise<Collection<PushSubscriptionDocument>> {
    return (await this.db()).collection<PushSubscriptionDocument>("pushSubscriptions");
  }
}
