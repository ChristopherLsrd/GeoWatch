// Historiques des prix d'un titre pour sa fiche, lus dans Mongo seulement.

import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import { currentCurrencyPoints, priceRange, type PriceHistory } from "@/domain/PriceHistory";

export type PriceHistoryView = PriceHistory & { low: number; high: number };

export class TitlePrices {
  constructor(private readonly prices: PriceHistoryRepository) {}

  // Liste vide pour un titre jamais suivi (jamais vérifié par le cron). Un titre retiré de la liste garde
  // son historique : le front n'affiche que les offres encore disponibles.
  // Points dans la devise actuelle seulement, pour que la courbe ne mélange pas les devises.
  async forTitle(titleId: string): Promise<PriceHistoryView[]> {
    const views = (await this.prices.listForTitles([titleId])).flatMap((history) => {
      const range = priceRange(history);
      return range ? [{ ...history, points: currentCurrencyPoints(history), ...range }] : [];
    });
    // Par plateforme, puis location avant achat.
    return views.sort(
      (a, b) =>
        a.platformName.localeCompare(b.platformName, "fr") ||
        monetizationRank(a.monetizationType) - monetizationRank(b.monetizationType),
    );
  }
}

function monetizationRank(monetizationType: PriceHistory["monetizationType"]): number {
  return monetizationType === "RENT" ? 0 : 1;
}
