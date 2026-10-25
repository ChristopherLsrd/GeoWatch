import { describe, expect, it } from "vitest";
import type { Offer } from "@/domain/Offer";
import type { PriceHistory } from "@/domain/PriceHistory";
import type { Title } from "@/domain/Title";
import { trackPrices } from "./trackPrices";

const apple = { id: "2", name: "Apple TV Store", iconUrl: null };
const title: Title = { id: "tm1", type: "MOVIE", name: "Oppenheimer", year: 2023, posterUrl: null, imdbId: null, tmdbId: null };
// Jour de Paris : 2026-10-25.
const NOW = new Date("2026-10-25T05:00:00Z");
const threshold = { amount: 0.5, percent: 10 };

function priced(monetizationType: Offer["monetizationType"], value: number | null, extra: Partial<Offer> = {}): Offer {
  return {
    country: "FR",
    platform: apple,
    monetizationType,
    quality: "HD",
    price: value === null ? null : `${value} €`,
    priceValue: value,
    currency: "EUR",
    audioLanguages: [],
    subtitleLanguages: [],
    url: null,
    ...extra,
  };
}

function history(points: [string, number, string?][], monetizationType: "RENT" | "BUY" = "RENT"): PriceHistory {
  return {
    titleId: "tm1",
    country: "FR",
    platformId: "2",
    platformName: "Apple TV Store",
    monetizationType,
    points: points.map(([day, value, currency = "EUR"]) => ({ day, value, currency, quality: "HD" })),
  };
}

const run = (offers: Offer[], histories: PriceHistory[] = [], atHome = false) =>
  trackPrices({ title, offers, histories, atHome, threshold, now: NOW });

const points = (h: PriceHistory) => h.points.map((p) => [p.day, p.value]);

