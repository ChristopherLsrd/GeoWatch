import { describe, expect, it } from "vitest";
import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { SubscriptionRepository } from "@/domain/ports/SubscriptionRepository";
import type { Subscription } from "@/domain/Subscription";
import { InvalidCountryError, PlatformNotFoundError, Subscriptions } from "./Subscriptions";

class InMemorySubscriptions implements SubscriptionRepository {
  items: Subscription[] = [];
  async list() {
    return this.items;
  }
  async add(subscription: Subscription) {
    const exists = this.items.some((s) => s.platform.id === subscription.platform.id && s.country === subscription.country);
    if (!exists) this.items.push(subscription);
  }
  async remove(platformId: string, country: string) {
    this.items = this.items.filter((s) => !(s.platform.id === platformId && s.country === country));
  }
}

const netflix = { id: "8", name: "Netflix", iconUrl: "https://images.justwatch.com/icon/1/s100/netflix.png" };

function setup() {
  const repository = new InMemorySubscriptions();
  const catalog: CatalogProvider = {
    searchTitles: async () => [],
    getTitleDetails: async () => null,
    getTitle: async () => null,
    getOffers: async () => ({}),
    listSubscriptionPlatforms: async (country) => (country === "FR" ? [netflix] : []),
  };
  return { repository, subscriptions: new Subscriptions(repository, catalog) };
}

describe("Subscriptions", () => {
  it("ajoute un abonnement avec le nom et l'icône du catalogue, sans doublon", async () => {
    const { subscriptions } = setup();
    expect(await subscriptions.add("8", "fr")).toEqual({ platform: netflix, country: "FR" });
    await subscriptions.add("8", "FR");
    expect(await subscriptions.list()).toEqual([{ platform: netflix, country: "FR" }]);
  });

  it("refuse une plateforme absente du pays ou un pays invalide", async () => {
    const { subscriptions } = setup();
    await expect(subscriptions.add("8", "BE")).rejects.toBeInstanceOf(PlatformNotFoundError);
    await expect(subscriptions.add("8", "France")).rejects.toBeInstanceOf(InvalidCountryError);
    await expect(subscriptions.availablePlatforms("FRA")).rejects.toBeInstanceOf(InvalidCountryError);
  });

  it("retire un abonnement", async () => {
    const { subscriptions } = setup();
    await subscriptions.add("8", "FR");
    await subscriptions.remove("8", "fr");
    expect(await subscriptions.list()).toEqual([]);
  });
});
