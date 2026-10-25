// Pastilles « en baisse » de la liste à voir, lues dans Mongo seulement.

import type { PreferencesRepository } from "@/domain/ports/PreferencesRepository";
import type { PriceHistoryRepository } from "@/domain/ports/PriceHistoryRepository";
import type { PriceHistory } from "@/domain/PriceHistory";
import { latestPriceDrop, type PriceDrop } from "./priceDrop";
import { readPriceThreshold } from "./readPriceThreshold";

export class PriceDrops {
  constructor(
    private readonly prices: PriceHistoryRepository,
    private readonly preferences: PreferencesRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Sans titres : toute la liste. En cas d'erreur, aucune pastille : les cartes s'affichent sans.
  async forTitles(titleIds?: string[]): Promise<Map<string, PriceDrop>> {
    try {
      const [histories, threshold] = await Promise.all([
        titleIds ? this.prices.listForTitles(titleIds) : this.prices.list(),
        readPriceThreshold(this.preferences),
      ]);
      const now = this.clock();
      const byTitle = new Map<string, PriceHistory[]>();
      for (const history of histories) {
        const list = byTitle.get(history.titleId);
        if (list) list.push(history);
        else byTitle.set(history.titleId, [history]);
      }
      const drops = new Map<string, PriceDrop>();
      for (const [titleId, list] of byTitle) {
        const drop = latestPriceDrop(list, threshold, now);
        if (drop) drops.set(titleId, drop);
      }
      return drops;
    } catch (error) {
      console.error(error);
      return new Map();
    }
  }
}
