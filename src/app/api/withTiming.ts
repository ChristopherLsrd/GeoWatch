import { runWithTiming, serverTimingHeader } from "@/infrastructure/timing/requestTiming";

// Exécute un route handler dans un contexte de mesure et ajoute l'en-tête Server-Timing
// (temps Mongo, JustWatch et total), visible dans l'onglet Réseau du navigateur.
export function withTiming<A extends unknown[]>(
  handler: (...args: A) => Promise<Response>,
): (...args: A) => Promise<Response> {
  return async (...args) => {
    const { result, timings, totalMs } = await runWithTiming(() => handler(...args));
    result.headers.set("Server-Timing", serverTimingHeader(timings, totalMs));
    return result;
  };
}
