import { describe, expect, it } from "vitest";
import { pickTrailer, type TmdbVideo, TmdbTitleExtras } from "./TmdbTitleExtras";

// Une réponse par appel, dans l'ordre ; la dernière est répétée.
function fakeFetch(responses: { status: number; body: unknown }[]) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const fn = (async (url: string, init: RequestInit) => {
    calls.push({ url, headers: init.headers as Record<string, string> });
    const { status, body } = responses[Math.min(calls.length - 1, responses.length - 1)];
    return new Response(JSON.stringify(body), { status });
  }) as unknown as typeof fetch;
  return { fn, calls };
}

const video = (over: Partial<TmdbVideo>): TmdbVideo => ({
  iso_639_1: "en",
  name: "Official Trailer",
  key: "k",
  site: "YouTube",
  type: "Trailer",
  official: true,
  ...over,
});

describe("pickTrailer", () => {
  it("préfère la version originale, puis l'anglais, puis une vidéo sans langue", () => {
    const videos = [
      video({ key: "sans", iso_639_1: null }),
      video({ key: "en", iso_639_1: "en" }),
      video({ key: "ko", iso_639_1: "ko" }),
    ];
    expect(pickTrailer(videos, "ko")?.youtubeKey).toBe("ko");
    expect(pickTrailer(videos.slice(0, 2), "ko")?.youtubeKey).toBe("en");
    expect(pickTrailer(videos.slice(0, 1), "ko")).toEqual({ youtubeKey: "sans", name: "Official Trailer", language: null });
  });

  it("préfère une bande-annonce à un teaser, et une vidéo officielle aux autres", () => {
    expect(pickTrailer([video({ key: "teaser", type: "Teaser" }), video({ key: "trailer" })], "en")?.youtubeKey).toBe("trailer");
    expect(pickTrailer([video({ key: "fan", official: false }), video({ key: "officielle" })], "en")?.youtubeKey).toBe("officielle");
    // La langue passe avant le type : un teaser en VO plutôt qu'une bande-annonce en anglais.
    expect(pickTrailer([video({ key: "en" }), video({ key: "ko", iso_639_1: "ko", type: "Teaser" })], "ko")?.youtubeKey).toBe("ko");
  });

  it("ignore les autres sites, les autres types de vidéo et les autres langues", () => {
    expect(
      pickTrailer(
        [video({ site: "Vimeo" }), video({ type: "Featurette" }), video({ iso_639_1: "fr" }), video({ key: "" })],
        "en",
      ),
    ).toBeNull();
  });
});

const inception = { original_language: "en", videos: { results: [video({ key: "YoHD9XEInc0" })] } };

describe("TmdbTitleExtras", () => {
  it("lit langue originale et bande-annonce en une requête pour un titre en anglais, et les garde en mémoire", async () => {
    const { fn, calls } = fakeFetch([{ status: 200, body: inception }]);
    const tmdb = new TmdbTitleExtras({ apiKey: "cle", fetch: fn });
    const expected = { originalLanguage: "en", trailer: { youtubeKey: "YoHD9XEInc0", name: "Official Trailer", language: "en" } };
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: "27205" })).toEqual(expected);
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: "27205" })).toEqual(expected);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(
      "https://api.themoviedb.org/3/movie/27205?append_to_response=videos&include_video_language=en%2Cnull&api_key=cle",
    );
  });

  it("demande les vidéos dans la langue originale quand ce n'est pas l'anglais", async () => {
    const { fn, calls } = fakeFetch([
      { status: 200, body: { original_language: "ko", videos: { results: [video({ key: "en" })] } } },
      { status: 200, body: { results: [video({ key: "en" }), video({ key: "ko", iso_639_1: "ko" })] } },
    ]);
    const tmdb = new TmdbTitleExtras({ apiKey: "eyJjeton", fetch: fn });
    expect(await tmdb.extras({ type: "SHOW", tmdbId: "93405" })).toMatchObject({ originalLanguage: "ko", trailer: { youtubeKey: "ko" } });
    expect(calls.map((c) => c.url)).toEqual([
      "https://api.themoviedb.org/3/tv/93405?append_to_response=videos&include_video_language=en%2Cnull",
      "https://api.themoviedb.org/3/tv/93405/videos?include_video_language=ko%2Cen%2Cnull",
    ]);
    expect(calls[0].headers).toEqual({ Authorization: "Bearer eyJjeton" });
  });

  it("garde la bande-annonce anglaise si la seconde requête échoue", async () => {
    const { fn } = fakeFetch([
      { status: 200, body: { original_language: "ko", videos: { results: [video({ key: "en" })] } } },
      { status: 500, body: {} },
    ]);
    const tmdb = new TmdbTitleExtras({ apiKey: "cle", fetch: fn });
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: "1" })).toMatchObject({ originalLanguage: "ko", trailer: { youtubeKey: "en" } });
  });

  it("ne renvoie rien sans clé, sans identifiant TMDB ou en cas d'erreur, et réessaie après une erreur passagère", async () => {
    const empty = { originalLanguage: null, trailer: null };
    const { fn, calls } = fakeFetch([{ status: 500, body: {} }]);
    expect(await new TmdbTitleExtras({ fetch: fn }).extras({ type: "MOVIE", tmdbId: "1" })).toEqual(empty);
    const tmdb = new TmdbTitleExtras({ apiKey: "cle", fetch: fn });
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: null })).toEqual(empty);
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: "1" })).toEqual(empty);
    expect(await tmdb.extras({ type: "MOVIE", tmdbId: "1" })).toEqual(empty);
    expect(calls).toHaveLength(2);
  });

  it("garde en mémoire un titre inconnu de TMDB (404)", async () => {
    const { fn, calls } = fakeFetch([{ status: 404, body: {} }]);
    const tmdb = new TmdbTitleExtras({ apiKey: "cle", fetch: fn });
    await tmdb.extras({ type: "MOVIE", tmdbId: "1" });
    await tmdb.extras({ type: "MOVIE", tmdbId: "1" });
    expect(calls).toHaveLength(1);
  });
});
