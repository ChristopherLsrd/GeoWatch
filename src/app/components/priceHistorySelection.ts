// Historiques à afficher pour une ligne pays d'une plateforme. Fonction pure, côté client.

import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import type { Offer } from "@/domain/Offer";

// Un historique n'est jamais supprimé : il peut rester celui d'une offre qui n'existe plus.
// On ne garde donc que ceux dont la ligne a encore une offre du même type sur la même plateforme.
export function selectPriceHistories(
  histories: PriceHistoryView[],
  country: string,
  platformIds: string[],
  offers: Offer[],
): PriceHistoryView[] {
  return histories.filter(
    (history) =>
      history.country === country &&
      platformIds.includes(history.platformId) &&
      offers.some(
        (offer) =>
          offer.monetizationType === history.monetizationType && offer.platform.id === history.platformId,
      ),
  );
}
