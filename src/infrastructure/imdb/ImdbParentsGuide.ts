// Adaptateur ContentAdvisoryProvider : guide parental d'IMDb, par son API GraphQL non officielle.
// Tolérée pour un usage privé : 40 titres par requête, et le cache Mongo (CachedContentAdvisories) limite les appels.
// Chaque appel compte dans le temps « imdb » de l'en-tête Server-Timing.

import type { AdvisoryCategory, ContentAdvisory, Severity } from "@/domain/ContentAdvisory";
import { AdvisoryUnavailableError, type ContentAdvisoryProvider } from "@/domain/ports/ContentAdvisoryProvider";
import { measure } from "../timing/requestTiming";

const GRAPHQL_URL = "https://api.graphql.imdb.com/";
const TIMEOUT_MS = 5_000;
export const IMDB_BATCH = 40;

const CATEGORIES: Record<string, AdvisoryCategory> = {
  NUDITY: "nudity",
  VIOLENCE: "violence",
  PROFANITY: "profanity",
  ALCOHOL: "alcohol",
  FRIGHTENING: "frightening",
};

const SEVERITIES: Record<string, Severity> = {
  noneVotes: "none",
  mildVotes: "mild",
  moderateVotes: "moderate",
  severeVotes: "severe",
};

type ImdbCategory = { category: { id: string } | null; severity: { id: string } | null };
type ImdbResponse = {
  data?: { titles?: ({ id: string; parentsGuide: { categories: ImdbCategory[] | null } | null } | null)[] | null } | null;
  errors?: unknown[];
};

export class ImdbParentsGuide implements ContentAdvisoryProvider {
  constructor(private readonly fetchFn: typeof fetch = fetch) {}

  async advisories(imdbIds: string[]): Promise<Map<string, ContentAdvisory>> {
    // Identifiants vérifiés : ils sont écrits tels quels dans la requête.
    const ids = [...new Set(imdbIds.filter((id) => /^tt\d+$/.test(id)))];
    const result = new Map<string, ContentAdvisory>();
    for (let start = 0; start < ids.length; start += IMDB_BATCH) {
      const json = await this.post(ids.slice(start, start + IMDB_BATCH));
      for (const title of json.data?.titles ?? []) {
        if (!title) continue;
        const advisory = toAdvisory(title.parentsGuide?.categories ?? []);
        if (Object.keys(advisory).length > 0) result.set(title.id, advisory);
      }
    }
    return result;
  }

  private post(ids: string[]): Promise<ImdbResponse> {
    return measure("imdb", async () => {
      let response: Response;
      try {
        response = await this.fetchFn(GRAPHQL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-imdb-client-name": "imdb-web-next-localized",
            "User-Agent": "Mozilla/5.0",
          },
          body: JSON.stringify({
            query: `query { titles(ids: ${JSON.stringify(ids)}) { id parentsGuide { categories { category { id } severity { id } } } } }`,
          }),
          cache: "no-store",
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
      } catch (error) {
        throw new AdvisoryUnavailableError("IMDb injoignable", error);
      }
      const json = (await response.json().catch(() => null)) as ImdbResponse | null;
      if (!response.ok || !json?.data) {
        throw new AdvisoryUnavailableError(`IMDb a répondu ${response.status} : ${JSON.stringify(json?.errors ?? null).slice(0, 300)}`);
      }
      return json;
    });
  }
}

function toAdvisory(categories: ImdbCategory[]): ContentAdvisory {
  const advisory: ContentAdvisory = {};
  for (const { category, severity } of categories) {
    const key = category && CATEGORIES[category.id];
    const value = severity && SEVERITIES[severity.id];
    if (key && value) advisory[key] = value;
  }
  return advisory;
}
