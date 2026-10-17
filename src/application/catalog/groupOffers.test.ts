import { describe, expect, it } from "vitest";
import type { Offer } from "@/domain/Offer";
import { filterOffers, groupOffers } from "./groupOffers";

function offer(overrides: Partial<Omit<Offer, "platform">> & { country: string; platform?: string }): Offer {
  const { platform = "netflix", ...rest } = overrides;
  return {
    platform: { id: platform, name: platform.toUpperCase(), iconUrl: null },
    monetizationType: "FLATRATE",
    quality: "HD",
    price: null,
    priceValue: null,
    currency: null,
    audioLanguages: [],
    subtitleLanguages: [],
    url: null,
    ...rest,
  };
}

describe("groupOffers", () => {
  it("regroupe par plateforme puis par type d'offre, dans l'ordre Abonnement, Gratuit, Pub, Location, Achat", () => {
    const groups = groupOffers([
      offer({ country: "FR", monetizationType: "BUY" }),
      offer({ country: "FR", monetizationType: "RENT" }),
      offer({ country: "FR", monetizationType: "ADS" }),
      offer({ country: "FR", monetizationType: "FLATRATE" }),
      offer({ country: "FR", monetizationType: "FREE" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].types.map((t) => t.label)).toEqual(["Abonnement", "Gratuit", "Gratuit avec pub", "Location", "Achat"]);
  });

  it("met les plateformes abonnées d'abord, puis par nombre de pays décroissant", () => {
    const groups = groupOffers(
      [
        offer({ country: "FR", platform: "a" }),
        offer({ country: "FR", platform: "b" }),
        offer({ country: "BE", platform: "b" }),
        offer({ country: "FR", platform: "c" }),
        offer({ country: "BE", platform: "c" }),
        offer({ country: "CH", platform: "c" }),
      ],
      { subscribedPlatformIds: ["a"] },
    );
    expect(groups.map((g) => [g.platform.id, g.countryCount, g.subscribed])).toEqual([
      ["a", 1, true],
      ["c", 3, false],
      ["b", 2, false],
    ]);
  });

  it("trie les pays : priorités dans l'ordre de la configuration, puis les autres par nom français", () => {
    const groups = groupOffers(
      ["US", "DE", "SN", "BE", "FR", "ES"].map((country) => offer({ country })),
    );
    // Allemagne, Espagne, États-Unis : ordre alphabétique français.
    expect(groups[0].types[0].countries.map((c) => c.country)).toEqual(["FR", "BE", "SN", "DE", "ES", "US"]);
  });

  it("rassemble les qualités d'un même pays et fusionne les langues", () => {
    const groups = groupOffers([
      offer({ country: "FR", quality: "SD", audioLanguages: ["fr"], subtitleLanguages: ["fr"] }),
      offer({ country: "FR", quality: "4K", audioLanguages: ["en", "fr"], subtitleLanguages: [] }),
    ]);
    const row = groups[0].types[0].countries[0];
    expect(row.name).toBe("France");
    expect(row.flag).toBe("🇫🇷");
    expect(row.offers.map((o) => o.quality)).toEqual(["4K", "SD"]);
    expect(row.audioLanguages).toEqual(["en", "fr"]);
    expect(row.subtitleLanguages).toEqual(["fr"]);
  });
});

describe("filterOffers", () => {
  const offers = [
    offer({ country: "FR", platform: "a", monetizationType: "FLATRATE", audioLanguages: ["fr"], subtitleLanguages: ["en"] }),
    offer({ country: "FR", platform: "b", monetizationType: "RENT", audioLanguages: ["en"] }),
    offer({ country: "US", platform: "a", monetizationType: "FLATRATE" }),
  ];

  it("ne filtre rien sans critère", () => {
    expect(filterOffers(offers, {})).toHaveLength(3);
  });

  it("filtre par type d'offre et par plateforme", () => {
    expect(filterOffers(offers, { monetizationTypes: ["RENT"] }).map((o) => o.platform.id)).toEqual(["b"]);
    expect(filterOffers(offers, { platformIds: ["a"] })).toHaveLength(2);
  });

  it("filtre par langue audio et sous-titres, en excluant les langues non renseignées", () => {
    expect(filterOffers(offers, { audioLanguage: "fr" }).map((o) => o.platform.id)).toEqual(["a"]);
    expect(filterOffers(offers, { subtitleLanguage: "en" })).toHaveLength(1);
  });
});
