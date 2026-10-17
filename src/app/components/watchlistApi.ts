import { apiFetch } from "./apiFetch";

const itemUrl = (titleId: string) => `/api/watchlist/${encodeURIComponent(titleId)}`;

// Retire un titre de la liste ; demande confirmation si une note non vide existe.
// `removed: false` sans `error` signifie que l'utilisateur a annulé.
export async function removeFromWatchlist(
  titleId: string,
  note: string,
): Promise<{ removed: true } | { removed: false; error?: string }> {
  if (note.trim() !== "" && !window.confirm("Ce titre a une note perso. Le retirer de votre liste la supprimera. Continuer ?")) {
    return { removed: false };
  }
  try {
    const response = await apiFetch(itemUrl(titleId), { method: "DELETE" });
    if (!response.ok) throw new Error(String(response.status));
    return { removed: true };
  } catch {
    return { removed: false, error: "Impossible de retirer le titre, réessayez." };
  }
}

// Enregistre la note d'un titre ; renvoie un message d'erreur en cas d'échec, null sinon.
export async function saveNote(titleId: string, note: string): Promise<string | null> {
  try {
    const response = await apiFetch(itemUrl(titleId), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    if (response.ok) return null;
    if (response.status === 400) return "Note trop longue (2000 caractères maximum).";
    if (response.status === 404) return "Ce titre n'est plus dans votre liste.";
    return "Impossible d'enregistrer la note, réessayez.";
  } catch {
    return "Impossible d'enregistrer la note, réessayez.";
  }
}
