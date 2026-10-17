// Liste à voir enrichie pour l'accueil et « Ma liste » : badge « disponible chez moi »
// calculé à partir de la dernière vérification et des abonnements actuels.

import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { Title } from "@/domain/Title";
import type { WatchlistItem } from "@/domain/WatchlistItem";
import type { Watchlist } from "./Watchlist";

export type WatchlistOverviewItem = WatchlistItem & {
  // Abonnements où le titre est disponible ; null si le titre n'a pas encore été vérifié.
  availableAtHome: Subscription[] | null;
};

// Nombre maximal de titres vérifiés à la volée par lecture, pour rester raisonnable avec le catalogue.
const CHECK_LIMIT = 10;

export class WatchlistOverview {
  constructor(
    private readonly watchlist: Watchlist,
    private readonly statuses: WatchStatusRepository,
    private readonly subscriptions: SubscriptionRepository,
    // Vérifie un titre et enregistre son état (DailyCheck.checkTitle).
    private readonly checkTitle: (title: Title) => Promise<void> = async () => {},
  ) {}

  async list(): Promise<WatchlistOverviewItem[]> {
    const [items, subscriptions] = await Promise.all([this.watchlist.list(), this.subscriptions.list()]);
    const ids = items.map((i) => i.title.id);
    let statuses = new Map((await this.statuses.getMany(ids)).map((s) => [s.titleId, s]));

    // Titres jamais vérifiés, ou vérifiés avant l'enregistrement des offres en abonnement :
    // on les vérifie tout de suite plutôt que d'attendre le cron (le cache du jour évite la plupart des appels).
    const unchecked = items.filter((i) => !statuses.get(i.title.id)?.flatrate).slice(0, CHECK_LIMIT);
    if (unchecked.length > 0) {
      for (const { title } of unchecked) {
        try {
          await this.checkTitle(title);
        } catch {
          break; // Catalogue indisponible : le badge reste inconnu, on réessaiera.
        }
      }
      statuses = new Map((await this.statuses.getMany(ids)).map((s) => [s.titleId, s]));
    }

    return items.map((item) => {
      const flatrate = statuses.get(item.title.id)?.flatrate;
      return {
        ...item,
        availableAtHome: flatrate ? subscriptions.filter((s) => flatrate.includes(`${s.country}:${s.platform.id}`)) : null,
      };
    });
  }
}
