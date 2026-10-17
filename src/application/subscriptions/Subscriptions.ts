// Gestion des abonnements (plateforme + pays).

import { isCountryCode, type CountryCode } from "@/domain/Country";
import type { Platform } from "@/domain/Offer";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";

export class InvalidCountryError extends Error {}
export class PlatformNotFoundError extends Error {}

export class Subscriptions {
  constructor(
    private readonly repository: SubscriptionRepository,
    private readonly catalog: CatalogProvider,
  ) {}

  list(): Promise<Subscription[]> {
    return this.repository.list();
  }

  async availablePlatforms(country: CountryCode): Promise<Platform[]> {
    return this.catalog.listSubscriptionPlatforms(validCountry(country));
  }

  // La plateforme est relue dans le catalogue du pays : son nom et son icône viennent de là.
  async add(platformId: string, country: CountryCode): Promise<Subscription> {
    const code = validCountry(country);
    const platform = (await this.catalog.listSubscriptionPlatforms(code)).find((p) => p.id === platformId);
    if (!platform) throw new PlatformNotFoundError(`${platformId} (${code})`);
    const subscription = { platform, country: code };
    await this.repository.add(subscription);
    return subscription;
  }

  async remove(platformId: string, country: CountryCode): Promise<void> {
    return this.repository.remove(platformId, validCountry(country));
  }
}

function validCountry(country: string): CountryCode {
  const code = country.toUpperCase();
  if (!isCountryCode(code)) throw new InvalidCountryError(country);
  return code;
}
