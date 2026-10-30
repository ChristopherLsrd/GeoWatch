// Notification de test, envoyée à tous les appareils depuis les préférences.

import type { PushSender } from "@/domain/ports/PushSender";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";
import { deliver } from "./deliver";
import { TEST_MESSAGE } from "./pushMessages";

export class PushNotConfiguredError extends Error {
  constructor() {
    super("Notifications push non configurées (clés VAPID absentes).");
  }
}

export type TestResult = { device: string; ok: boolean; error: string | null };

export class SendTestNotification {
  constructor(
    private readonly subscriptions: PushSubscriptionRepository,
    private readonly sender: PushSender | null,
  ) {}

  async execute(): Promise<TestResult[]> {
    if (!this.sender) throw new PushNotConfiguredError();
    const results: TestResult[] = [];
    for (const device of await this.subscriptions.list()) {
      const delivery = await deliver(this.sender, this.subscriptions, device, [TEST_MESSAGE]);
      results.push({ device: device.device, ok: delivery.sent === 1, error: delivery.error });
    }
    return results;
  }
}
