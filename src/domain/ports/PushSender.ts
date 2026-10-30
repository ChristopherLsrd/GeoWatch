import type { PushMessage, PushSubscription } from "../Push";

// Le service de push ne connaît plus l'abonnement (404 ou 410) : il faut l'oublier.
export class PushSubscriptionGoneError extends Error {
  constructor(readonly endpoint: string) {
    super("Abonnement push expiré.");
  }
}

export interface PushSender {
  send(subscription: PushSubscription, message: PushMessage): Promise<void>;
}
