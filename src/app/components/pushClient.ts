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
export async function subscribeToPush(publicKey: string): Promise<PushSubscription> {
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new PushPermissionError(permission);
  const registration = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  return (
    (await registration.pushManager.getSubscription()) ??
    registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(publicKey) })
  );
}

export type TestResult = { device: string; ok: boolean; error: string | null };

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
