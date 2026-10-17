// Regroupement et filtrage des offres pour l'affichage. Fonctions pures, utilisables côté client.

import { PRIORITY_1, PRIORITY_2 } from "@/config/countries";
import { countryFlag, countryName, type CountryCode } from "@/domain/Country";
import type { LanguageCode } from "@/domain/Language";
import { MONETIZATION_LABELS, MONETIZATION_TYPES, type MonetizationType } from "@/domain/MonetizationType";
import type { Offer, Platform } from "@/domain/Offer";

export type CountryRow = {
  country: CountryCode;
  name: string;
  flag: string;
  // Une offre par qualité, de la meilleure à la moins bonne.
  offers: Offer[];
  audioLanguages: LanguageCode[];
  subtitleLanguages: LanguageCode[];
};

export type MonetizationGroup = {
  type: MonetizationType;
  label: string;
  countries: CountryRow[];
};

export type PlatformGroup = {
  platform: Platform;
  subscribed: boolean;
  countryCount: number;
  types: MonetizationGroup[];
};

export type OfferFilters = {
  monetizationTypes?: MonetizationType[];
  platformIds?: string[];
  audioLanguage?: LanguageCode;
  subtitleLanguage?: LanguageCode;
};

const PRIORITY_ORDER = [...PRIORITY_1, ...PRIORITY_2];
const QUALITY_ORDER = ["8K", "4K", "HD", "SD", "BLURAY_4K", "BLURAY", "DVD"];

function compareCountries(a: CountryCode, b: CountryCode): number {
  const pa = PRIORITY_ORDER.indexOf(a);
  const pb = PRIORITY_ORDER.indexOf(b);
  if (pa !== -1 || pb !== -1) return (pa === -1 ? Infinity : pa) - (pb === -1 ? Infinity : pb);
  return countryName(a).localeCompare(countryName(b), "fr");
}

function qualityRank(quality: string): number {
  const rank = QUALITY_ORDER.indexOf(quality);
  return rank === -1 ? QUALITY_ORDER.length : rank;
}

function union(lists: LanguageCode[][]): LanguageCode[] {
  return [...new Set(lists.flat())].sort();
}

export function filterOffers(offers: Offer[], filters: OfferFilters): Offer[] {
  return offers.filter(
    (offer) =>
      (!filters.monetizationTypes?.length || filters.monetizationTypes.includes(offer.monetizationType)) &&
      (!filters.platformIds?.length || filters.platformIds.includes(offer.platform.id)) &&
      (!filters.audioLanguage || offer.audioLanguages.includes(filters.audioLanguage)) &&
      (!filters.subtitleLanguage || offer.subtitleLanguages.includes(filters.subtitleLanguage)),
  );
}

export function groupOffers(offers: Offer[], options: { subscribedPlatformIds?: string[] } = {}): PlatformGroup[] {
  const subscribed = new Set(options.subscribedPlatformIds ?? []);
  const byPlatform = new Map<string, Offer[]>();
  for (const offer of offers) {
    const list = byPlatform.get(offer.platform.id) ?? [];
    list.push(offer);
    byPlatform.set(offer.platform.id, list);
  }

  const groups: PlatformGroup[] = [...byPlatform.values()].map((platformOffers) => {
    const types = MONETIZATION_TYPES.map((type): MonetizationGroup => {
      const typeOffers = platformOffers.filter((offer) => offer.monetizationType === type);
      const countries = [...new Set(typeOffers.map((offer) => offer.country))].sort(compareCountries);
      return {
        type,
        label: MONETIZATION_LABELS[type],
        countries: countries.map((country) => {
          const countryOffers = typeOffers
            .filter((offer) => offer.country === country)
            .sort((a, b) => qualityRank(a.quality) - qualityRank(b.quality));
          return {
            country,
            name: countryName(country),
            flag: countryFlag(country),
            offers: countryOffers,
            audioLanguages: union(countryOffers.map((offer) => offer.audioLanguages)),
            subtitleLanguages: union(countryOffers.map((offer) => offer.subtitleLanguages)),
          };
        }),
      };
    }).filter((group) => group.countries.length > 0);

    const platform = platformOffers[0].platform;
    return {
      platform,
      subscribed: subscribed.has(platform.id),
      countryCount: new Set(platformOffers.map((offer) => offer.country)).size,
      types,
    };
  });

  return groups.sort(
    (a, b) =>
      Number(b.subscribed) - Number(a.subscribed) ||
      b.countryCount - a.countryCount ||
      a.platform.name.localeCompare(b.platform.name, "fr"),
  );
}
