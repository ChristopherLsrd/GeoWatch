import { BATCH_SIZE } from "@/config/countries";
import { isCountryCode, type CountryCode } from "@/domain/Country";
import type { Offer } from "@/domain/Offer";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";

export class InvalidCountriesError extends Error {}

// Disponibilités d'un titre pour un lot de pays. Le client enchaîne les lots
// (voir countryBatches) pour un affichage progressif.
export class GetTitleAvailability {
  constructor(private readonly catalog: CatalogProvider) {}

  async execute(titleId: string, countries: CountryCode[]): Promise<Record<CountryCode, Offer[]>> {
    const unique = [...new Set(countries.map((country) => country.toUpperCase()))];
    if (unique.length === 0 || unique.length > BATCH_SIZE || !unique.every(isCountryCode)) {
      throw new InvalidCountriesError(`Entre 1 et ${BATCH_SIZE} codes pays valides attendus`);
    }
    return this.catalog.getOffers(titleId, unique);
  }
}
