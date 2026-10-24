// Retrouve le titre JustWatch d'un contenu partagé vers GeoWatch (menu Partager d'Android).
// Par identifiant quand c'est possible (lien JustWatch ; IMDb, TMDB et Letterboxd via TMDB puis la
// recherche JustWatch), sinon par titre et année comme l'import Letterboxd (classify).
// Ne lève jamais : une source en panne renvoie vers la recherche de l'accueil.

import type { CatalogProvider } from "@/domain/ports/CatalogProvider";
import type { ExternalTitle, ExternalTitleLookup } from "@/domain/ports/ExternalTitleLookup";
import type { LetterboxdFilm, LetterboxdFilmReader } from "@/domain/ports/LetterboxdFilmReader";
import type { TitlePathLookup } from "@/domain/ports/TitlePathLookup";
import type { Title } from "@/domain/Title";
import { classify, type Match } from "../import/matchLetterboxd";
import { parseSharedContent, type SharedFields } from "./parseSharedContent";

export type ShareResolution =
  | { kind: "title"; id: string }
  | { kind: "candidates"; candidates: Title[] }
  | { kind: "search"; query: string };

const search = (query: string): ShareResolution => ({ kind: "search", query });
const UNREADABLE: LetterboxdFilm = { kind: "unreadable", slug: null };

export class ResolveSharedLink {
  constructor(
    private readonly catalog: CatalogProvider,
    private readonly lookup: ExternalTitleLookup,
    private readonly letterboxd: LetterboxdFilmReader,
    private readonly paths: TitlePathLookup,
  ) {}

  async execute(fields: SharedFields): Promise<ShareResolution> {
    const shared = parseSharedContent(fields);
    switch (shared.kind) {
      case "empty":
        return search("");
      case "query":
        return search(shared.query);
      case "imdb":
        return (await this.fromExternal(() => this.lookup.byImdbId(shared.imdbId))) ?? search(shared.query ?? "");
      case "tmdb":
        return (await this.fromExternal(() => this.lookup.byTmdbId(shared.tmdbId, shared.type))) ?? search(shared.query ?? "");
      case "justwatch":
        return this.fromJustWatch(shared.path, shared.query ?? "");
      case "letterboxd":
        return this.fromLetterboxd(shared.url, shared.query ?? "");
    }
  }

  private async fromJustWatch(path: string, sharedText: string): Promise<ShareResolution> {
    const id = await this.paths.byPath(path).catch(() => null);
    if (id) return { kind: "title", id };
    // « /fr/film/la-ligne-verte » → « la ligne verte ».
    return search(slugToName(path.split("/")[3] ?? "") || sharedText);
  }

  private async fromLetterboxd(url: string, sharedText: string): Promise<ShareResolution> {
    const film = await this.letterboxd.read(url).catch(() => UNREADABLE);
    if (film.kind === "found") {
      const { imdbId, tmdbId } = film;
      const resolved =
        (imdbId ? await this.fromExternal(() => this.lookup.byImdbId(imdbId)) : null) ??
        (tmdbId ? await this.fromExternal(() => this.lookup.byTmdbId(tmdbId, "MOVIE")) : null);
      if (resolved) return resolved;
    }
    return film.slug ? this.fromSlug(film.slug) : search(sharedText);
  }

  // null quand la source externe ne connaît pas le titre (ou ne répond pas).
  private async fromExternal(find: () => Promise<ExternalTitle | null>): Promise<ShareResolution | null> {
    const external = await find().catch(() => null);
    return external ? this.findInCatalog(external) : null;
  }

  // Recherche sous le nom français, puis sous le nom original ; correspondance par identifiant,
  // sinon par nom et année sur les résultats de la première recherche.
  private async findInCatalog(external: ExternalTitle): Promise<ShareResolution> {
    const names = [external.name, external.originalName].filter((name): name is string => !!name);
    let firstResults: Title[] | null = null;
    for (const name of names) {
      const results = await this.catalog.searchTitles(name).catch(() => null);
      if (!results) continue;
      firstResults ??= results;
      const match = results.find((candidate) => sameTitle(candidate, external));
      if (match) return { kind: "title", id: match.id };
    }
    if (!firstResults) return search(external.name);
    return fromMatch(classify({ name: external.name, year: external.year, type: external.type }, firstResults), external.name);
  }

  // Repli Letterboxd : « parasite-2019 » → « parasite » (2019). Si rien ne correspond, le nombre final
  // faisait peut-être partie du titre (« blade-runner-2049 ») : nouvelle recherche sur tout le slug.
  private async fromSlug(slug: string): Promise<ShareResolution> {
    const withYear = slug.match(/^(.+)-(\d{4})$/);
    const name = slugToName(withYear ? withYear[1] : slug);
    const year = withYear ? Number(withYear[2]) : null;
    const results = await this.catalog.searchTitles(name).catch(() => null);
    if (!results) return search(name);
    const match = classify({ name, year, type: "MOVIE" }, results);
    if (match.kind !== "notFound" || year === null) return fromMatch(match, name);

    const fullName = slugToName(slug);
    const again = await this.catalog.searchTitles(fullName).catch(() => null);
    return again ? fromMatch(classify({ name: fullName, year: null, type: "MOVIE" }, again), fullName) : search(fullName);
  }
}

function sameTitle(candidate: Title, external: ExternalTitle): boolean {
  if (external.imdbId && candidate.imdbId === external.imdbId) return true;
  // TMDB numérote films et séries séparément : le type doit aussi correspondre.
  return candidate.tmdbId === external.tmdbId && candidate.type === external.type;
}

function fromMatch(match: Match, query: string): ShareResolution {
  if (match.kind === "sure") return { kind: "title", id: match.title.id };
  if (match.kind === "ambiguous") return { kind: "candidates", candidates: match.candidates };
  return search(query);
}

function slugToName(slug: string): string {
  return slug.replace(/-+/g, " ").trim();
}
