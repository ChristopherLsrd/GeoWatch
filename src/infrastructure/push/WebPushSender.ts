// Envoi Web Push signé VAPID, par le service de push du navigateur (FCM pour Chrome).

import { sendNotification } from "web-push";
import type { PushMessage, PushSubscription } from "@/domain/Push";
import { PushSubscriptionGoneError, type PushSender } from "@/domain/ports/PushSender";

export type VapidConfig = { publicKey: string; privateKey: string; subject: string };

// Durée pendant laquelle le service de push garde le message pour un appareil éteint.
const TTL_SECONDS = 24 * 3600;

// Délai maximal d'un envoi : un service de push muet ne doit pas bloquer le cron quotidien.
const TIMEOUT_MS = 10_000;

export class WebPushSender implements PushSender {
  constructor(private readonly vapid: VapidConfig) {}

  async send(subscription: PushSubscription, message: PushMessage): Promise<void> {
    try {
      await sendNotification({ endpoint: subscription.endpoint, keys: subscription.keys }, JSON.stringify(message), {
        TTL: TTL_SECONDS,
        timeout: TIMEOUT_MS,
        vapidDetails: { subject: this.vapid.subject, publicKey: this.vapid.publicKey, privateKey: this.vapid.privateKey },
      });
    } catch (error) {
      // Détection par code HTTP et non par instanceof : la classe d'erreur peut être une autre copie selon le bundle.
      const status = (error as { statusCode?: unknown } | null)?.statusCode;
      // 403 : abonnement lié à une autre clé VAPID (clés renouvelées). Il n'aboutira plus jamais ; une fois
      // retiré, le bouton « Activer sur cet appareil » réapparaît et réabonne le navigateur avec la nouvelle clé.
      if (status === 403 || status === 404 || status === 410) {
        throw new PushSubscriptionGoneError(subscription.endpoint);
      }
      throw error;
    }
  }
}

// null si l'une des trois variables manque ou si le sujet n'est ni un mailto: ni un https: :
// les notifications sont alors désactivées. Valeurs sans espaces superflus (collées avec un retour à la ligne, par exemple).
export function vapidFromEnv(env: Record<string, string | undefined> = process.env): VapidConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  const subject = env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) return null;
  if (!subject.startsWith("mailto:") && !subject.startsWith("https:")) return null;
  return { publicKey, privateKey, subject };
}
