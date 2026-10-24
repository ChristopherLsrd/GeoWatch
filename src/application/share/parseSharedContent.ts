// Analyse du contenu partagé vers GeoWatch (menu Partager d'Android) : reconnaît un lien IMDb, TMDB,
// JustWatch ou Letterboxd, sinon garde le texte pour la recherche de l'accueil.
// Un lien reconnu garde aussi le texte sans liens (« query »), dernier recours si la résolution échoue.
// Letterboxd met le lien dans « text » ; IMDb ajoute un paramètre de suivi (?ref_=ext_shr).

import type { TitleType } from "@/domain/Title";

export type SharedFields = { title?: string; text?: string; url?: string };

export type SharedContent =
  | { kind: "imdb"; imdbId: string; query?: string }
  | { kind: "tmdb"; tmdbId: string; type: TitleType; query?: string }
  | { kind: "justwatch"; path: string; query?: string }
  | { kind: "letterboxd"; url: string; query?: string }
  | { kind: "query"; query: string }
  | { kind: "empty" };

const LINK = /https?:\/\/[^\s<>"']+/i;
const LINKS = new RegExp(LINK.source, "gi");
// Ponctuation collée à la fin d'un lien dans une phrase (« … https://boxd.it/abc. »).
const TRAILING_PUNCTUATION = /[.,;:!?)\]»"']+$/;
const MAX_QUERY_LENGTH = 200;

export function parseSharedContent(fields: SharedFields): SharedContent {
  const title = fields.title?.trim() ?? "";
  const text = fields.text?.trim() ?? "";
  const url = fields.url?.trim() ?? "";
  const query = (withoutLinks(text) || withoutLinks(title)).slice(0, MAX_QUERY_LENGTH);
  // Tous les liens, dans l'ordre url, text, title : le premier reconnu l'emporte.
  for (const link of [url, text, title].flatMap(links)) {
    const recognized = recognize(new URL(link));
    if (recognized) return query ? { ...recognized, query } : recognized;
  }
  return query ? { kind: "query", query } : { kind: "empty" };
}

function links(value: string): string[] {
  return (value.match(LINKS) ?? []).map((raw) => raw.replace(TRAILING_PUNCTUATION, "")).filter((raw) => URL.canParse(raw));
}

function withoutLinks(value: string): string {
  return value.replace(LINKS, " ").replace(/\s+/g, " ").trim();
}

function recognize(url: URL): Exclude<SharedContent, { kind: "query" | "empty" }> | null {
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  const path = url.pathname;
  if (host === "imdb.com") {
    const imdbId = path.match(/^\/(?:[a-z]{2}(?:-[a-z]{2})?\/)?title\/(tt\d+)/i)?.[1];
    return imdbId ? { kind: "imdb", imdbId: imdbId.toLowerCase() } : null;
  }
  if (host === "themoviedb.org") {
    const match = path.match(/^\/(movie|tv)\/(\d+)/);
    return match ? { kind: "tmdb", tmdbId: match[2], type: match[1] === "movie" ? "MOVIE" : "SHOW" } : null;
  }
  if (host === "justwatch.com") {
    // Pays, type, slug : « /fr/serie/breaking-bad/saison-2 » → la série.
    const titlePath = path.match(/^\/[a-z]{2}\/[^/]+\/[^/]+/i)?.[0];
    return titlePath ? { kind: "justwatch", path: titlePath } : null;
  }
  if (host === "boxd.it") return path.length > 1 ? { kind: "letterboxd", url: `https://boxd.it${path}` } : null;
  if (host === "letterboxd.com") {
    // Page du film, ou d'un membre sur ce film (« /chris/film/parasite-2019/1/ »).
    const slug = path.match(/^\/(?:[^/]+\/)?film\/([^/]+)/)?.[1];
    return slug ? { kind: "letterboxd", url: `https://letterboxd.com/film/${slug}/` } : null;
  }
  return null;
}