describe("trackPrices", () => {
  it("ignore les offres hors de France, en SD, physiques, sans prix ou en abonnement", () => {
    const result = run([
      priced("RENT", 3.99, { country: "BE" }),
      priced("RENT", 2.99, { quality: "SD" }),
      priced("BUY", 19.99, { quality: "BLURAY" }),
      priced("RENT", null),
      priced("FLATRATE", null),
    ]);
    expect(result).toEqual({ changed: [], alerts: [] });
  });

  it("garde le prix le plus bas en HD et 4K, par plateforme et par type", () => {
    const { changed } = run([
      priced("RENT", 4.99),
      priced("RENT", 3.99, { quality: "4K" }),
      priced("RENT", 1.99, { quality: "SD" }),
      priced("BUY", 13.99),
    ]);
    expect(changed.map((h) => [h.monetizationType, h.points])).toEqual([
      ["RENT", [{ day: "2026-10-25", value: 3.99, currency: "EUR", quality: "4K" }]],
      ["BUY", [{ day: "2026-10-25", value: 13.99, currency: "EUR", quality: "HD" }]],
    ]);
  });

  it("à prix égal, retient la HD", () => {
    const { changed } = run([priced("RENT", 3.99, { quality: "4K" }), priced("RENT", 3.99)]);
    expect(changed[0].points[0].quality).toBe("HD");
  });

  it("premier relevé sans changement connu : un seul point, aucune alerte", () => {
    const { changed, alerts } = run([priced("RENT", 3.99, { previousPrice: null })]);
    expect(changed.map(points)).toEqual([[["2026-10-25", 3.99]]]);
    expect(changed[0]).toMatchObject({ titleId: "tm1", country: "FR", platformId: "2", platformName: "Apple TV Store" });
    expect(alerts).toEqual([]);
  });

  it("premier relevé : reprend le changement JustWatch, sans alerte s'il date de plus de 7 jours", () => {
    const { changed, alerts } = run([priced("RENT", 3.99, { previousPrice: { value: 4.99, day: "2026-10-17" } })]);
    expect(changed.map(points)).toEqual([[["2026-10-16", 4.99], ["2026-10-17", 3.99]]]);
    expect(alerts).toEqual([]);
  });

  it("premier relevé : alerte si le changement JustWatch date de 7 jours au plus", () => {
    const { alerts } = run([priced("RENT", 3.99, { previousPrice: { value: 4.99, day: "2026-10-18" } })]);
    expect(alerts.map((a) => a.id)).toEqual(["tm1:PRICE_DROP:FR:2:RENT:3.99"]);
  });

  it("premier relevé : un changement JustWatch daté du futur est ignoré", () => {
    const { changed } = run([priced("RENT", 3.99, { previousPrice: { value: 4.99, day: "2026-10-26" } })]);
    expect(changed.map(points)).toEqual([[["2026-10-25", 3.99]]]);
  });

  it("prix inchangé : rien à enregistrer", () => {
    expect(run([priced("RENT", 3.99)], [history([["2026-10-20", 3.99]])])).toEqual({ changed: [], alerts: [] });
  });

  it("hausse : nouveau point, aucune alerte", () => {
    const { changed, alerts } = run([priced("RENT", 4.99)], [history([["2026-10-20", 3.99]])]);
    expect(changed.map(points)).toEqual([[["2026-10-20", 3.99], ["2026-10-25", 4.99]]]);
    expect(alerts).toEqual([]);
  });

  it("baisse sous les deux seuils : nouveau point, aucune alerte", () => {
    const { changed, alerts } = run([priced("RENT", 4.69)], [history([["2026-10-20", 4.99]])]);
    expect(changed).toHaveLength(1);
    expect(alerts).toEqual([]);
  });

  it("baisse au seuil par le montant seul ou par le pourcentage seul : alerte", () => {
    expect(run([priced("BUY", 14.49)], [history([["2026-10-20", 14.99]], "BUY")]).alerts).toHaveLength(1);
    expect(run([priced("RENT", 2.69)], [history([["2026-10-20", 2.99]])]).alerts).toHaveLength(1);
  });

  it("titre disponible chez moi : historique mis à jour, aucune alerte", () => {
    const { changed, alerts } = run([priced("RENT", 2.99)], [history([["2026-10-20", 4.99]])], true);
    expect(changed).toHaveLength(1);
    expect(alerts).toEqual([]);
  });

  it("changement de devise : nouveau point, aucune alerte", () => {
    const { changed, alerts } = run([priced("RENT", 2.99)], [history([["2026-10-20", 4.99, "CHF"]])]);
    expect(changed.map(points)).toEqual([[["2026-10-20", 4.99], ["2026-10-25", 2.99]]]);
    expect(alerts).toEqual([]);
  });

  it("deux relevés le même jour : le second remplace le premier", () => {
    const known = history([["2026-10-20", 4.99], ["2026-10-25", 4.49]]);
    const lower = run([priced("RENT", 3.99)], [known]);
    expect(lower.changed.map(points)).toEqual([[["2026-10-20", 4.99], ["2026-10-25", 3.99]]]);
    expect(lower.alerts[0].price).toEqual({ previous: 4.99, value: 3.99, currency: "EUR", monetizationType: "RENT" });

    const back = run([priced("RENT", 4.99)], [known]);
    expect(back.changed.map(points)).toEqual([[["2026-10-20", 4.99]]]);
    expect(back.alerts).toEqual([]);
  });

  it("construit l'alerte de baisse", () => {
    const { alerts } = run([priced("RENT", 3.99)], [history([["2026-10-20", 4.99]])]);
    expect(alerts).toEqual([
      {
        id: "tm1:PRICE_DROP:FR:2:RENT:3.99",
        kind: "PRICE_DROP",
        title: { id: "tm1", name: "Oppenheimer", posterUrl: null },
        platform: apple,
        country: "FR",
        price: { previous: 4.99, value: 3.99, currency: "EUR", monetizationType: "RENT" },
        createdAt: NOW,
      },
    ]);
  });

  it("met à jour le nom de la plateforme", () => {
    const { changed } = run([priced("RENT", 4.99, { platform: { ...apple, name: "Apple TV" } })], [history([["2026-10-20", 3.99]])]);
    expect(changed[0].platformName).toBe("Apple TV");
  });

  it("ignore une offre à 0 € (pas de prix)", () => {
    expect(run([priced("RENT", 0)])).toEqual({ changed: [], alerts: [] });
  });

  it("premier relevé : l'ancien prix est le plus bas des offres HD et 4K", () => {
    const { changed, alerts } = run([
      priced("RENT", 4.99),
      priced("RENT", 3.99, { quality: "4K", previousPrice: { value: 6.99, day: "2026-10-21" } }),
    ]);
    expect(changed.map(points)).toEqual([[["2026-10-20", 4.99], ["2026-10-21", 3.99]]]);
    expect(changed[0].points[1].quality).toBe("4K");
    expect(alerts).toHaveLength(1);
    expect(alerts[0].price).toEqual({ previous: 4.99, value: 3.99, currency: "EUR", monetizationType: "RENT" });
  });

  it("premier relevé : pas de point de départ si le prix le plus bas n'a pas bougé", () => {
    const { changed, alerts } = run([
      priced("RENT", 4.99),
      priced("RENT", 4.99, { quality: "4K", previousPrice: { value: 6.99, day: "2026-10-21" } }),
    ]);
    expect(changed.map(points)).toEqual([[["2026-10-25", 4.99]]]);
    expect(changed[0].points[0].quality).toBe("HD");
    expect(alerts).toEqual([]);
  });
});
