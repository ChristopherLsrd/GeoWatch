// Appel d'une route API depuis le navigateur : redirige vers la connexion si la session a expiré.
// Le second argument est soit un AbortSignal (usage historique), soit des options `fetch` complètes.
export async function apiFetch(url: string, options?: AbortSignal | RequestInit): Promise<Response> {
  const init: RequestInit = options instanceof AbortSignal ? { signal: options } : (options ?? {});
  const response = await fetch(url, init);
  if (response.status === 401) {
    window.location.assign("/login");
    // La page est en cours de redirection : on ne rend jamais la main.
    return new Promise<Response>(() => {});
  }
  return response;
}
