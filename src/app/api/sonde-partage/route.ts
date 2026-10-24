// SONDE TEMPORAIRE (retirée dans la PR de la fonctionnalité) : depuis Vercel, Letterboxd laisse-t-il lire
// ses pages, JustWatch retrouve-t-il un titre par le chemin de sa page (urlV2), TMDB répond-il à /find ?

import { NextRequest, NextResponse } from "next/server";
import { JustWatchClient } from "@/infrastructure/justwatch/JustWatchClient";
import { tmdbGet } from "@/infrastructure/tmdb/tmdbGet";

export const dynamic = "force-dynamic";

const LETTERBOXD = [
  "https://letterboxd.com/film/the-shawshank-redemption/",
  "https://letterboxd.com/film/parasite-2019/",
  "https://letterboxd.com/film/dune-part-two/",
];
const JUSTWATCH_PATHS = ["/fr/film/les-evades", "/fr/serie/breaking-bad", "/us/movie/the-shawshank-redemption"];
const IMDB_IDS = ["tt0111161", "tt0903747"];
const LETTERBOXD_HOSTS = new Set(["letterboxd.com", "boxd.it"]);
const TIMEOUT_MS = 5_000;

const URL_V2 = `
query SondeUrl($fullPath: String!, $country: Country!, $language: Language!) {
  urlV2(fullPath: $fullPath) {
    node {
      id
      __typename
      ... on MovieOrShow {
        content(country: $country, language: $language) { title originalReleaseYear externalIds { imdbId tmdbId } }
      }
    }
  }
}`;

async function timed<T>(fn: () => Promise<T>): Promise<{ ms: number } & ({ ok: true; result: T } | { ok: false; error: string })> {
  const start = performance.now();
  try {
    const result = await fn();
    return { ok: true, ms: Math.round(performance.now() - start), result };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - start), error: String(error) };
  }
}

async function letterboxd(url: string) {
  return timed(async () => {
    let response = await fetch(url, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    const redirection = response.headers.get("location");
    if (redirection) {
      const target = new URL(redirection, url);
      if (!LETTERBOXD_HOSTS.has(target.hostname.replace(/^www\./, ""))) throw new Error(`redirection hors Letterboxd : ${target}`);
      response = await fetch(target, { cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
    }
    const html = await response.text();
    return {
      status: response.status,
      redirection,
      finalUrl: response.url || redirection,
      tmdbId: html.match(/data-tmdb-id="(\d+)"/)?.[1] ?? null,
      tmdbType: html.match(/data-tmdb-type="(\w+)"/)?.[1] ?? null,
      imdbId: html.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ?? null,
      cloudflare: /cf-chl|challenge-platform|Just a moment/i.test(html),
      taille: html.length,
    };
  });
}

async function justwatch(client: JustWatchClient, fullPath: string) {
  return timed(() => client.postAllowingErrors({ query: URL_V2, variables: { fullPath, country: "FR", language: "fr" } }));
}

async function tmdb(imdbId: string) {
  return timed(async () => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY absente");
    const response = await tmdbGet(apiKey, fetch, `/find/${imdbId}`, { external_source: "imdb_id", language: "fr-FR" });
    const json = await response.json();
    const pick = (r: { id: number; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string }) => ({
      id: r.id,
      titre: r.title ?? r.name,
      original: r.original_title ?? r.original_name,
      date: r.release_date ?? r.first_air_date,
    });
    return { status: response.status, films: (json.movie_results ?? []).map(pick), series: (json.tv_results ?? []).map(pick) };
  });
}

export async function GET(request: NextRequest) {
  const lien = request.nextUrl.searchParams.get("lien");
  const chemin = request.nextUrl.searchParams.get("chemin");
  const lienValide = lien && URL.canParse(lien) && LETTERBOXD_HOSTS.has(new URL(lien).hostname.replace(/^www\./, "")) ? lien : null;
  const client = new JustWatchClient();

  const [lb, jw, tm] = await Promise.all([
    Promise.all([...LETTERBOXD, ...(lienValide ? [lienValide] : [])].map(async (cible) => ({ cible, ...(await letterboxd(cible)) }))),
    Promise.all([...JUSTWATCH_PATHS, ...(chemin ? [chemin] : [])].map(async (cible) => ({ cible, ...(await justwatch(client, cible)) }))),
    Promise.all(IMDB_IDS.map(async (cible) => ({ cible, ...(await tmdb(cible)) }))),
  ]);
  return NextResponse.json({ letterboxd: lb, justwatch: jw, tmdb: tm, lienIgnore: lien && !lienValide ? lien : null });
}
