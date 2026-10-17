import { describe, expect, it } from "vitest";
import type { Availability } from "@/domain/Availability";
import { parisDay } from "@/domain/CalendarDay";
import type { Offer } from "@/domain/Offer";
import type { AvailabilityCache } from "@/domain/ports/AvailabilityCache";
import { CatalogUnavailableError, type CatalogProvider } from "@/domain/ports/CatalogProvider";
import { GetTitleAvailability, InvalidCountriesError } from "./GetTitleAvailability";

class InMemoryCache implements AvailabilityCache {
  readonly items: Availability[] = [];
  async find(titleId: string, countries: string[], day: string) {
    return this.items.filter(
      (a) => a.titleId === titleId && countries.includes(a.country) && parisDay(a.fetchedAt) === day,
    );
  }
  async save(availabilities: Availability[]) {
    for (const a of availabilities) {
      const i = this.items.findIndex((x) => x.titleId === a.titleId && x.country === a.country);
      if (i === -1) this.items.push(a);
      else this.items[i] = a;
    }
  }
}

function offerIn(country: string): Offer {
  return {
    country,
    platform: { id: "8", name: "Netflix", iconUrl: null },
    monetizationType: "FLATRATE",
    quality: "HD",
    price: null,
    priceValue: null,
    currency: null,
    audioLanguages: [],
    subtitleLanguages: [],
    url: null,
  };
}

class FakeCatalog implements CatalogProvider {
  calls: string[][] = [];
  failing = false;
  async searchTitles() {
    return [];
  }
  async getTitleDetails() {
    return null;
  }
  async getTitle() {
    return null;
  }
  async listSubscriptionPlatforms() {
    return [];
  }
  async getOffers(_titleId: string, countries: string[]) {
    if (this.failing) throw new CatalogUnavailableError("limité");
    this.calls.push(countries);
    return Object.fromEntries(countries.map((c) => [c, c === "US" ? [] : [offerIn(c)]]));
  }
}

function setup(now = new Date("2026-10-17T10:00:00Z")) {
  const cache = new InMemoryCache();
  const catalog = new FakeCatalog();
  const clock = { now };
  const useCase = new GetTitleAvailability(catalog, cache, () => clock.now);
  return { cache, catalog, clock, useCase };
}

describe("GetTitleAvailability", () => {
  it("interroge le catalogue puis met le résultat en cache, pays sans offre compris", async () => {
    const { useCase, catalog, cache } = setup();
    const result = await useCase.execute("tm1", ["FR", "US"]);
    expect(catalog.calls).toEqual([["FR", "US"]]);
    expect(result.FR.offers).toHaveLength(1);
    expect(result.US.offers).toEqual([]);
    expect(cache.items.map((a) => a.country)).toEqual(["FR", "US"]);
  });

  it("sert le cache le même jour sans rappeler le catalogue", async () => {
    const { useCase, catalog } = setup();
    await useCase.execute("tm1", ["FR", "US"]);
    const result = await useCase.execute("tm1", ["FR", "US"]);
    expect(catalog.calls).toHaveLength(1);
    expect(result.FR.fetchedAt).toEqual(new Date("2026-10-17T10:00:00Z"));
  });

  it("ne réinterroge que les pays manquants", async () => {
    const { useCase, catalog } = setup();
    await useCase.execute("tm1", ["FR"]);
    const result = await useCase.execute("tm1", ["FR", "BE", "CH"]);
    expect(catalog.calls).toEqual([["FR"], ["BE", "CH"]]);
    expect(Object.keys(result).sort()).toEqual(["BE", "CH", "FR"]);
  });

  it("réinterroge le lendemain, heure de Paris", async () => {
    const { useCase, catalog, clock } = setup(new Date("2026-10-17T21:00:00Z"));
    await useCase.execute("tm1", ["FR"]);
    // 22 h 30 UTC = 0 h 30 le 18 à Paris.
    clock.now = new Date("2026-10-17T22:30:00Z");
    await useCase.execute("tm1", ["FR"]);
    expect(catalog.calls).toHaveLength(2);
  });

  it("force un nouvel appel avec refresh", async () => {
    const { useCase, catalog } = setup();
    await useCase.execute("tm1", ["FR"]);
    await useCase.execute("tm1", ["FR"], { refresh: true });
    expect(catalog.calls).toHaveLength(2);
  });

  it("laisse remonter l'indisponibilité du catalogue sans rien mettre en cache", async () => {
    const { useCase, catalog, cache } = setup();
    catalog.failing = true;
    await expect(useCase.execute("tm1", ["FR"])).rejects.toBeInstanceOf(CatalogUnavailableError);
    expect(cache.items).toEqual([]);
  });

  it("refuse les lots vides, trop grands ou invalides", async () => {
    const { useCase } = setup();
    await expect(useCase.execute("tm1", [])).rejects.toBeInstanceOf(InvalidCountriesError);
    await expect(useCase.execute("tm1", ["FRA"])).rejects.toBeInstanceOf(InvalidCountriesError);
    const many = Array.from({ length: 21 }, (_, i) => `A${String.fromCharCode(65 + i)}`);
    await expect(useCase.execute("tm1", many)).rejects.toBeInstanceOf(InvalidCountriesError);
  });
});
