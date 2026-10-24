// Lit la page d'un film Letterboxd pour le partage vers GeoWatch : identifiant TMDB (data-tmdb-id)
// et lien IMDb. Suit le lien court boxd.it, uniquement vers des hôtes Letterboxd et 3 fois au plus,
// pour que le serveur ne serve jamais de relais vers une autre adresse.
// Validé depuis Vercel le 2026-10-24 : pages lisibles, sans contrôle Cloudflare.

import type { LetterboxdFilm, LetterboxdFilmReader } from "@/domain/ports/LetterboxdFilmReader";

const HOSTS = new Set(["letterboxd.com", "boxd.it"]);
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 5_000;

export class LetterboxdHttpReader implements LetterboxdFilmReader {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async read(url: string): Promise<LetterboxdFilm> {
    let current = new URL(url);
    let slug = slugOf(current);
    try {
      for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects++) {
        if (!isLetterboxd(current)) return { kind: "unreadable", slug };
        const response = await this.fetchFn(current.toString(), {
          redirect: "manual",
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        const location = response.headers.get("location");
        if (response.status >= 300 && response.status < 400 && location) {
          current = new URL(location, current);
          slug = slugOf(current) ?? slug;
          continue;
        }
        if (response.status !== 200) return { kind: "unreadable", slug };
        const html = await response.text();
        const tmdbId = html.match(/data-tmdb-id="(\d+)"/)?.[1] ?? null;
        const imdbId = html.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ?? null;
        return tmdbId || imdbId ? { kind: "found", tmdbId, imdbId, slug } : { kind: "unreadable", slug };
      }
      return { kind: "unreadable", slug };
    } catch {
      return { kind: "unreadable", slug };
    }
  }
}

function isLetterboxd(url: URL): boolean {
  return url.protocol === "https:" && HOSTS.has(url.hostname.replace(/^www\./, ""));
}

// « https://letterboxd.com/film/parasite-2019/ » → « parasite-2019 ».
function slugOf(url: URL): string | null {
  if (url.hostname.replace(/^www\./, "") !== "letterboxd.com") return null;
  return url.pathname.match(/\/film\/([^/]+)/)?.[1] ?? null;
}
