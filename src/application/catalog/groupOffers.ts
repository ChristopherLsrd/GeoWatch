// Regroupement et filtrage des offres pour l'affichage. Fonctions pures, utilisables côté client.

import { PRIORITY_1, PRIORITY_2 } from "@/config/countries";
import { PLATFORM_GROUP_RULES } from "@/config/platformGroups";
import { countryFlag, countryName, type CountryCode } from "@/domain/Country";
import type { LanguageCode } from "@/domain/Language";
import { MONETIZATION_TYPES, type MonetizationType } from "@/domain/MonetizationType";
import type { Offer, Platform } from "@/domain/Offer";

export type CountryRow = {
  country: CountryCode;
  name: string;
  flag: string;
  // Types d'offre présents dans ce pays, dans l'ordre Abonnement, Gratuit, Pub, Location, Achat.
  types: MonetizationType[];
  // Toutes les offres du pays (doublons retirés), par type, puis variante, puis qualité.
  offers: Offer[];
  audioLanguages: LanguageCode[];
  subtitleLanguages: LanguageCode[];
};

// Une plateforme affichée : un service et ses variantes (voir src/config/platformGroups.ts).
export type PlatformGroup = {
  id: string;
  name: string;
  iconUrl: string | null;
  // Plateformes JustWatch réunies, par nom.
  platforms: Platform[];
  subscribed: boolean;
  countryCount: number;
  countries: CountryRow[];
};

export type OfferFilters = {
  monetizationTypes?: MonetizationType[];
  // Identifiants de PlatformGroup.
  platformGroupIds?: string[];
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
      (!filters.platformGroupIds?.length || filters.platformGroupIds.includes(platformGroupId(offer.platform))) &&
      (!filters.audioLanguage || offer.audioLanguages.includes(filters.audioLanguage)) &&
      (!filters.subtitleLanguage || offer.subtitleLanguages.includes(filters.subtitleLanguage)),
  );
}

// Identifiant du groupe d'une plateforme : la règle qui correspond, sinon la plateforme seule.
export function platformGroupId(platform: Platform): string {
  const rule = PLATFORM_GROUP_RULES.find((r) => r.match.test(platform.name));
  return rule ? `group:${rule.key}` : platform.id;
}

function groupName(id: string, platforms: Platform[]): string {
  return PLATFORM_GROUP_RULES.find((r) => `group:${r.key}` === id)?.name ?? platforms[0].name;
}

// Les offres strictement identiques (JustWatch en renvoie parfois plusieurs) ne comptent qu'une fois.
function dedupe(offers: Offer[]): Offer[] {
  const seen = new Set<string>();
  return offers.filter((offer) => {
    const key = JSON.stringify([
      offer.country,
      offer.platform.id,
      offer.monetizationType,
      offer.quality,
      offer.price,
      offer.audioLanguages,
      offer.subtitleLanguages,
    ]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function compareOffers(a: Offer, b: Offer): number {
  return (
    MONETIZATION_TYPES.indexOf(a.monetizationType) - MONETIZATION_TYPES.indexOf(b.monetizationType) ||
    a.platform.name.localeCompare(b.platform.name, "fr") ||
    qualityRank(a.quality) - qualityRank(b.quality)
  );
}

export function groupOffers(offers: Offer[], options: { subscribedPlatformIds?: string[] } = {}): PlatformGroup[] {
  const subscribed = new Set(options.subscribedPlatformIds ?? []);
  const byGroup = new Map<string, Offer[]>();
  for (const offer of dedupe(offers)) {
    const id = platformGroupId(offer.platform);
    byGroup.set(id, [...(byGroup.get(id) ?? []), offer]);
  }

  const groups: PlatformGroup[] = [...byGroup.entries()].map(([id, members]) => {
    const platforms = [...new Map(members.map((o) => [o.platform.id, o.platform])).values()].sort((a, b) =>
      a.name.localeCompare(b.name, "fr"),
    );
    // Icône du service principal : la variante au nom le plus court (« Netflix », « Canal+ »…).
    const main = [...platforms].sort((a, b) => a.name.length - b.name.length)[0];
    const countries = [...new Set(members.map((offer) => offer.country))].sort(compareCountries);
    return {
      id,
      name: groupName(id, platforms),
      iconUrl: main.iconUrl ?? platforms.find((p) => p.iconUrl)?.iconUrl ?? null,
      platforms,
      subscribed: platforms.some((p) => subscribed.has(p.id)),
      countryCount: countries.length,
      countries: countries.map((country): CountryRow => {
        const countryOffers = members.filter((offer) => offer.country === country).sort(compareOffers);
        return {
          country,
          name: countryName(country),
          flag: countryFlag(country),
          types: MONETIZATION_TYPES.filter((type) => countryOffers.some((o) => o.monetizationType === type)),
          offers: countryOffers,
          audioLanguages: union(countryOffers.map((offer) => offer.audioLanguages)),
          subtitleLanguages: union(countryOffers.map((offer) => offer.subtitleLanguages)),
        };
      }),
    };
  });

  return groups.sort(
    (a, b) =>
      Number(b.subscribed) - Number(a.subscribed) ||
      b.countryCount - a.countryCount ||
      a.name.localeCompare(b.name, "fr"),
  );
}
