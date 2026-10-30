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

  // La date d'ajout n'est écrite qu'à la création : un ré-enregistrement garde la première.
  async save({ endpoint, keys, device, createdAt }: PushSubscription): Promise<void> {
    await (await this.collection()).updateOne(
      { _id: endpoint },
      { $set: { keys, device }, $setOnInsert: { createdAt } },
      { upsert: true },
    );
  }

  async remove(endpoint: string): Promise<void> {
    await (await this.collection()).deleteOne({ _id: endpoint });
  }

  private async collection(): Promise<Collection<PushSubscriptionDocument>> {
    return (await this.db()).collection<PushSubscriptionDocument>("pushSubscriptions");
  }
}
