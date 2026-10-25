// Historiques à afficher pour une ligne pays d'une plateforme. Fonction pure, côté client.

import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import type { Offer } from "@/domain/Offer";

export type SelectedPriceHistory = {
  history: PriceHistoryView;
  // Prix vivant : le plus bas des offres HD/4K de la plateforme et du type dans la ligne.
  current: { value: number; currency: string };
  // Bornes de l'historique, élargies au prix vivant s'il est dans la même devise.
  low: number;
  high: number;
};

// Le suivi ne compte que les offres HD ou 4K avec un prix.
function isTracked(offer: Offer): boolean {
  return ["HD", "4K"].includes(offer.quality.toUpperCase()) && offer.priceValue !== null && offer.priceValue > 0;
}

// Un historique n'est jamais supprimé : il peut rester celui d'une offre qui n'existe plus.
// On ne garde donc que ceux dont la ligne a encore une offre suivie du même type sur la même plateforme.
export function selectPriceHistories(
  histories: PriceHistoryView[],
  country: string,
  platformIds: string[],
  offers: Offer[],
): SelectedPriceHistory[] {
  return histories.flatMap((history) => {
    if (history.country !== country || !platformIds.includes(history.platformId)) return [];
    const matching = offers.filter(
      (offer) =>
        offer.monetizationType === history.monetizationType &&
        offer.platform.id === history.platformId &&
        isTracked(offer),
    );
    if (matching.length === 0) return [];
    const cheapest = matching.reduce((a, b) => ((b.priceValue as number) < (a.priceValue as number) ? b : a));
    const last = history.points[history.points.length - 1];
    const currency = cheapest.currency ?? last?.currency ?? "EUR";
    const value = cheapest.priceValue as number;
    const sameCurrency = !last || last.currency === currency;
    return [
      {
        history,
        current: { value, currency },
        low: sameCurrency ? Math.min(history.low, value) : history.low,
        high: sameCurrency ? Math.max(history.high, value) : history.high,
      },
    ];
  });
}
