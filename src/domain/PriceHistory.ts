import type { CountryCode } from "./Country";

// Types d'offre dont on suit le prix.
export type PricedType = "RENT" | "BUY";

// Un prix, valable à partir de `day` (jour de Paris) : un point n'est ajouté que quand le prix change.
export type PricePoint = {
  day: string;
  value: number;
  currency: string;
  // Qualité de l'offre la moins chère (« HD », « 4K »).
  quality: string;
};

// Historique du prix le plus bas (HD et 4K) d'un titre, sur une plateforme, pour un type, dans un pays.
export type PriceHistory = {
  titleId: string;
  country: CountryCode;
  platformId: string;
  platformName: string;
  monetizationType: PricedType;
  // Du plus ancien au plus récent.
  points: PricePoint[];
};

// Une baisse compte si elle atteint l'un des deux seuils (montant dans la devise, pourcentage).
export type PriceThreshold = { amount: number; percent: number };

export const DEFAULT_PRICE_THRESHOLD: PriceThreshold = { amount: 0.5, percent: 10 };

// Tolérance pour les prix en flottants (3,99 − 3,49 = 0,4999…).
const EPSILON = 1e-6;

export function priceHistoryId(
  history: Pick<PriceHistory, "titleId" | "country" | "platformId" | "monetizationType">,
): string {
  return `${history.titleId}:${history.country}:${history.platformId}:${history.monetizationType}`;
}

export function isSignificantDrop(previous: number, value: number, threshold: PriceThreshold): boolean {
  if (value >= previous - EPSILON) return false;
  const drop = previous - value;
  return drop >= threshold.amount - EPSILON || (drop / previous) * 100 >= threshold.percent - EPSILON;
}

export function dropPercent(previous: number, value: number): number {
  return Math.round(((previous - value) / previous) * 100);
}

// Points dans la devise du dernier relevé : un changement de devise ne se compare pas.
export function currentCurrencyPoints(history: PriceHistory): PricePoint[] {
  const currency = history.points.at(-1)?.currency;
  return history.points.filter((point) => point.currency === currency);
}

export function priceRange(history: PriceHistory): { low: number; high: number } | null {
  const values = currentCurrencyPoints(history).map((point) => point.value);
  if (values.length === 0) return null;
  return { low: Math.min(...values), high: Math.max(...values) };
}

// Dernier changement de prix : les deux derniers points, s'ils sont dans la même devise.
export function lastChange(history: PriceHistory): { previous: PricePoint; current: PricePoint } | null {
  const [previous, current] = history.points.slice(-2);
  if (!previous || !current || previous.currency !== current.currency) return null;
  return { previous, current };
}
