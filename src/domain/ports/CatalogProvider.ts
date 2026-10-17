import type { CountryCode } from "../Country";
import type { Offer, Platform } from "../Offer";
import type { Title } from "../Title";

export interface CatalogProvider {
  searchTitles(query: string): Promise<Title[]>;
  getTitle(titleId: string): Promise<Title | null>;
  // Offres du titre pour chaque pays demandé (liste vide si aucune).
  getOffers(titleId: string, countries: CountryCode[]): Promise<Record<CountryCode, Offer[]>>;
  // Plateformes proposant un abonnement dans le pays, pour choisir ses abonnements.
  listSubscriptionPlatforms(country: CountryCode): Promise<Platform[]>;
}

// Le catalogue refuse temporairement nos requêtes (limitation, blocage, panne).
export class CatalogUnavailableError extends Error {
  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}
