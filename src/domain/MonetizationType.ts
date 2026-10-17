// Type d'offre, dans l'ordre d'affichage.

export const MONETIZATION_TYPES = ["FLATRATE", "FREE", "ADS", "RENT", "BUY"] as const;

export type MonetizationType = (typeof MONETIZATION_TYPES)[number];

export const MONETIZATION_LABELS: Record<MonetizationType, string> = {
  FLATRATE: "Abonnement",
  FREE: "Gratuit",
  ADS: "Gratuit avec pub",
  RENT: "Location",
  BUY: "Achat",
};

export function isMonetizationType(value: string): value is MonetizationType {
  return (MONETIZATION_TYPES as readonly string[]).includes(value);
}
