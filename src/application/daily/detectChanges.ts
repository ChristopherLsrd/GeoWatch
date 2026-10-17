// Compare l'état du jour à celui de la veille et en déduit les nouveautés. Fonction pure.

import type { Offer } from "@/domain/Offer";
import type { Subscription } from "@/domain/Subscription";
import type { Title } from "@/domain/Title";
import type { Alert, WatchStatus } from "@/domain/WatchStatus";
import { availableAtHome } from "../catalog/availableAtHome";

export function currentStatus(titleId: string, offers: Offer[], subscriptions: Subscription[], now: Date): WatchStatus {
  return {
    titleId,
    atHome: availableAtHome(offers, subscriptions).map((s) => `${s.country}:${s.platform.id}`),
    frenchAudio: offers.some((offer) => offer.audioLanguages.includes("fr")),
    checkedAt: now,
  };
}

// Premier passage (pas d'état précédent) : sert de référence, aucune alerte.
export function detectChanges(
  title: Title,
  previous: WatchStatus | null,
  current: WatchStatus,
  subscriptions: Subscription[],
): Alert[] {
  if (!previous) return [];
  const summary = { id: title.id, name: title.name, posterUrl: title.posterUrl };
  const alerts: Alert[] = [];
  for (const key of current.atHome) {
    if (previous.atHome.includes(key)) continue;
    const subscription = subscriptions.find((s) => `${s.country}:${s.platform.id}` === key);
    if (!subscription) continue;
    alerts.push({
      id: `${title.id}:AT_HOME:${key}`,
      kind: "AT_HOME",
      title: summary,
      platform: subscription.platform,
      country: subscription.country,
      createdAt: current.checkedAt,
    });
  }
  if (current.frenchAudio && !previous.frenchAudio) {
    alerts.push({
      id: `${title.id}:FRENCH_AUDIO`,
      kind: "FRENCH_AUDIO",
      title: summary,
      platform: null,
      country: null,
      createdAt: current.checkedAt,
    });
  }
  return alerts;
}
