// Historiques des prix d'un titre pour sa fiche, lus dans Mongo seulement.

import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import { priceRange, type PriceHistory } from "@/domain/PriceHistory";

export type PriceHistoryView = PriceHistory & { low: number; high: number };

export class TitlePrices {
  constructor(private readonly prices: PriceHistoryRepository) {}

  // Liste vide pour un titre hors de la liste à voir (jamais vérifié par le cron).
  async forTitle(titleId: string): Promise<PriceHistoryView[]> {
    return (await this.prices.listForTitles([titleId])).flatMap((history) => {
      const range = priceRange(history);
      return range ? [{ ...history, ...range }] : [];
    });
  }
}
