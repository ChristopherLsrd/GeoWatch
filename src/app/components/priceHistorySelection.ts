// Historiques à afficher pour une ligne pays d'une plateforme. Fonction pure, côté client.

import { cheapestOf, isTracked } from "@/application/daily/trackPrices";
import type { PriceHistoryView } from "@/application/prices/TitlePrices";
import { parisDay } from "@/domain/CalendarDay";
import type { Offer } from "@/domain/Offer";
import type { PricePoint } from "@/domain/PriceHistory";

export type SelectedPriceHistory = {
  history: PriceHistoryView;
  // Prix vivant : le plus bas des offres suivies de la plateforme et du type dans la ligne,
  // dans sa propre devise.
  current: { value: number; currency: string };
  // Devise de l'historique (celle de ses points), pour « plus bas » et « plus haut ».
  currency: string;
  // Bornes de l'historique, élargies au prix vivant s'il est dans la même devise.
  low: number;
  high: number;
  // Points de la courbe : ceux de l'historique, plus un point du jour au prix vivant s'il diffère du dernier.
  points: PricePoint[];
};

// Un historique n'est jamais supprimé : il peut rester celui d'une offre qui n'existe plus.
// On ne garde donc que ceux dont la ligne a encore une offre suivie du même type sur la même plateforme.
export function selectPriceHistories(
  histories: PriceHistoryView[],
  country: string,
  platformIds: string[],
  offers: Offer[],
  now: Date = new Date(),
): SelectedPriceHistory[] {
  return histories.flatMap((history) => {
    if (history.country !== country || !platformIds.includes(history.platformId)) return [];
    const matching = offers.filter(
      (offer) =>
        isTracked(offer) &&
        offer.monetizationType === history.monetizationType &&
        offer.platform.id === history.platformId,
    );
    if (matching.length === 0) return [];
    const cheapest = cheapestOf(matching.filter(isTracked));
    const current = { value: cheapest.priceValue, currency: cheapest.currency };
    const last = history.points.at(-1);
    const currency = last?.currency ?? current.currency;
    if (current.currency !== currency || !last || last.value === current.value) {
      return [{ history, current, currency, low: history.low, high: history.high, points: history.points }];
    }
    // Le cron n'a pas encore relevé ce prix : la courbe et les bornes le montrent quand même.
    const today = parisDay(now);
    const live: PricePoint = { day: today, value: current.value, currency, quality: cheapest.quality };
    return [
      {
        history,
        current,
        currency,
        low: Math.min(history.low, current.value),
        high: Math.max(history.high, current.value),
        // Deux relevés le même jour : le prix vivant remplace le dernier (comme le cron).
        points: [...(last.day === today ? history.points.slice(0, -1) : history.points), live],
      },
    ];
  });
}
