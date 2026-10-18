// SONDE JETABLE (branche spike, jamais fusionnée) : que donne TMDB comme classification et raisons ?

import { tmdbGet } from "@/infrastructure/tmdb/tmdbGet";

const MOVIES = ["550", "680", "155", "27205", "603", "120467", "496243", "194", "872585", "569094", "346698", "1022789"];
const SHOWS = ["1399", "1396", "66732", "100088"];

type Rating = { iso_3166_1: string; certification?: string; rating?: string; descriptors?: string[] };

export async function GET() {
  const key = process.env.TMDB_API_KEY;
  if (!key) return Response.json({ error: "pas de clé" });
  const perCountry: Record<string, { withCert: number; withDescriptors: number; examples: string[] }> = {};
  const titles: unknown[] = [];

  const note = (id: string, ratings: Rating[]) => {
    const row: Record<string, string> = {};
    for (const r of ratings) {
      const cert = r.certification ?? r.rating ?? "";
      const descriptors = r.descriptors ?? [];
      const c = (perCountry[r.iso_3166_1] ??= { withCert: 0, withDescriptors: 0, examples: [] });
      if (cert) c.withCert++;
      if (descriptors.length) {
        c.withDescriptors++;
        if (c.examples.length < 4) c.examples.push(`${id}:${cert}:${descriptors.join("|")}`);
      }
      if (["FR", "US", "BE", "CA", "CH"].includes(r.iso_3166_1)) row[r.iso_3166_1] = `${cert}${descriptors.length ? ` [${descriptors.join(", ")}]` : ""}`;
    }
    titles.push({ id, ...row });
  };

  for (const id of MOVIES) {
    const res = await tmdbGet(key, fetch, `/movie/${id}/release_dates`);
    const body = (await res.json()) as { results?: { iso_3166_1: string; release_dates: Rating[] }[] };
    note(
      `m${id}`,
      (body.results ?? []).flatMap((c) => c.release_dates.map((d) => ({ ...d, iso_3166_1: c.iso_3166_1 }))),
    );
  }
  for (const id of SHOWS) {
    const res = await tmdbGet(key, fetch, `/tv/${id}/content_ratings`);
    const body = (await res.json()) as { results?: Rating[] };
    note(`s${id}`, body.results ?? []);
  }
  const withDescriptors = Object.fromEntries(Object.entries(perCountry).filter(([, v]) => v.withDescriptors > 0));
  const disco = await tmdbGet(key, fetch, "/discover/movie", { certification_country: "FR", certification: "12", language: "fr-FR" });
  const discoBody = (await disco.json()) as { total_results?: number };
  return Response.json({ titles, withDescriptors, countriesWithCert: Object.keys(perCountry).length, discoverFr12: discoBody.total_results });
}
