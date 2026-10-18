// Libellés français du guide parental et liens vers la page d'une classification.

import { DEFAULT_RATING_FILTERS, ratingSearchParams, type RatingFilters } from "@/application/ratings/ratingParams";
import type { AdvisoryCategory, Severity } from "@/domain/ContentAdvisory";

export const ADVISORY_LABELS: Record<AdvisoryCategory, string> = {
  nudity: "Nudité et sexe",
  violence: "Violence",
  profanity: "Langage",
  alcohol: "Alcool, drogues et tabac",
  frightening: "Scènes effrayantes",
};

export const SEVERITY_LABELS: Record<Severity, string> = {
  none: "aucune",
  mild: "légère",
  moderate: "modérée",
  severe: "forte",
};

export function ratingHref(country: string, code: string, filters: Partial<RatingFilters> = {}): string {
  const query = ratingSearchParams({ ...DEFAULT_RATING_FILTERS, ...filters }).toString();
  return `/classification/${encodeURIComponent(country)}/${encodeURIComponent(code)}${query ? `?${query}` : ""}`;
}
