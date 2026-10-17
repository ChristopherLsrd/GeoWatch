import { describe, expect, it } from "vitest";
import type { Offer } from "@/domain/Offer";
import type { Subscription } from "@/domain/Subscription";
import { availableAtHome } from "./availableAtHome";

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
