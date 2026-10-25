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

// Offre suivie (règle unique, aussi utilisée par la fiche) : France, location ou achat, HD ou 4K, avec un prix strictement positif.
export type TrackedOffer = Offer & { monetizationType: PricedType; priceValue: number; currency: string };

// Offres suivies d'une même plateforme et d'un même type. La moins chère donne le prix courant.
type Group = { cheapest: TrackedOffer; offers: TrackedOffer[] };

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

  for (const group of groupTrackedOffers(offers)) {
    const { cheapest } = group;
    const key = {
      titleId: title.id,
      country: TRACKED_COUNTRY,
      platformId: cheapest.platform.id,
      monetizationType: cheapest.monetizationType,
    };
    const point: PricePoint = {
      day: today,
      value: cheapest.priceValue,
      currency: cheapest.currency,
      quality: cheapest.quality,
    };
    const history = known.get(priceHistoryId(key));
    const step = history ? next(history.points, point) : start(group, point);
    if (!step) continue;
    changed.push({ ...key, platformName: cheapest.platform.name, points: step.points });

    const current = step.points.at(-1);
    if (step.previous && current && !atHome && isSignificantDrop(step.previous.value, current.value, threshold)) {
      alerts.push(priceDropAlert(title, cheapest.platform, key.monetizationType, step.previous.value, current, now));
    }
  }
  return { changed, alerts };
}

export function isTracked(offer: Offer): offer is TrackedOffer {
  return (
    offer.country === TRACKED_COUNTRY &&
    (offer.monetizationType === "RENT" || offer.monetizationType === "BUY") &&
    (offer.quality === "HD" || offer.quality === "4K") &&
    offer.priceValue !== null &&
    offer.priceValue > 0 &&
    !!offer.currency
  );
}

// Par plateforme et par type, les offres suivies, avec la moins chère (la HD à prix égal).
function groupTrackedOffers(offers: Offer[]): Group[] {
  const groups = new Map<string, TrackedOffer[]>();
  for (const offer of offers) {
    if (!isTracked(offer)) continue;
    const key = `${offer.platform.id}:${offer.monetizationType}`;
    groups.set(key, [...(groups.get(key) ?? []), offer]);
  }
  return [...groups.values()].map((list) => ({ cheapest: cheapestOf(list), offers: list }));
}

export function cheapestOf(list: TrackedOffer[]): TrackedOffer {
  return list.reduce((best, offer) => {
    if (offer.priceValue < best.priceValue) return offer;
    if (offer.priceValue === best.priceValue && offer.quality === "HD") return offer;
    return best;
  });
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

// Premier relevé : le dernier changement JustWatch de l'offre la moins chère donne le jour où le prix
// actuel a commencé (D). L'ancien prix est le plus bas, juste avant D, de toutes les offres suivies de
// la plateforme et du type : leur ancien prix si changé à D ou après, sinon leur prix actuel.
// Le jour de début de l'ancien prix est inconnu : la veille de D.
function start({ cheapest, offers }: Group, point: PricePoint): Step {
  const change = cheapest.previousPrice;
  if (!change || change.day > point.day) return { points: [point], previous: null };
  const old = Math.min(
    ...offers.map((offer) =>
      offer.previousPrice && offer.previousPrice.day >= change.day ? offer.previousPrice.value : offer.priceValue,
    ),
  );
  if (old === point.value) return { points: [point], previous: null };
  const before: PricePoint = { ...point, day: addDays(change.day, -1), value: old };
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
