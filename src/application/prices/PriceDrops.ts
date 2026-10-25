// Pastilles « en baisse » de la liste à voir, lues dans Mongo seulement.

import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import { DEFAULT_PRICE_THRESHOLD, type PriceHistory } from "@/domain/PriceHistory";
import { latestPriceDrop, type PriceDrop } from "./priceDrop";

export class PriceDrops {
  constructor(
    private readonly prices: PriceHistoryRepository,
    private readonly preferences: PreferencesRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Sans titres : toute la liste. En cas d'erreur, aucune pastille : les cartes s'affichent sans.
  async forTitles(titleIds?: string[]): Promise<Map<string, PriceDrop>> {
    try {
      const [histories, preferences] = await Promise.all([
        titleIds ? this.prices.listForTitles(titleIds) : this.prices.list(),
        this.preferences.get(),
      ]);
      const threshold = preferences?.priceDropThreshold ?? DEFAULT_PRICE_THRESHOLD;
      const byTitle = new Map<string, PriceHistory[]>();
      for (const history of histories) byTitle.set(history.titleId, [...(byTitle.get(history.titleId) ?? []), history]);
      const drops = new Map<string, PriceDrop>();
      for (const [titleId, list] of byTitle) {
        const drop = latestPriceDrop(list, threshold, this.clock());
        if (drop) drops.set(titleId, drop);
      }
      return drops;
    } catch (error) {
      console.error(error);
      return new Map();
    }
  }
}
