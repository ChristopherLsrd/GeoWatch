// Liste à voir enrichie pour l'accueil et « Ma liste » : badge « disponible chez moi »
// calculé à partir de la dernière vérification et des abonnements actuels.

import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";

export type WatchlistOverviewItem = WatchlistItem & {
  // Abonnements où le titre est disponible ; null si le titre n'a pas encore été vérifié.
  availableAtHome: Subscription[] | null;
};

export class WatchlistOverview {
  constructor(
    private readonly watchlist: Watchlist,
    private readonly statuses: WatchStatusRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  async list(): Promise<WatchlistOverviewItem[]> {
    const [items, subscriptions] = await Promise.all([this.watchlist.list(), this.subscriptions.list()]);
    const statuses = new Map((await this.statuses.getMany(items.map((i) => i.title.id))).map((s) => [s.titleId, s]));
    return items.map((item) => {
      const flatrate = statuses.get(item.title.id)?.flatrate;
      return {
        ...item,
        availableAtHome: flatrate ? subscriptions.filter((s) => flatrate.includes(`${s.country}:${s.platform.id}`)) : null,
      };
    });
  }
}
