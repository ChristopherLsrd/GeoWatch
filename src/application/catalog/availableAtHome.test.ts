import { describe, expect, it } from "vitest";
import type { Offer } from "@/domain/Offer";
import type { Subscription } from "@/domain/Subscription";
import { availableAtHome, homeOfferLink } from "./availableAtHome";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const canal = { id: "381", name: "Canal+", iconUrl: null };

function offer(platform: typeof netflix, country: string, monetizationType: Offer["monetizationType"]): Offer {
  return {
    country,
    platform,
    monetizationType,
    quality: "HD",
    price: null,
    priceValue: null,
    currency: null,
    audioLanguages: [],
    subtitleLanguages: [],
    url: null,
  };
}

const subscriptions: Subscription[] = [
  { platform: netflix, country: "FR" },
  { platform: canal, country: "FR" },
];

describe("availableAtHome", () => {
  it("retient les abonnements dont la plateforme propose le titre en abonnement dans le même pays", () => {
    expect(availableAtHome([offer(netflix, "FR", "FLATRATE")], subscriptions)).toEqual([{ platform: netflix, country: "FR" }]);
  });

  it("ignore les autres pays et les autres types d'offre", () => {
    expect(availableAtHome([offer(netflix, "BE", "FLATRATE"), offer(canal, "FR", "RENT")], subscriptions)).toEqual([]);
  });

  it("ne retient rien sans abonnement", () => {
    expect(availableAtHome([offer(netflix, "FR", "FLATRATE")], [])).toEqual([]);
  });
});

describe("homeOfferLink", () => {
  const home: Subscription = { platform: netflix, country: "FR" };
  const withLinks = (base: Offer, url: string | null, deepLinkUrl?: string | null): Offer => ({ ...base, url, deepLinkUrl });

  it("préfère le lien direct d'une offre en abonnement, même s'il est sur une autre offre que la première", () => {
    const offers = [
      withLinks(offer(netflix, "FR", "FLATRATE"), "https://netflix.com/title/1"),
      withLinks(offer(netflix, "FR", "FLATRATE"), "https://netflix.com/title/1", "https://netflix.com/watch/1"),
    ];
    expect(homeOfferLink(offers, home)).toBe("https://netflix.com/watch/1");
  });

  it("se replie sur l'URL de l'offre sans lien direct", () => {
    expect(homeOfferLink([withLinks(offer(netflix, "FR", "FLATRATE"), "https://netflix.com/title/1", null)], home)).toBe(
      "https://netflix.com/title/1",
    );
  });

  it("ignore les autres pays, plateformes et types d'offre", () => {
    const offers = [
      withLinks(offer(netflix, "BE", "FLATRATE"), "https://be", "https://be/watch"),
      withLinks(offer(canal, "FR", "FLATRATE"), "https://canal", "https://canal/watch"),
      withLinks(offer(netflix, "FR", "RENT"), "https://rent", "https://rent/watch"),
    ];
    expect(homeOfferLink(offers, home)).toBeNull();
  });

  it("ne renvoie rien sans lien connu", () => {
    expect(homeOfferLink([offer(netflix, "FR", "FLATRATE")], home)).toBeNull();
  });
});
