import type { PushSubscription } from "../Push";

export interface PushSubscriptionRepository {
  // Du plus ancien au plus récent.
  list(): Promise<PushSubscription[]>;
  // Un abonnement de même endpoint est remplacé.
  save(subscription: PushSubscription): Promise<void>;
  remove(endpoint: string): Promise<void>;
}
