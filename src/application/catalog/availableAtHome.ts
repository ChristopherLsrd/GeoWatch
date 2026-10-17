// Badge « disponible chez moi » : offre en abonnement sur une plateforme, dans un pays
// où l'utilisateur y est abonné. Fonction pure, utilisable côté client.

import type { Offer } from "@/domain/Offer";
import type { Subscription } from "@/domain/Subscription";

export function availableAtHome(offers: Offer[], subscriptions: Subscription[]): Subscription[] {
  return subscriptions.filter((subscription) =>
    offers.some(
      (offer) =>
        offer.monetizationType === "FLATRATE" &&
        offer.platform.id === subscription.platform.id &&
        offer.country === subscription.country,
    ),
  );
}
