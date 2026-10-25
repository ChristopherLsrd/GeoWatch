import type { CountryCode } from "./Country";
import type { LanguageCode } from "./Language";
import type { MonetizationType } from "./MonetizationType";

export type Platform = {
  id: string;
  name: string;
  iconUrl: string | null;
};

// Une offre d'un titre sur une plateforme, dans un pays.
export type Offer = {
  country: CountryCode;
  platform: Platform;
  monetizationType: MonetizationType;
  // « SD », « HD », « 4K »… tel que fourni par le catalogue.
  quality: string;
  // Prix déjà formaté (« 3,99 € »), absent pour les abonnements et le gratuit.
  price: string | null;
  priceValue: number | null;
  currency: string | null;
  // Listes vides quand le catalogue ne renseigne pas les langues.
  audioLanguages: LanguageCode[];
  subtitleLanguages: LanguageCode[];
  url: string | null;
  // Ouvre directement la lecture sur la plateforme. Absent des offres mises en cache avant son ajout.
  deepLinkUrl?: string | null;
  // Prix d'avant le dernier changement, et date de ce changement (« 2025-06-09 »), selon JustWatch.
  // Absent des offres mises en cache avant son ajout.
  previousPrice?: { value: number; day: string } | null;
};
