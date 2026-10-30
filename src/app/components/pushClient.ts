// Notifications push côté navigateur : service worker, autorisation et abonnement.

// L'utilisateur a refusé ou ignoré la demande d'autorisation.
export class PushPermissionError extends Error {
  constructor(readonly permission: NotificationPermission) {
    super("Autorisation refusée.");
  }
}

export function pushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

// Clé publique VAPID (base64url) → octets attendus par pushManager.subscribe.
export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

// Autorisation d'abord (pendant le clic), puis service worker et abonnement.
// `replaced` : endpoint de l'ancien abonnement quand il a dû être remplacé (clé VAPID changée), à retirer du serveur.
export async function subscribeToPush(publicKey: string): Promise<{ subscription: PushSubscription; replaced: string | null }> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushPermissionError(permission);
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const key = base64UrlToBytes(publicKey);
  const existing = await registration.pushManager.getSubscription();
  if (existing && usesKey(existing, key)) return { subscription: existing, replaced: null };
  // Abonnement lié à une autre clé VAPID (clés changées côté serveur) : inutilisable, on le remplace.
  await existing?.unsubscribe();
  const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return { subscription, replaced: existing?.endpoint ?? null };
}

// L'abonnement a-t-il été créé avec cette clé publique ? Clé illisible : on garde l'abonnement.
export function usesKey(subscription: Pick<PushSubscription, "options">, key: Uint8Array): boolean {
  const current = subscription.options?.applicationServerKey;
  if (!current) return true;
  const bytes = new Uint8Array(current);
  return bytes.length === key.length && bytes.every((byte, index) => byte === key[index]);
}

// Type partagé avec la route de test (import de type seulement, rien n'arrive dans le bundle du navigateur).
import type { TestResult } from "@/application/push/SendTestNotification";
export type { TestResult };

// « Envoyée à 2 appareils » ; en cas d'échec, l'erreur appareil par appareil.
export function testResultText(results: TestResult[]): { ok: boolean; text: string } {
  if (results.length === 0) return { ok: false, text: "Aucun appareil enregistré." };
  const sent = results.filter((r) => r.ok).length;
  const failures = results.filter((r) => !r.ok);
  const sentText = `Envoyée à ${sent} appareil${sent > 1 ? "s" : ""}`;
  if (failures.length === 0) return { ok: true, text: sentText };
  const failureText = failures.map((r) => `${r.device} : ${r.error ?? "échec"}`).join(" ; ");
  return { ok: false, text: sent > 0 ? `${sentText}. ${failureText}` : failureText };
}
