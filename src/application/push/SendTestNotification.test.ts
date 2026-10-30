import { describe, expect, it, vi } from "vitest";
import { PushSubscriptionGoneError } from "@/domain/ports/PushSender";
import { device, fakePush } from "./fakes";
import { PushNotConfiguredError, SendTestNotification } from "./SendTestNotification";

describe("SendTestNotification", () => {
  it("donne le résultat par appareil et retire les expirés", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const push = fakePush([device("e1", "Chrome · Android"), device("e2", "Edge · Windows"), device("e3", "Firefox · Linux")], {
      e2: new PushSubscriptionGoneError("e2"),
      e3: new Error("Délai dépassé"),
    });
    expect(await new SendTestNotification(push.subscriptions, push.sender).execute()).toEqual([
      { device: "Chrome · Android", ok: true, error: null },
      { device: "Edge · Windows", ok: false, error: "Appareil expiré, retiré de la liste." },
      { device: "Firefox · Linux", ok: false, error: "Délai dépassé" },
    ]);
    expect(push.sent.map(([, m]) => m.body)).toEqual(["Les notifications fonctionnent sur cet appareil."]);
    expect(push.store.map((d) => d.endpoint)).toEqual(["e1", "e3"]);
  });

  it("signale l'absence de clés VAPID", async () => {
    await expect(new SendTestNotification(fakePush([]).subscriptions, null).execute()).rejects.toThrow(PushNotConfiguredError);
  });
});
