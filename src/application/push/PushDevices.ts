// Appareils qui reçoivent les notifications push : liste, enregistrement et retrait.

import type { PushSubscription } from "@/domain/Push";
import type { PushSubscriptionRepository } from "@/domain/ports/PushSubscriptionRepository";

export class InvalidPushSubscriptionError extends Error {
  constructor() {
    super("Abonnement push invalide.");
  }
}

// Sans les clés, qui restent côté serveur.
export type PushDevice = Pick<PushSubscription, "endpoint" | "device" | "createdAt">;

const MAX_DEVICE_LENGTH = 60;
const MAX_KEY_LENGTH = 512;
const MAX_ENDPOINT_LENGTH = 1024;

export class PushDevices {
  constructor(
    private readonly repository: PushSubscriptionRepository,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  async list(): Promise<PushDevice[]> {
    return (await this.repository.list()).map(({ endpoint, device, createdAt }) => ({ endpoint, device, createdAt }));
  }

  // input : le JSON de PushSubscription.toJSON() du navigateur, plus le nom de l'appareil.
  async register(input: unknown): Promise<PushDevice> {
    const { endpoint, keys, device } = (input ?? {}) as Record<string, unknown>;
    const { p256dh, auth } = (keys ?? {}) as Record<string, unknown>;
    if (!isHttpsUrl(endpoint) || !isKey(p256dh) || !isKey(auth)) throw new InvalidPushSubscriptionError();
    const subscription: PushSubscription = { endpoint, keys: { p256dh, auth }, device: deviceLabel(device), createdAt: this.clock() };
    await this.repository.save(subscription);
    // Relu après l'écriture : la date d'ajout est celle de la première inscription.
    const stored = (await this.repository.list()).find((s) => s.endpoint === endpoint) ?? subscription;
    return { endpoint, device: stored.device, createdAt: stored.createdAt };
  }

  async remove(endpoint: unknown): Promise<void> {
    if (typeof endpoint !== "string" || endpoint === "") throw new InvalidPushSubscriptionError();
    await this.repository.remove(endpoint);
  }
}

function isHttpsUrl(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_ENDPOINT_LENGTH) return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function isKey(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_KEY_LENGTH;
}

// Nom coupé à 60 caractères (points de code, pour ne pas couper une paire de substitution) ; « Navigateur » à défaut.
function deviceLabel(value: unknown): string {
  const label = typeof value === "string" ? Array.from(value.trim()).slice(0, MAX_DEVICE_LENGTH).join("") : "";
  return label || "Navigateur";
}
