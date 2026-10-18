// Requête GET vers l'API TMDB : clé v3 en paramètre `api_key`, ou jeton v4 (« eyJ… ») en en-tête.

export const TMDB_API_URL = "https://api.themoviedb.org/3";
const TIMEOUT_MS = 5_000;

export function tmdbGet(apiKey: string, fetchFn: typeof fetch, path: string, params: Record<string, string> = {}): Promise<Response> {
  const bearer = apiKey.startsWith("eyJ");
  const search = new URLSearchParams(params);
  if (!bearer) search.set("api_key", apiKey);
  const query = search.toString();
  return fetchFn(`${TMDB_API_URL}${path}${query ? `?${query}` : ""}`, {
    headers: bearer ? { Authorization: `Bearer ${apiKey}` } : {},
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
}
