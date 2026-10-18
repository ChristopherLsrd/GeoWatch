// Client HTTP de l'API GraphQL non officielle de JustWatch, partagé par les adaptateurs.
// Chaque appel compte dans le temps « justwatch » de l'en-tête Server-Timing.

import { CatalogUnavailableError } from "@/domain/ports/CatalogProvider";
import { measure } from "../timing/requestTiming";

const GRAPHQL_URL = "https://apis.justwatch.com/graphql";
const IMAGES_URL = "https://images.justwatch.com";
const TIMEOUT_MS = 20_000;

export function imageUrl(path: string | null): string | null {
  if (!path) return null;
  return path.startsWith("http") ? path : `${IMAGES_URL}${path}`;
}

export class JustWatchClient {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  post<T>(body: object): Promise<T> {
    return measure("justwatch", async () => {
      const json = await this.send(body);
      if (json.errors) throw unexpected(200, json.errors);
      return json.data as T;
    });
  }

  // Comme post, mais renvoie aussi les erreurs GraphQL quand des données les accompagnent :
  // un identifiant inconnu donne une erreur et un nœud nul, à traiter comme « introuvable ».
  postAllowingErrors<T>(body: object): Promise<{ data: T; errors: unknown[] | null }> {
    return measure("justwatch", async () => {
      const json = await this.send(body);
      if (json.errors && !json.data) throw unexpected(200, json.errors);
      return { data: json.data as T, errors: json.errors ?? null };
    });
  }

  private async send(body: object): Promise<{ data?: unknown; errors?: unknown[] }> {
    let response: Response;
    try {
      response = await this.fetchFn(GRAPHQL_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new CatalogUnavailableError("JustWatch injoignable", error);
    }
    // 429 : limitation ; 403 : blocage ; 5xx : panne. Dans tous les cas, on s'arrête proprement.
    if (response.status === 429 || response.status === 403 || response.status >= 500) {
      throw new CatalogUnavailableError(`JustWatch a répondu ${response.status}`);
    }
    const json = await response.json().catch(() => null);
    if (!response.ok || !json) throw unexpected(response.status, json);
    return json;
  }
}

function unexpected(status: number, detail: unknown): Error {
  return new Error(`Réponse JustWatch inattendue (${status}) : ${JSON.stringify(detail).slice(0, 300)}`);
}
