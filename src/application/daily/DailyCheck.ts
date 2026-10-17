// Vérification quotidienne (cron) : revérifie les titres de la liste à voir, remplit le cache
// du jour et signale les titres arrivés chez l'utilisateur ou ayant obtenu la VF.

import { BATCH_SIZE, PRIORITY_1 } from "@/config/countries";
import type { CountryCode } from "@/domain/Country";
import type { Offer } from "@/domain/Offer";
import type { AlertRepository } from "@/domain/ports/AlertRepository";
import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { WatchlistRepository } from "@/domain/ports/WatchlistRepository";
import type { WatchStatusRepository } from "@/domain/ports/WatchStatusRepository";
import type { GetTitleAvailability } from "../catalog/GetTitleAvailability";
import { currentStatus, detectChanges } from "./detectChanges";

export type DailyCheckReport = {
  checked: number;
  total: number;
  alerts: number;
  // Arrêt anticipé : JustWatch indisponible ou temps écoulé. Les titres restants le seront demain.
  stoppedEarly: "catalog_unavailable" | "time_limit" | null;
};

export type DailyCheckOptions = {
  // Pause entre deux titres, pour rester raisonnable avec JustWatch.
  pauseMs?: number;
  // Au-delà, on s'arrête proprement (limite de durée des fonctions Vercel).
  timeBudgetMs?: number;
};

export class DailyCheck {
  constructor(
    private readonly watchlist: WatchlistRepository,
    private readonly subscriptions: SubscriptionRepository,
    private readonly availability: GetTitleAvailability,
    private readonly statuses: WatchStatusRepository,
    private readonly alerts: AlertRepository,
    private readonly clock: () => Date = () => new Date(),
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async execute({ pauseMs = 1000, timeBudgetMs = 240_000 }: DailyCheckOptions = {}): Promise<DailyCheckReport> {
    const started = this.clock().getTime();
    const [items, subscriptions] = await Promise.all([this.watchlist.list(), this.subscriptions.list()]);
    const countries = [...new Set<CountryCode>([...PRIORITY_1, ...subscriptions.map((s) => s.country)])];
    const report: DailyCheckReport = { checked: 0, total: items.length, alerts: 0, stoppedEarly: null };

    for (const [index, { title }] of items.entries()) {
      if (this.clock().getTime() - started > timeBudgetMs) {
        report.stoppedEarly = "time_limit";
        break;
      }
      if (index > 0 && pauseMs > 0) await this.sleep(pauseMs);
      let offers: Offer[];
      try {
        offers = await this.offers(title.id, countries);
      } catch (error) {
        if (error instanceof CatalogUnavailableError) {
          report.stoppedEarly = "catalog_unavailable";
          break;
        }
        throw error;
      }
      const current = currentStatus(title.id, offers, subscriptions, this.clock());
      const alerts = detectChanges(title, await this.statuses.get(title.id), current, subscriptions);
      if (alerts.length > 0) await this.alerts.add(alerts);
      await this.statuses.save(current);
      report.checked++;
      report.alerts += alerts.length;
    }
    return report;
  }

  // Passe par le cache du jour : un titre déjà consulté aujourd'hui ne coûte aucune requête.
  private async offers(titleId: string, countries: CountryCode[]): Promise<Offer[]> {
    const offers: Offer[] = [];
    for (let i = 0; i < countries.length; i += BATCH_SIZE) {
      const result = await this.availability.execute(titleId, countries.slice(i, i + BATCH_SIZE));
      offers.push(...Object.values(result).flatMap((a) => a.offers));
    }
    return offers;
  }
}
