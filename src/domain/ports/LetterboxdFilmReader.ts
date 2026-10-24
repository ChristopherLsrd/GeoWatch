// Lecture de la page d'un film Letterboxd (lien partagé) : ses identifiants TMDB et IMDb.
// Le slug (« parasite-2019 ») sert de repli quand la page est illisible.

export type LetterboxdFilm =
  | { kind: "found"; tmdbId: string | null; imdbId: string | null; slug: string | null }
  | { kind: "unreadable"; slug: string | null };

export interface LetterboxdFilmReader {
  // Ne lève jamais : une page bloquée ou injoignable donne « unreadable ».
  read(url: string): Promise<LetterboxdFilm>;
}
