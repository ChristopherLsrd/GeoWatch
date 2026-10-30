import type { PushSubscription } from "../Push";

export interface PushSubscriptionRepository {
  // Du plus ancien au plus récent.
  list(): Promise<PushSubscription[]>;
  // Un abonnement de même endpoint est mis à jour (clés, nom) ; sa date d'ajout est gardée.
  save(subscription: PushSubscription): Promise<void>;
  remove(endpoint: string): Promise<void>;
}
