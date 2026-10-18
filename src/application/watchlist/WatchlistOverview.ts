// Liste à voir enrichie pour l'accueil et « Ma liste » : badge « disponible chez moi »
// calculé à partir de la dernière vérification et des abonnements actuels.
// Lecture seule et rapide : les vérifications se font à part (WatchlistCheck, POST /api/watchlist/check).

import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { WatchStatus } from "@/domain/WatchStatus";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";

export type WatchlistOverviewItem = WatchlistItem & {
  // Abonnements où le titre est disponible ; null si le titre n'a pas encore été vérifié.
  availableAtHome: Subscription[] | null;
};

// Titre sans fiche, jamais vérifié, ou vérifié avant l'enregistrement des offres en abonnement.
export function needsWork(item: WatchlistItem, status: WatchStatus | undefined): boolean {
  return !item.details || !status?.flatrate;
}

export function toOverviewItems(
  items: WatchlistItem[],
  statuses: Map<string, WatchStatus>,
  subscriptions: Subscription[],
): WatchlistOverviewItem[] {
  return items.map((item) => {
    const flatrate = statuses.get(item.title.id)?.flatrate;
    return {
      ...item,
      availableAtHome: flatrate ? subscriptions.filter((s) => flatrate.includes(`${s.country}:${s.platform.id}`)) : null,
    };
  });
}

export class WatchlistOverview {
  constructor(
    private readonly watchlist: Watchlist,
    private readonly statuses: WatchStatusRepository,
    private readonly subscriptions: SubscriptionRepository,
  ) {}

  // pending : nombre de titres à compléter ou à vérifier (POST /api/watchlist/check).
  async list(): Promise<{ items: WatchlistOverviewItem[]; pending: number }> {
    const [items, subscriptions, statusList] = await Promise.all([
      this.watchlist.list(),
      this.subscriptions.list(),
      this.statuses.list(),
    ]);
    const statuses = new Map(statusList.map((s) => [s.titleId, s]));
    return {
      items: toOverviewItems(items, statuses, subscriptions),
      pending: items.filter((item) => needsWork(item, statuses.get(item.title.id))).length,
    };
  }
}
