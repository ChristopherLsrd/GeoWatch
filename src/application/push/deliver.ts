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
