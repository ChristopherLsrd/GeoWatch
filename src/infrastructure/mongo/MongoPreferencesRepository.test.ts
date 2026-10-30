import { MongoClient } from "mongodb";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { InvalidPreferencesError, UserPreferences } from "@/application/preferences/UserPreferences";
import { DEFAULT_NOTIFICATIONS } from "@/domain/Preferences";
import { DEFAULT_PRICE_THRESHOLD } from "@/domain/PriceHistory";
import { MongoPreferencesRepository } from "./MongoPreferencesRepository";

let server: MongoMemoryServer;
let client: MongoClient;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  client = await new MongoClient(server.getUri()).connect();
}, 120_000);

afterAll(async () => {
  await client?.close();
  await server?.stop();
});

const setup = (dbName: string) => new UserPreferences(new MongoPreferencesRepository(async () => client.db(dbName)));

describe("UserPreferences avec Mongo", () => {
  it("renvoie l'absence de préférence par défaut", async () => {
    expect(await setup("p1").get()).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
      notifications: DEFAULT_NOTIFICATIONS,
    });
  });

  it("enregistre et remplace les préférences", async () => {
    const preferences = setup("p2");
    await preferences.update({ audioLanguage: "fr", subtitleLanguage: "pt-BR" });
    expect(await preferences.get()).toEqual({
      audioLanguage: "fr",
      subtitleLanguage: "pt-BR",
      priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
      notifications: DEFAULT_NOTIFICATIONS,
    });
    await preferences.update({ audioLanguage: "original", subtitleLanguage: null });
    expect(await preferences.get()).toEqual({
      audioLanguage: "original",
      subtitleLanguage: null,
      priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
      notifications: DEFAULT_NOTIFICATIONS,
    });
    await preferences.update({ audioLanguage: "", subtitleLanguage: null });
    expect(await preferences.get()).toEqual({
      audioLanguage: null,
      subtitleLanguage: null,
      priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
      notifications: DEFAULT_NOTIFICATIONS,
    });
  });

  it("refuse une langue invalide", async () => {
    const preferences = setup("p3");
    await expect(preferences.update({ audioLanguage: "français", subtitleLanguage: null })).rejects.toThrow(
      InvalidPreferencesError,
    );
    await expect(preferences.update({ audioLanguage: "fr", subtitleLanguage: 3 })).rejects.toThrow(
      InvalidPreferencesError,
    );
  });

  it("enregistre le seuil de baisse et garde les champs non envoyés", async () => {
    const preferences = setup("p4");
    await preferences.update({ audioLanguage: "fr", subtitleLanguage: null });
    await preferences.update({ priceDropThreshold: { amount: 1.234, percent: 15 } });
    expect(await preferences.get()).toEqual({
      audioLanguage: "fr",
      subtitleLanguage: null,
      priceDropThreshold: { amount: 1.23, percent: 15 },
      notifications: DEFAULT_NOTIFICATIONS,
    });
  });

  it("enregistre les interrupteurs de notification un par un", async () => {
    const preferences = setup("p7");
    await preferences.update({ notifications: { priceDrop: false } });
    expect((await preferences.get()).notifications).toEqual({ atHome: true, priceDrop: false });
    await preferences.update({ notifications: { atHome: false } });
    expect((await preferences.get()).notifications).toEqual({ atHome: false, priceDrop: false });
    await preferences.update({ audioLanguage: "fr" });
    expect((await preferences.get()).notifications).toEqual({ atHome: false, priceDrop: false });
  });

  it("refuse des notifications invalides", async () => {
    const preferences = setup("p8");
    for (const notifications of [null, "oui", { atHome: "true" }, { priceDrop: 1 }]) {
      await expect(preferences.update({ notifications })).rejects.toThrow(InvalidPreferencesError);
    }
  });

  it("refuse un seuil invalide", async () => {
    const preferences = setup("p5");
    for (const priceDropThreshold of [null, { amount: -1, percent: 10 }, { amount: 1, percent: 101 }, { amount: "1", percent: 10 }, { amount: 1 }]) {
      await expect(preferences.update({ priceDropThreshold })).rejects.toThrow(InvalidPreferencesError);
    }
  });

  it("donne le seuil par défaut aux préférences enregistrées avant son ajout", async () => {
    await client.db("p6").collection("preferences").insertOne({ _id: "user" as never, audioLanguage: "fr", subtitleLanguage: null });
    expect(await setup("p6").get()).toEqual({
      audioLanguage: "fr",
      subtitleLanguage: null,
      priceDropThreshold: DEFAULT_PRICE_THRESHOLD,
      notifications: DEFAULT_NOTIFICATIONS,
    });
  });
});
