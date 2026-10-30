// Textes des notifications push.

import { countryName } from "@/domain/Country";
import { formatPrice } from "@/domain/formatPrice";
import { MONETIZATION_LABELS } from "@/domain/MonetizationType";
import type { PushMessage } from "@/domain/Push";
import type { Alert } from "@/domain/WatchStatus";

// Au-delà, un seul résumé plutôt qu'une notification par alerte.
export const MAX_SEPARATE_NOTIFICATIONS = 3;

export const TEST_MESSAGE: PushMessage = { title: "GeoWatch", body: "Les notifications fonctionnent sur cet appareil.", url: "/" };

export function alertMessages(alerts: Alert[]): PushMessage[] {
  if (alerts.length > MAX_SEPARATE_NOTIFICATIONS) {
    return [{ title: "GeoWatch", body: `${alerts.length} nouveautés dans votre liste`, url: "/" }];
  }
  return alerts.map(alertMessage);
}

function alertMessage(alert: Alert): PushMessage {
  return {
    title: alert.title.name,
    body: alertBody(alert),
    url: `/titre/${encodeURIComponent(alert.title.id)}`,
    ...(alert.title.posterUrl ? { image: alert.title.posterUrl } : {}),
  };
}

// « Disponible sur Netflix (France) », « Location : 3,99 € → 2,99 € sur Apple TV ».
function alertBody(alert: Alert): string {
  if (alert.kind === "PRICE_DROP") {
    const platform = alert.platform?.name ?? "une plateforme";
    if (!alert.price) return `Baisse de prix sur ${platform}`;
    const { monetizationType, previous, value, currency } = alert.price;
    return `${MONETIZATION_LABELS[monetizationType]} : ${formatPrice(previous, currency)} → ${formatPrice(value, currency)} sur ${platform}`;
  }
  if (alert.kind === "AT_HOME") {
    const platform = alert.platform?.name ?? "une de vos plateformes";
    return `Disponible sur ${platform}${alert.country ? ` (${countryName(alert.country)})` : ""}`;
  }
  return "Disponible en VF";
}
