import { BATCH_SIZE } from "@/config/countries";
import type { Availability } from "@/domain/Availability";
import { parisDay } from "@/domain/CalendarDay";
import { isCountryCode, type CountryCode } from "@/domain/Country";
import type { AvailabilityCache } from "@/domain/ports/AvailabilityCache";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";

export class InvalidCountriesError extends Error {}

// Disponibilités d'un titre pour un lot de pays. Le client enchaîne les lots
// (voir countryBatches) pour un affichage progressif.
// Le cache vaut pour le jour calendaire de Paris ; seuls les pays absents du cache du jour
// sont demandés au catalogue, donc une recherche interrompue reprend là où elle s'est arrêtée.
export class GetTitleAvailability {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly cache: AvailabilityCache,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async execute(
    titleId: string,
    countries: CountryCode[],
    options: { refresh?: boolean } = {},
  ): Promise<Record<CountryCode, Availability>> {
    const unique = [...new Set(countries.map((country) => country.toUpperCase()))];
    if (unique.length === 0 || unique.length > BATCH_SIZE || !unique.every(isCountryCode)) {
      throw new InvalidCountriesError(`Entre 1 et ${BATCH_SIZE} codes pays valides attendus`);
    }

    const now = this.clock();
    const cached = options.refresh ? [] : await this.cache.find(titleId, unique, parisDay(now));
    const result: Record<CountryCode, Availability> = Object.fromEntries(cached.map((a) => [a.country, a]));

    const missing = unique.filter((country) => !result[country]);
    if (missing.length > 0) {
      const offers = await this.catalog.getOffers(titleId, missing);
      const fetched = missing.map((country) => ({ titleId, country, offers: offers[country] ?? [], fetchedAt: now }));
      await this.cache.save(fetched);
      for (const availability of fetched) result[availability.country] = availability;
    }

    return result;
  }
}
