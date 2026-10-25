// Suivi des prix de location et d'achat (France, HD et 4K) : met à jour l'historique et signale
// les baisses. Fonction pure, appelée par la vérification quotidienne avec les offres déjà reçues.

import { addDays, daysBetween, parisDay } from "@/domain/CalendarDay";
import type { Offer, Platform } from "@/domain/Offer";
import {
  isSignificantDrop,
  priceHistoryId,
  type PricedType,
  type PriceHistory,
  type PricePoint,
  type PriceThreshold,
} from "@/domain/PriceHistory";
import type { Title } from "@/domain/Title";
import type { Alert } from "@/domain/WatchStatus";

export const TRACKED_COUNTRY = "FR";
const TRACKED_QUALITIES = ["HD", "4K"];
const PRICED_TYPES: string[] = ["RENT", "BUY"];
// Au premier relevé, un changement JustWatch plus ancien sert de référence, sans alerte.
export const RECENT_DROP_DAYS = 7;

export type TrackPricesInput = {
  title: Title;
  offers: Offer[];
  // Historiques déjà connus du titre.
  histories: PriceHistory[];
  // Titre disponible chez l'utilisateur : l'historique est tenu, sans alerte.
  atHome: boolean;
  threshold: PriceThreshold;
  now: Date;
};

// Nouvel historique et prix auquel comparer le prix du jour (null : pas de baisse possible).
type Step = { points: PricePoint[]; previous: PricePoint | null };

export function trackPrices({ title, offers, histories, atHome, threshold, now }: TrackPricesInput): {
  changed: PriceHistory[];
  alerts: Alert[];
} {
  const today = parisDay(now);
  const known = new Map(histories.map((h) => [priceHistoryId(h), h]));
  const changed: PriceHistory[] = [];
  const alerts: Alert[] = [];

  for (const offer of cheapestOffers(offers)) {
    const key = {
      titleId: title.id,
      country: TRACKED_COUNTRY,
      platformId: offer.platform.id,
      monetizationType: offer.monetizationType as PricedType,
    };
    const point: PricePoint = {
      day: today,
      value: offer.priceValue as number,
      currency: offer.currency as string,
      quality: offer.quality,
    };
    const history = known.get(priceHistoryId(key));
    const step = history ? next(history.points, point) : start(offer, point);
    if (!step) continue;
    changed.push({ ...key, platformName: offer.platform.name, points: step.points });

    const current = step.points.at(-1);
    if (step.previous && current && !atHome && isSignificantDrop(step.previous.value, current.value, threshold)) {
      alerts.push(priceDropAlert(title, offer.platform, key.monetizationType, step.previous.value, current, now));
    }
  }
  return { changed, alerts };
}

// Par plateforme et par type, l'offre HD ou 4K la moins chère (la HD à prix égal).
function cheapestOffers(offers: Offer[]): Offer[] {
  const best = new Map<string, Offer>();
  for (const offer of offers) {
    if (offer.country !== TRACKED_COUNTRY || !PRICED_TYPES.includes(offer.monetizationType)) continue;
    if (!TRACKED_QUALITIES.includes(offer.quality) || offer.priceValue === null || !offer.currency) continue;
    const key = `${offer.platform.id}:${offer.monetizationType}`;
    const current = best.get(key);
    const cheaper = !current || offer.priceValue < (current.priceValue as number);
    const tieInHd = current && offer.priceValue === current.priceValue && offer.quality === "HD";
    if (cheaper || tieInHd) best.set(key, offer);
  }
  return [...best.values()];
}

// Historique connu : un point de plus si le prix a changé.
function next(points: PricePoint[], point: PricePoint): Step | null {
  const last = points.at(-1);
  if (last && last.value === point.value && last.currency === point.currency) return null;
  // Deux relevés le même jour (ajout à la liste puis cron) : le dernier remplace le premier.
  const kept = last?.day === point.day ? points.slice(0, -1) : points;
  const before = kept.at(-1) ?? null;
  if (before && before.value === point.value && before.currency === point.currency) return { points: kept, previous: null };
  return { points: [...kept, point], previous: before && before.currency === point.currency ? before : null };
}

// Premier relevé : le dernier changement JustWatch donne l'ancien prix et le jour où le prix actuel
// a commencé. Le jour de début de l'ancien prix est inconnu : la veille du changement.
function start(offer: Offer, point: PricePoint): Step {
  const change = offer.previousPrice;
  if (!change || change.day > point.day || change.value === point.value) return { points: [point], previous: null };
  const before: PricePoint = { ...point, day: addDays(change.day, -1), value: change.value };
  const current: PricePoint = { ...point, day: change.day };
  const recent = daysBetween(change.day, point.day) <= RECENT_DROP_DAYS;
  return { points: [before, current], previous: recent ? before : null };
}

function priceDropAlert(
  title: Title,
  platform: Platform,
  monetizationType: PricedType,
  previous: number,
  point: PricePoint,
  now: Date,
): Alert {
  return {
    id: `${title.id}:PRICE_DROP:${TRACKED_COUNTRY}:${platform.id}:${monetizationType}:${point.value}`,
    kind: "PRICE_DROP",
    title: { id: title.id, name: title.name, posterUrl: title.posterUrl },
    platform,
    country: TRACKED_COUNTRY,
    price: { previous, value: point.value, currency: point.currency, monetizationType },
    createdAt: now,
  };
}
