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

// `ok` = la source a répondu utilement ; une exception donne ok: false avec l'erreur.
async function timed(fn: () => Promise<{ ok: boolean } & Record<string, unknown>>) {
  const start = performance.now();
  try {
    const result = await fn();
    return { ...result, ms: Math.round(performance.now() - start) };
  } catch (error) {
    return { ok: false, ms: Math.round(performance.now() - start), error: String(error) };
  }
}

const MAX_HOPS = 3;

function estLetterboxd(url: URL) {
  return LETTERBOXD_HOSTS.has(url.hostname.replace(/^www\./, ""));
}

async function letterboxd(url: string) {
  return timed(async () => {
    const hops: { url: string; status: number }[] = [];
    let current = new URL(url);
    let response: Response;
    for (let i = 0; ; i++) {
      response = await fetch(current, { redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
      hops.push({ url: current.toString(), status: response.status });
      const location = response.headers.get("location");
      if (!location || response.status < 300 || response.status >= 400) break;
      if (i >= MAX_HOPS) throw new Error(`plus de ${MAX_HOPS} redirections`);
      const target = new URL(location, current);
      if (!estLetterboxd(target)) throw new Error(`redirection hors Letterboxd : ${target}`);
      current = target;
    }
    const html = await response.text();
    const titre = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? null;
    const cloudflare = response.status === 403 || response.status === 503 || /^just a moment/i.test(titre ?? "") || html.includes("cf-chl-");
    return {
      ok: response.status === 200 && !cloudflare,
      status: response.status,
      hops,
      titre,
      tmdbId: html.match(/data-tmdb-id="(\d+)"/)?.[1] ?? null,
      tmdbType: html.match(/data-tmdb-type="(\w+)"/)?.[1] ?? null,
      imdbId: html.match(/imdb\.com\/title\/(tt\d+)/)?.[1] ?? null,
      cloudflare,
      taille: html.length,
    };
  });
}

async function justwatch(client: JustWatchClient, fullPath: string) {
  return timed(async () => {
    const { data, errors } = await client.postAllowingErrors<{ urlV2: { node: unknown } | null }>({
      query: URL_V2,
      variables: { fullPath, country: "FR", language: "fr" },
    });
    return { ok: !errors && data?.urlV2?.node != null, errors, node: data?.urlV2?.node ?? null };
  });
}

async function tmdb(imdbId: string) {
  return timed(async () => {
    const apiKey = process.env.TMDB_API_KEY;
    if (!apiKey) throw new Error("TMDB_API_KEY absente");
    const response = await tmdbGet(apiKey, fetch, `/find/${imdbId}`, { external_source: "imdb_id", language: "fr-FR" });
    if (!response.ok) return { ok: false, status: response.status, corps: (await response.text()).slice(0, 300) };
    const json = await response.json();
    const pick = (r: { id: number; title?: string; name?: string; original_title?: string; original_name?: string; release_date?: string; first_air_date?: string }) => ({
      id: r.id,
      titre: r.title ?? r.name,
      original: r.original_title ?? r.original_name,
      date: r.release_date ?? r.first_air_date,
    });
    return { ok: true, status: response.status, films: (json.movie_results ?? []).map(pick), series: (json.tv_results ?? []).map(pick) };
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
