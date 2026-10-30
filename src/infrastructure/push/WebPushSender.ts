// Envoi Web Push signé VAPID, par le service de push du navigateur (FCM pour Chrome).

import { sendNotification, WebPushError } from "web-push";
import type { PushMessage, PushSubscription } from "@/domain/Push";
import { PushSubscriptionGoneError, type PushSender } from "@/domain/ports/PushSender";

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

// Durée pendant laquelle le service de push garde le message pour un appareil éteint.
const TTL_SECONDS = 24 * 3600;

export class WebPushSender implements PushSender {
  constructor(private readonly vapid: VapidConfig) {}

  async send(subscription: PushSubscription, message: PushMessage): Promise<void> {
    try {
      await sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify(message), {
        TTL: TTL_SECONDS,
        vapidDetails: { subject: this.vapid.subject, publicKey: this.vapid.publicKey, privateKey: this.vapid.privateKey },
      });
    } catch (error) {
      if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
        throw new PushSubscriptionGoneError(subscription.endpoint);
      }
      throw error;
    }
  }
}

// null si l'une des trois variables manque : les notifications sont alors désactivées.
export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const { VAPID_PUBLIC_KEY: publicKey, VAPID_PRIVATE_KEY: privateKey, VAPID_SUBJECT: subject } = env;
  return publicKey && privateKey && subject ? { publicKey, privateKey, subject } : null;
}
