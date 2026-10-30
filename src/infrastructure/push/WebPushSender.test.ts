import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("web-push", () => {
  class WebPushError extends Error {
    constructor(message: string, readonly statusCode: number) {
      super(message);
    }
  }
  return { WebPushError, sendNotification: vi.fn() };
});

import { sendNotification, WebPushError } from "web-push";
import { PushSubscriptionGoneError } from "@/domain/ports/PushSender";
import { vapidFromEnv, WebPushSender } from "./WebPushSender";

const vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:moi@example.com" };
const subscription = { endpoint: "https://push/a", keys: { p256dh: "p", auth: "a" }, device: "Chrome", createdAt: new Date() };
const message = { title: "Dune", body: "Disponible sur Netflix (France)", url: "/titre/tm1" };
const webPushError = (status: number) => new (WebPushError as unknown as new (m: string, s: number) => Error)("push", status);

beforeEach(() => vi.mocked(sendNotification).mockReset());

describe("WebPushSender", () => {
  it("envoie le message en JSON avec les clés VAPID et une durée de vie de 24 h", async () => {
    vi.mocked(sendNotification).mockResolvedValue({ statusCode: 201, body: "", headers: {} });
    await new WebPushSender(vapid).send(subscription, message);
    expect(sendNotification).toHaveBeenCalledWith(
      { endpoint: "https://push/a", keys: { p256dh: "p", auth: "a" } },
      JSON.stringify(message),
      { TTL: 86_400, vapidDetails: { subject: "mailto:moi@example.com", publicKey: "pub", privateKey: "priv" } },
    );
  });

  it("traduit 404 et 410 en abonnement expiré, laisse passer les autres erreurs", async () => {
    const sender = new WebPushSender(vapid);
    for (const status of [404, 410]) {
      vi.mocked(sendNotification).mockRejectedValueOnce(webPushError(status));
      await expect(sender.send(subscription, message)).rejects.toThrow(PushSubscriptionGoneError);
    }
    vi.mocked(sendNotification).mockRejectedValueOnce(webPushError(500));
    await expect(sender.send(subscription, message)).rejects.not.toThrow(PushSubscriptionGoneError);
  });
});

describe("vapidFromEnv", () => {
  it("demande les trois variables", () => {
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:moi@example.com" })).toEqual(vapid);
    expect(vapidFromEnv({ VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" })).toBeNull();
  });
});
