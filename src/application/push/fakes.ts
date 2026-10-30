// Faux ports pour les tests des notifications push.

import type { PushMessage, PushSubscription } from "@/domain/Push";
import type { PushSender } from "@/domain/ports/PushSender";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";

export function device(endpoint: string, name = endpoint): PushSubscription {
  return { endpoint, keys: { p256dh: "p", auth: "a" }, device: name, createdAt: new Date("2026-10-30T00:00:00Z") };
}

// failures : erreur levée pour un endpoint donné.
export function fakePush(devices: PushSubscription[], failures: Record<string, Error> = {}) {
  const store = [...devices];
  const sent: [string, PushMessage][] = [];
  const subscriptions: PushSubscriptionRepository = {
    list: async () => [...store],
    // Comme le port : un endpoint déjà connu garde sa date d'ajout.
    save: async (s) => {
      const existing = store.find((d) => d.endpoint === s.endpoint);
      if (existing) Object.assign(existing, { keys: s.keys, device: s.device });
      else store.push(s);
    },
    remove: async (endpoint) => {
      const index = store.findIndex((d) => d.endpoint === endpoint);
      if (index >= 0) store.splice(index, 1);
    },
  };
  const sender: PushSender = {
    send: async (subscription, message) => {
      const failure = failures[subscription.endpoint];
      if (failure) throw failure;
      sent.push([subscription.endpoint, message]);
    },
  };
  return { store, sent, subscriptions, sender };
}
