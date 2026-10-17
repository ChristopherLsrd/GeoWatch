import type { CountryCode } from "../Country";
import type { Subscription } from "../Subscription";

export interface SubscriptionRepository {
  list(): Promise<Subscription[]>;
  // Sans effet si l'abonnement existe déjà.
  add(subscription: Subscription): Promise<void>;
  remove(platformId: string, country: CountryCode): Promise<void>;
}
