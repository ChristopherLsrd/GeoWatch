import type { PushMessage, PushSubscription } from "@/domain/Push";
import { PushSubscriptionGoneError, type PushSender } from "@/domain/ports/PushSender";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";

export type Delivery = { sent: number; failed: number; removed: boolean; error: string | null };

// Envoie les messages à un appareil, dans l'ordre. Un appareil expiré est retiré et ne reçoit pas la suite ;
// une autre erreur est journalisée sans arrêter les messages suivants.
export async function deliver(
  sender: PushSender,
  subscriptions: PushSubscriptionRepository,
  device: PushSubscription,
  messages: PushMessage[],
): Promise<Delivery> {
  const delivery: Delivery = { sent: 0, failed: 0, removed: false, error: null };
  for (const message of messages) {
    try {
      await sender.send(device, message);
      delivery.sent++;
    } catch (error) {
      delivery.failed++;
      if (error instanceof PushSubscriptionGoneError) {
        // Un échec de retrait (base indisponible) ne doit pas interrompre les autres appareils.
        try {
          await subscriptions.remove(device.endpoint);
        } catch (removeError) {
          console.error(removeError);
          return { ...delivery, error: "Appareil expiré, retrait impossible." };
        }
        return { ...delivery, removed: true, error: "Appareil expiré, retiré de la liste." };
      }
      console.error(error);
      delivery.error = error instanceof Error ? error.message : String(error);
    }
  }
  return delivery;
}

// Envoie les messages à tous les appareils enregistrés, en parallèle. Une erreur imprévue sur un appareil
// est journalisée et comptée comme un échec, sans faire perdre les résultats des autres.
export async function deliverAll(
  sender: PushSender,
  subscriptions: PushSubscriptionRepository,
  messages: PushMessage[],
): Promise<{ device: PushSubscription; delivery: Delivery }[]> {
  const devices = await subscriptions.list();
  const settled = await Promise.allSettled(devices.map((device) => deliver(sender, subscriptions, device, messages)));
  return devices.map((device, i) => {
    const outcome = settled[i];
    if (outcome.status === "fulfilled") return { device, delivery: outcome.value };
    console.error(outcome.reason);
    const error = outcome.reason instanceof Error ? outcome.reason.message : String(outcome.reason);
    return { device, delivery: { sent: 0, failed: messages.length, removed: false, error } };
  });
}
