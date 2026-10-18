import { runWithTiming, serverTimingHeader } from "@/infrastructure/timing/requestTiming";

// Exécute un route handler dans un contexte de mesure et ajoute l'en-tête Server-Timing
// (temps Mongo, JustWatch et total), visible dans l'onglet Réseau du navigateur.
export function withTiming<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    const { result, timings, totalMs } = await runWithTiming(() => handler(...args));
    try {
      result.headers.set("Server-Timing", serverTimingHeader(timings, totalMs));
    } catch {
      // En-têtes immuables (Response.redirect, réponse relayée) : la mesure est simplement omise.
    }
    return result;
  };
}
