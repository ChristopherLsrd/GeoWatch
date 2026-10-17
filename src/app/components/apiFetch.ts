// Appel d'une route API depuis le navigateur : redirige vers la connexion si la session a expiré.
export async function apiFetch(url: string, signal?: AbortSignal): Promise<Response> {
  const response = await fetch(url, { signal });
  if (response.status === 401) {
    window.location.assign("/login");
    // La page est en cours de redirection : on ne rend jamais la main.
    return new Promise<Response>(() => {});
  }
  return response;
}
