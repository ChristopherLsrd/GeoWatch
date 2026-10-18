import { describe, expect, it, vi } from "vitest";
import type { FilmographyEntry } from "@/domain/Person";
import type { CachedPerson, PersonCache } from "@/domain/ports/PersonCache";
import type { CatalogPerson, PersonCatalog, RawFilmography } from "@/domain/ports/PersonCatalog";
import type { PersonInfoSource } from "@/domain/ports/PersonInfoSource";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";
import { GetPerson } from "./GetPerson";

const netflix = { id: "8", name: "Netflix", iconUrl: null };
const now = new Date("2026-10-18T10:00:00Z");

function entry(id: string, flatrate: FilmographyEntry["flatrate"] = {}): FilmographyEntry {
  return { id, type: "MOVIE", name: id, year: 2010, posterUrl: null, imdbId: null, tmdbId: "27205", runtime: 148, imdbScore: 8.8, tmdbScore: 8.4, flatrate };
}

const base: CatalogPerson = { id: "tp1725", name: "Christopher Nolan", birthDate: "1970-07-30", photoUrl: null, biographyFr: "Bio FR", biographyEn: "Bio EN" };

function setup(options: { subscriptions?: Subscription[]; cached?: CachedPerson | null; found?: boolean; failFind?: boolean; failSave?: boolean } = {}) {
  const catalogCalls: { id: string; countries: string[] }[] = [];
  const saved: CachedPerson[] = [];
  const raw: RawFilmography = { DIRECTOR: [entry("tm1", { FR: ["8"] })], ACTOR: [], ALL: [entry("tm1"), entry("tm2")] };
  const catalog: PersonCatalog = {
    async getPerson(id, countries) {
      catalogCalls.push({ id, countries });
      return options.found === false ? null : { person: base, filmography: raw };
    },
  };
  const cache: PersonCache = {
    async find(id, day) {
      if (options.failFind) throw new Error("mongo");
      return options.cached && id === options.cached.person.id && day === "2026-10-18" ? options.cached : null;
    },
    async save(e) {
      if (options.failSave) throw new Error("mongo");
      saved.push(e);
    },
  };
  const subscriptions: SubscriptionRepository = {
    async list() {
      return options.subscriptions ?? [{ platform: netflix, country: "FR" }];
    },
    async add() {},
    async remove() {},
  };
  const sources: PersonInfoSource[] = [];
  return { useCase: new GetPerson(catalog, sources, cache, subscriptions, () => now), catalogCalls, saved };
}

describe("GetPerson", () => {
  it("interroge le catalogue avec les pays d'abonnement, met en cache et calcule le badge", async () => {
    const { useCase, catalogCalls, saved } = setup();
    const page = await useCase.execute("tp1725");
    expect(catalogCalls).toEqual([{ id: "tp1725", countries: ["FR"] }]);
    expect(page?.person).toMatchObject({ name: "Christopher Nolan", biography: "Bio FR", biographySource: "justwatch" });
    expect(page?.filmography.DIRECTOR[0].availableAtHome).toEqual([{ platform: netflix, country: "FR" }]);
    expect(page?.filmography.OTHER.map((c) => c.id)).toEqual(["tm2"]);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ flatrateCountries: ["FR"], fetchedAt: now });
  });

  it("sert la fiche du jour depuis le cache, sans appeler le catalogue", async () => {
    const cached: CachedPerson = {
      person: { id: "tp1725", name: "Nolan (cache)", birthDate: null, deathDate: null, photoUrl: null, biography: null, biographySource: null, sourceUrl: null },
      filmography: { DIRECTOR: [entry("tm1", { FR: ["8"] })], ACTOR: [], OTHER: [] },
      flatrateCountries: ["FR"],
      fetchedAt: now,
    };
    const { useCase, catalogCalls } = setup({ cached });
    const page = await useCase.execute("tp1725");
    expect(catalogCalls).toHaveLength(0);
    expect(page?.person.name).toBe("Nolan (cache)");
    expect(page?.filmography.DIRECTOR[0].availableAtHome).toHaveLength(1);
  });

  it("réinterroge le catalogue quand un pays d'abonnement manque au cache", async () => {
    const cached: CachedPerson = {
      person: { id: "tp1725", name: "Nolan", birthDate: null, deathDate: null, photoUrl: null, biography: null, biographySource: null, sourceUrl: null },
      filmography: { DIRECTOR: [], ACTOR: [], OTHER: [] },
      flatrateCountries: ["FR"],
      fetchedAt: now,
    };
    const { useCase, catalogCalls } = setup({
      cached,
      subscriptions: [{ platform: netflix, country: "FR" }, { platform: netflix, country: "BE" }],
    });
    await useCase.execute("tp1725");
    expect(catalogCalls).toEqual([{ id: "tp1725", countries: ["FR", "BE"] }]);
  });

  it("renvoie null pour une personne inconnue ou un identifiant invalide", async () => {
    const unknown = setup({ found: false });
    expect(await unknown.useCase.execute("tp999")).toBeNull();
    expect(unknown.saved).toHaveLength(0);
    const invalid = setup();
    expect(await invalid.useCase.execute("tm92641")).toBeNull();
    expect(invalid.catalogCalls).toHaveLength(0);
  });

  it("renvoie la page même si l'écriture du cache échoue", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { useCase } = setup({ failSave: true });
    const page = await useCase.execute("tp1725");
    expect(page?.person.name).toBe("Christopher Nolan");
    spy.mockRestore();
  });

  it("interroge le catalogue si la lecture du cache échoue", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { useCase, catalogCalls } = setup({ failFind: true });
    const page = await useCase.execute("tp1725");
    expect(catalogCalls).toHaveLength(1);
    expect(page?.person.name).toBe("Christopher Nolan");
    spy.mockRestore();
  });
});
