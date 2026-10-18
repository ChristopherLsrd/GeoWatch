// Vérification de la liste à voir par petits lots (POST /api/watchlist/check) : complète la fiche
// des titres qui n'en ont pas, puis calcule leur badge « disponible chez moi ».
// Le navigateur l'appelle en boucle tant que `pending` est positif, dans la limite de ses plafonds.

import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { Subscription } from "@/domain/Subscription";
import type { Title } from "@/domain/Title";
import type { Watchlist } from "./Watchlist";
import { needsWork, toOverviewItems, type WatchlistOverviewItem } from "./WatchlistOverview";

// Titres traités par appel : une réponse rapide, et un volume modéré vers JustWatch.
export const CHECK_BATCH = 3;

export type WatchlistCheckResult = {
  // Titres traités par cet appel, au format de GET /api/watchlist.
  items: WatchlistOverviewItem[];
  // Titres encore à traiter.
  pending: number;
  // Vérifications d'offres et compléments de fiche faits, pour les plafonds du navigateur.
  checked: number;
  completed: number;
};

export class WatchlistCheck {
  constructor(
    private readonly watchlist: Watchlist,
    private readonly statuses: WatchStatusRepository,
    private readonly subscriptions: SubscriptionRepository,
    // Vérifie un titre et enregistre son état (DailyCheck.checkTitle).
    private readonly checkTitle: (title: Title, subscriptions: Subscription[]) => Promise<void>,
  ) {}

  async run(): Promise<WatchlistCheckResult> {
    const [items, subscriptions, statusList] = await Promise.all([
      this.watchlist.list(),
      this.subscriptions.list(),
      this.statuses.list(),
    ]);
    const statuses = new Map(statusList.map((s) => [s.titleId, s]));
    // watchlist.list() renvoie déjà les titres du plus récent au plus ancien.
    const todo = items.filter((item) => needsWork(item, statuses.get(item.title.id)));
    const done: typeof items = [];
    let checked = 0;
    let completed = 0;

    for (const item of todo.slice(0, CHECK_BATCH)) {
      try {
        if (!item.details && (await this.watchlist.completeDetails(item))) completed++;
        if (!statuses.get(item.title.id)?.flatrate) {
          await this.checkTitle(item.title, subscriptions);
          checked++;
        }
      } catch (error) {
        if (!(error instanceof CatalogUnavailableError)) throw error;
        // Rien de fait : le navigateur affiche « indisponible » et s'arrête.
        if (done.length === 0 && checked === 0 && completed === 0) throw error;
        break;
      }
      done.push(item);
    }

    const fresh = new Map((await this.statuses.getMany(done.map((i) => i.title.id))).map((s) => [s.titleId, s]));
    for (const [id, s] of fresh) statuses.set(id, s);
    return {
      items: toOverviewItems(done, statuses, subscriptions),
      pending: items.filter((item) => needsWork(item, statuses.get(item.title.id))).length,
      checked,
      completed,
    };
  }
}
