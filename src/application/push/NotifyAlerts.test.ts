import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PREFERENCES, type NotificationSettings } from "@/domain/Preferences";
import { PushSubscriptionGoneError } from "@/domain/ports/PushSender";
import type { Alert } from "@/domain/WatchStatus";
import { device, fakePush } from "./fakes";
import { NotifyAlerts } from "./NotifyAlerts";

function alert(id: string, kind: Alert["kind"]): Alert {
  return {
    id,
    kind,
    title: { id, name: `Film ${id}`, posterUrl: null },
    platform: { id: "8", name: "Netflix", iconUrl: null },
    country: "FR",
    createdAt: new Date(),
  };
}

const prefs = (notifications: NotificationSettings) => ({ get: async () => ({ ...DEFAULT_PREFERENCES, notifications }), save: async () => {} });
const all = prefs({ atHome: true, priceDrop: true });

describe("NotifyAlerts", () => {
  afterEach(() => vi.restoreAllMocks());

  it("envoie chaque alerte à chaque appareil, sans la VF", async () => {
    const push = fakePush([device("e1"), device("e2")]);
    const report = await new NotifyAlerts(push.subscriptions, push.sender, all).execute([
      alert("tm1", "AT_HOME"),
      alert("tm2", "FRENCH_AUDIO"),
      alert("tm3", "PRICE_DROP"),
    ]);
    // Appareils servis en parallèle : seul l'ordre des messages de chaque appareil est garanti.
    const sentTo = (endpoint: string) => push.sent.filter(([e]) => e === endpoint).map(([, m]) => m.url);
    expect(sentTo("e1")).toEqual(["/titre/tm1", "/titre/tm3"]);
    expect(sentTo("e2")).toEqual(["/titre/tm1", "/titre/tm3"]);
    expect(push.sent).toHaveLength(4);
    expect(report).toEqual({ sent: 4, failed: 0, removed: 0 });
  });

  it("respecte les interrupteurs des préférences", async () => {
    const push = fakePush([device("e1")]);
    await new NotifyAlerts(push.subscriptions, push.sender, prefs({ atHome: false, priceDrop: true })).execute([
      alert("tm1", "AT_HOME"),
      alert("tm2", "PRICE_DROP"),
    ]);
    expect(push.sent.map(([, m]) => m.url)).toEqual(["/titre/tm2"]);
  });

  it("utilise les réglages par défaut si les préférences sont illisibles", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const push = fakePush([device("e1")]);
    const broken = { get: () => Promise.reject(new Error("Mongo")), save: async () => {} };
    await new NotifyAlerts(push.subscriptions, push.sender, broken).execute([alert("tm1", "AT_HOME")]);
    expect(push.sent).toHaveLength(1);
  });

  it("envoie un résumé au-delà de 3 alertes", async () => {
    const push = fakePush([device("e1")]);
    await new NotifyAlerts(push.subscriptions, push.sender, all).execute(["a", "b", "c", "d"].map((id) => alert(id, "AT_HOME")));
    expect(push.sent.map(([, m]) => m.body)).toEqual(["4 nouveautés dans votre liste"]);
  });

  it("retire un appareil expiré et continue avec les autres, même après une erreur", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const push = fakePush([device("gone"), device("broken"), device("ok")], {
      gone: new PushSubscriptionGoneError("gone"),
      broken: new Error("réseau"),
    });
    const report = await new NotifyAlerts(push.subscriptions, push.sender, all).execute([alert("tm1", "AT_HOME"), alert("tm2", "AT_HOME")]);
    expect(push.store.map((d) => d.endpoint)).toEqual(["broken", "ok"]);
    expect(push.sent.map(([e]) => e)).toEqual(["ok", "ok"]);
    expect(report).toEqual({ sent: 2, failed: 3, removed: 1 });
  });

  it("continue avec les autres appareils si le retrait d'un appareil expiré échoue", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const push = fakePush([device("gone"), device("ok")], { gone: new PushSubscriptionGoneError("gone") });
    push.subscriptions.remove = async () => {
      throw new Error("Mongo");
    };
    const report = await new NotifyAlerts(push.subscriptions, push.sender, all).execute([alert("tm1", "AT_HOME")]);
    expect(push.sent.map(([e]) => e)).toEqual(["ok"]);
    expect(report).toEqual({ sent: 1, failed: 1, removed: 0 });
  });

  it("ne fait rien sans alerte notifiable, sans appareil ou sans clés VAPID", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const push = fakePush([device("e1")]);
    expect(await new NotifyAlerts(push.subscriptions, push.sender, all).execute([alert("tm1", "FRENCH_AUDIO")])).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(await new NotifyAlerts(fakePush([]).subscriptions, push.sender, all).execute([alert("tm1", "AT_HOME")])).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(await new NotifyAlerts(push.subscriptions, null, all).execute([alert("tm1", "AT_HOME")])).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(push.sent).toEqual([]);
  });
});
