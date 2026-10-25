// Pastille « en baisse » d'un titre de la liste à voir. Fonction pure, utilisable côté client.

import { daysBetween, parisDay } from "@/domain/CalendarDay";
import { dropPercent, isSignificantDrop, lastChange, type PricedType, type PriceHistory, type PriceThreshold } from "@/domain/PriceHistory";

export type PriceDrop = {
  value: number;
  previous: number;
  currency: string;
  percent: number;
  platformName: string;
  monetizationType: PricedType;
  // Jour de la baisse.
  day: string;
};

export const PRICE_DROP_BADGE_DAYS = 7;

// La plus forte baisse (en %) des 7 derniers jours parmi les historiques d'un titre. Une remontée
// ajoute un point qui n'est pas une baisse : la pastille disparaît d'elle-même.
export function latestPriceDrop(histories: PriceHistory[], threshold: PriceThreshold, now: Date): PriceDrop | null {
  const today = parisDay(now);
  let best: PriceDrop | null = null;
  for (const history of histories) {
    const change = lastChange(history);
    if (!change || !isSignificantDrop(change.previous.value, change.current.value, threshold)) continue;
    if (daysBetween(change.current.day, today) > PRICE_DROP_BADGE_DAYS) continue;
    const drop: PriceDrop = {
      value: change.current.value,
      previous: change.previous.value,
      currency: change.current.currency,
      percent: dropPercent(change.previous.value, change.current.value),
      platformName: history.platformName,
      monetizationType: history.monetizationType,
      day: change.current.day,
    };
    if (!best || drop.percent > best.percent) best = drop;
  }
  return best;
}
