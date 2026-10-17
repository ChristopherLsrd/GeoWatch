import type { Collection, Db } from "mongodb";
import type { CountryCode } from "@/domain/Country";
import type { Platform } from "@/domain/Offer";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";

type SubscriptionDocument = {
  // « FR:8 » : pays et identifiant de la plateforme.
  _id: string;
  platform: Platform;
  country: CountryCode;
  addedAt: Date;
};

export class MongoSubscriptionRepository implements SubscriptionRepository {
  constructor(private readonly db: () => Promise<Db>) {}

  async list(): Promise<Subscription[]> {
    const docs = await (await this.collection()).find().sort({ addedAt: 1 }).toArray();
    return docs.map(({ platform, country }) => ({ platform, country }));
  }

  async add(subscription: Subscription): Promise<void> {
    await (await this.collection()).updateOne(
      { _id: documentId(subscription.platform.id, subscription.country) },
      { $setOnInsert: { platform: subscription.platform, country: subscription.country, addedAt: new Date() } },
      { upsert: true },
    );
  }

  async remove(platformId: string, country: CountryCode): Promise<void> {
    await (await this.collection()).deleteOne({ _id: documentId(platformId, country) });
  }

  private async collection(): Promise<Collection<SubscriptionDocument>> {
    return (await this.db()).collection<SubscriptionDocument>("subscriptions");
  }
}

function documentId(platformId: string, country: CountryCode): string {
  return `${country}:${platformId}`;
}
