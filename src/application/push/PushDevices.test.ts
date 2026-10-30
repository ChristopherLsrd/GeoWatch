import { describe, expect, it } from "vitest";
import { device, fakePush } from "./fakes";
import { InvalidPushSubscriptionError, PushDevices } from "./PushDevices";

const now = new Date("2026-10-30T10:00:00Z");
const valid = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: "p", auth: "a" }, device: "Chrome · Android" };

describe("PushDevices", () => {
  it("enregistre un abonnement valide et liste les appareils sans leurs clés", async () => {
    const push = fakePush([]);
    const devices = new PushDevices(push.subscriptions, () => now);
    expect(await devices.register(valid)).toEqual({ endpoint: valid.endpoint, device: "Chrome · Android", createdAt: now });
    expect(push.store[0].keys).toEqual({ p256dh: "p", auth: "a" });
    expect(await devices.list()).toEqual([{ endpoint: valid.endpoint, device: "Chrome · Android", createdAt: now }]);
  });

  it("nomme « Navigateur » un appareil sans nom et coupe les noms trop longs", async () => {
    const push = fakePush([]);
    const devices = new PushDevices(push.subscriptions, () => now);
    expect((await devices.register({ ...valid, device: "  " })).device).toBe("Navigateur");
    expect((await devices.register({ ...valid, device: "x".repeat(80) })).device).toHaveLength(60);
  });

  it("refuse un abonnement invalide", async () => {
    const devices = new PushDevices(fakePush([]).subscriptions);
    for (const input of [null, {}, { ...valid, endpoint: "http://push/x" }, { ...valid, endpoint: "pas une url" }, { ...valid, keys: { p256dh: "p" } }, { ...valid, keys: null }]) {
      await expect(devices.register(input)).rejects.toThrow(InvalidPushSubscriptionError);
    }
  });

  it("retire un appareil", async () => {
    const push = fakePush([device("https://push/a")]);
    await new PushDevices(push.subscriptions).remove("https://push/a");
    expect(push.store).toEqual([]);
    await expect(new PushDevices(push.subscriptions).remove(3)).rejects.toThrow(InvalidPushSubscriptionError);
  });
});
