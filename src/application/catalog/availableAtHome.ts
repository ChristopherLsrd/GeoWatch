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

// Lien vers le titre pour un abonnement du badge : le lien direct d'une offre en abonnement
// de cette plateforme dans ce pays s'il existe, sinon l'URL de l'offre. null sans lien connu.
export function homeOfferLink(offers: Offer[], subscription: Subscription): string | null {
  const matching = offers.filter(
    (offer) =>
      offer.monetizationType === "FLATRATE" &&
      offer.platform.id === subscription.platform.id &&
      offer.country === subscription.country,
  );
  return matching.find((offer) => offer.deepLinkUrl)?.deepLinkUrl ?? matching.find((offer) => offer.url)?.url ?? null;
}
